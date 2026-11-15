import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  Text,
  Image,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  Alert
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearVideoViewerPayload, getVideoViewerPayload } from '../../services/videoViewerState';
import { auth, db } from '../../firebaseConfig';
import { doc, onSnapshot, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { crearNotificacion } from '../../services/firebaseService';
import ComentariosModal from '../../components/home/ComentariosModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const formatTime = (seconds) => {
  if (!seconds) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export default function VideoViewerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isMounted = useRef(true);

  const [cargando, setCargando] = useState(true);
  const [progreso, setProgreso] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [estaPausado, setEstaPausado] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [verMas, setVerMas] = useState(false);
  const [videoKey, setVideoKey] = useState(0);

  const payload = getVideoViewerPayload() || {};
  const initialPost = payload.post || {};
  const videoUri = payload.videoUri || '';
  const isChat = initialPost?.isChat === true;
  const targetId = initialPost?.id || initialPost?.postId;
  const collectionName = isChat ? 'mensajes_chat' : 'posts';

  // PRIORIDAD INMEDIATA: Usamos los datos del payload para carga instantánea
  const [post, setPost] = useState({
    ...initialPost,
    userName: isChat ? (initialPost.user || 'Usuario') : (initialPost.userName || 'Usuario'),
    userPhotoUrl: isChat ? (initialPost.userPhoto || 'https://picsum.photos/100') : (initialPost.userPhotoUrl || 'https://picsum.photos/100'),
    texto: initialPost.texto || initialPost.text || ''
  });

  const player = useVideoPlayer(videoUri || null, (p) => {
    p.loop = true;
    p.play();
    p.timeUpdateEventInterval = 0.1;
  });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (player) {
        try { player.pause(); } catch (e) {}
      }
      clearVideoViewerPayload();
    };
  }, []);

  useEffect(() => {
    if (!targetId || !collectionName) {
      setPost({
        ...initialPost,
        userName: isChat ? initialPost.user : initialPost.userName,
        userPhotoUrl: isChat ? initialPost.userPhoto : (initialPost.userPhotoUrl || initialPost.userPhoto)
      });
      return;
    }

    try {
      const unsub = onSnapshot(doc(db, collectionName, targetId), (snap) => {
        if (!isMounted.current) return;
        if (snap.exists()) {
          const data = snap.data();
          setPost({
            id: snap.id,
            ...data,
            isChat,
            userName: isChat ? (data.user || initialPost.user) : (data.userName || initialPost.userName),
            userPhotoUrl: isChat ? (data.userPhoto || initialPost.userPhoto) : (data.userPhotoUrl || data.userPhoto || initialPost.userPhotoUrl || initialPost.userPhoto)
          });
        }
      });
      return () => unsub();
    } catch (e) {
      setPost(initialPost);
    }
  }, [targetId, collectionName]);

  const toggleLike = async () => {
    if (isChat || !targetId || !post) return;
    const miId = auth.currentUser?.uid;
    const yoLikee = post.likes?.includes(miId);
    try {
      await updateDoc(doc(db, 'posts', targetId), {
        likes: yoLikee ? arrayRemove(miId) : arrayUnion(miId),
      });
      if (!yoLikee) {
        await crearNotificacion({
          paraUserId: post.userId,
          tipo: 'like',
          postId: targetId,
          texto: 'le gusta tu video'
        });
      }
    } catch (e) { Alert.alert('Error', 'No se pudo procesar.'); }
  };

  const irAlPerfil = () => {
    const uId = post?.userId;
    if (!uId) return;
    if (uId === auth.currentUser?.uid) router.push('/(tabs)/perfil');
    else router.push({ pathname: '/(tabs)/perfilAjeno', params: { userId: uId } });
  };

  const handleDescargar = async () => {
    if (!videoUri || descargando) return;
    try {
      setDescargando(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert("Permiso denegado", "Habilitá el acceso a la galería para poder guardar videos.");
        setDescargando(false);
        return;
      }

      const filename = `Conek_${Date.now()}.mp4`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadRes = await FileSystem.downloadAsync(videoUri, fileUri);

      if (downloadRes.status === 200) {
        try {
          await MediaLibrary.createAssetAsync(downloadRes.uri);
          Alert.alert("¡Guardado!", "El video ya está en tu galería de fotos.");
        } catch (copyErr) {
          await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
          Alert.alert("¡Guardado!", "El video se guardó en tu álbum de videos.");
        }
        await FileSystem.deleteAsync(downloadRes.uri, { idempotent: true });
      }
    } catch (e) {
      setDescargando(false);
    } finally {
      if (isMounted.current) setDescargando(false);
    }
  };

  useEffect(() => {
    if (!player) return;

    const timeSub = player.addListener('timeUpdate', (p) => {
      if (!isMounted.current) return;
      setCurrentTime(p.currentTime);
      const dur = player.duration;
      if (dur > 0) {
        setTotalDuration(dur);
        setProgreso(p.currentTime / dur);
      }
      if (p.currentTime > 0.05) setCargando(false);
    });

    const playSub = player.addListener('playingChange', (e) => {
      if (isMounted.current) setEstaPausado(!e.isPlaying);
      if (e.isPlaying) setCargando(false);
    });

    const statusSub = player.addListener('statusChange', (e) => {
      if (e.status === 'readyToPlay') {
        if (isMounted.current) {
          setCargando(false);
          setVideoKey(prev => prev + 1);
        }

        const t = setTimeout(() => {
          try {
            if (isMounted.current && player) {
              player.play();
            }
          } catch (err) {}
        }, 150);
        return () => clearTimeout(t);
      }
    });

    return () => {
      timeSub.remove();
      playSub.remove();
      statusSub.remove();
    };
  }, [player]);

  const cerrarViewer = () => {
    if (player) {
      try {
          player.pause();
          console.log('🎬 [Video Chats/Muro] Reproductor pausado al cerrar el visor.');
      } catch (e) {}
    }
    router.back();
  };

  const handleSeek = (event) => {
    if (!player || player.duration <= 0) return;
    const touchX = event.nativeEvent.locationX;
    const widthBarra = SCREEN_WIDTH - 30;
    const porcentaje = Math.max(0, Math.min(1, touchX / widthBarra));
    player.currentTime = porcentaje * player.duration;
  };

  if (!videoUri) return null;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <View style={styles.videoWrapper}>
        <VideoView
          key={`v-surf-${videoKey}`}
          player={player}
          style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
          contentFit="contain"
          nativeControls={false}
        />
      </View>

      <Pressable style={StyleSheet.absoluteFill} onPress={() => player.playing ? player.pause() : player.play()} activeOpacity={1}>
        {post?.textoSobreMedia ? (
          <View style={styles.floatingTextWrap}>
            <Text style={styles.floatingTextContenido}>{post.textoSobreMedia}</Text>
          </View>
        ) : null}
        {estaPausado && !cargando && (
          <View style={styles.fullCenterOverlay} pointerEvents="none">
            <View style={styles.playCircle}><Ionicons name="play" size={60} color="white" style={{ marginLeft: 8 }} /></View>
          </View>
        )}
        {cargando && (
          <View style={styles.fullCenterOverlay}><ActivityIndicator size="large" color="#FF6600" /></View>
        )}
      </Pressable>

      <TouchableOpacity style={[styles.backBtn, { top: Math.max(40, insets.top + 10) }]} onPress={cerrarViewer}>
        <Ionicons name="arrow-back" size={30} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.rightBar}>
        {!isChat && (
          <>
            <TouchableOpacity style={styles.action} onPress={toggleLike}>
              <Ionicons
                name={post?.likes?.includes(auth.currentUser?.uid) ? "heart" : "heart-outline"}
                size={36}
                color={post?.likes?.includes(auth.currentUser?.uid) ? "#FF6600" : "#FFF"}
              />
              <Text style={styles.label} maxFontSizeMultiplier={1.25} numberOfLines={1}>{post?.likes?.length || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => setMostrarComentarios(true)}><Ionicons name="chatbubble-outline" size={32} color="#FFF" /><Text style={styles.label} maxFontSizeMultiplier={1.25} numberOfLines={1}>{post?.comentariosCount || 0}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.action}><Ionicons name="share-social-outline" size={32} color="#FFF" /><Text style={styles.label} maxFontSizeMultiplier={1.25} numberOfLines={1}>Compartir</Text></TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={styles.action} onPress={handleDescargar} disabled={descargando}>
          {descargando ? <ActivityIndicator size="small" color="#FF6600" /> : <Ionicons name="download-outline" size={32} color="#FFF" />}
          <Text style={styles.label} maxFontSizeMultiplier={1.25} numberOfLines={1}>Guardar</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.bottomBlock, { paddingBottom: Math.max(35, insets.bottom + 25) }]}>
        <TouchableOpacity style={styles.userRow} onPress={irAlPerfil}>
          <Image
            source={{ uri: post?.userPhotoUrl || post?.userPhoto || 'https://picsum.photos/100' }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{post?.userName || 'Usuario'}</Text>
        </TouchableOpacity>
        {(post?.texto || post?.text) && (
          <TouchableOpacity onPress={() => setVerMas(!verMas)} activeOpacity={0.7}>
            <Text
              style={styles.caption}
              numberOfLines={verMas ? 10 : 2}
            >
              {post?.texto || post?.text}
              {!verMas && (post?.texto || post?.text).length > 80 && (
                <Text style={styles.verMasBtn}> ...ver más</Text>
              )}
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.timeRow}><Text style={styles.timeText}>{formatTime(currentTime)} / {formatTime(totalDuration)}</Text></View>
        <Pressable style={styles.barArea} onPress={handleSeek}>
          <View style={styles.barTrack}><View style={[styles.barFill, { width: `${progreso * 100}%` }]} /></View>
        </Pressable>
      </View>

      {!isChat && <ComentariosModal visible={mostrarComentarios} onClose={() => setMostrarComentarios(false)} post={post} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#010101' },
  videoWrapper: { ...StyleSheet.absoluteFillObject, backgroundColor: '#010101', justifyContent: 'center', alignItems: 'center' },
  fullCenterOverlay: { position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  playCircle: { width: 85, height: 85, borderRadius: 45, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  backBtn: { position: 'absolute', left: 16, zIndex: 100, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 22 },
  rightBar: { position: 'absolute', right: 12, bottom: 180, alignItems: 'center', zIndex: 50 },
  action: { alignItems: 'center', marginBottom: 25 },
  label: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  bottomBlock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 15, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.2)' },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#FFF' },
  name: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginLeft: 10, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  caption: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, marginBottom: 15, paddingRight: 60, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  verMasBtn: {
    color: '#CCC',
    fontWeight: 'bold',
    fontSize: 13
  },
  floatingTextWrap: {
    position: 'absolute',
    bottom: 240, // Subido proporcionalmente para no chocar con la barra de tiempo
    left: 15,
    right: 65,
    alignItems: 'flex-start',
    zIndex: 60,
  },
  floatingTextContenido: {
    color: '#FFFFFF',
    fontSize: 16, // Ajustado a 16 exactos
    fontWeight: '800',
    textAlign: 'left',
    lineHeight: 21,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1.5, height: 1.5 },
    textShadowRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    width: '100%',
  },
  timeRow: { marginBottom: 5 },
  timeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  barArea: { width: '100%', height: 36, justifyContent: 'center' },
  barTrack: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#FF6600' }
});
