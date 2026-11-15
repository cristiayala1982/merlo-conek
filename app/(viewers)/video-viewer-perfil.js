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
import { BackHandler } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const formatTime = (seconds) => {
  if (!seconds) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export default function VideoViewerPerfilScreen() {
  const { originUserId, fromEspontaneas } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isMounted = useRef(true);

  const [cargando, setCargando] = useState(true);
  const [progreso, setProgreso] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [estaPausado, setEstaPausado] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [post, setPost] = useState(null);
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [yoLikee, setYoLikee] = useState(false);
  const [videoKey, setVideoKey] = useState(0);

  const payload = getVideoViewerPayload() || {};
  const initialPost = payload.post || {};
  const videoUri = payload.videoUri || '';
  const targetId = initialPost?.id || initialPost?.postId;

  const player = useVideoPlayer(videoUri || null, (p) => {
    p.loop = true;
    p.play();
    p.timeUpdateEventInterval = 0.1;
  });

  useEffect(() => {
    isMounted.current = true;

    const backAction = () => {
      cerrarViewer();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => {
      isMounted.current = false;
      backHandler.remove();
      if (player) { try { player.pause(); } catch (e) {} }
      clearVideoViewerPayload();
    };
  }, [originUserId]);

  useEffect(() => {
    if (!targetId) {
      setPost(initialPost);
      return;
    }
    const unsub = onSnapshot(doc(db, 'posts', targetId), (snap) => {
      if (!isMounted.current) return;
      if (snap.exists()) {
        const data = snap.data();
        setPost({ id: snap.id, ...data });
        const miId = auth.currentUser?.uid;
        if (miId && data.likes) {
          setYoLikee(data.likes.includes(miId));
        }
      }
    });
    return () => unsub();
  }, [targetId]);

  const toggleLikePost = async () => {
    if (!targetId || !auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'posts', targetId), {
        likes: yoLikee ? arrayRemove(auth.currentUser.uid) : arrayUnion(auth.currentUser.uid),
      });

      if (!yoLikee) {
        await crearNotificacion({
          paraUserId: post.userId,
          tipo: 'like',
          postId: targetId,
          texto: 'le gusta tu publicación'
        });
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo actualizar el me gusta.');
    }
  };

  const handleDescargar = async () => {
    if (!videoUri || descargando) return;
    try {
      setDescargando(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permiso denegado", "Habilitá el acceso a la galería.");
        return;
      }

      const filename = `Conek_V_${Date.now()}.mp4`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadRes = await FileSystem.downloadAsync(videoUri, fileUri);
      if (downloadRes.status === 200) {
        await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
        Alert.alert("¡Guardado!", "El video se guardó en tu galería.");
        await FileSystem.deleteAsync(downloadRes.uri, { idempotent: true });
      }
    } catch (e) {
      Alert.alert("Error", "No se pudo descargar the video.");
    } finally {
      setDescargando(false);
    }
  };

  const cerrarViewer = () => {
    if (player) { try { player.pause(); } catch (e) {} }
    if (originUserId && originUserId !== auth.currentUser?.uid) {
      router.replace({
        pathname: '/(tabs)/perfilAjeno',
        params: { userId: originUserId, openEspontaneas: fromEspontaneas || 'false' }
      });
    } else {
      router.replace({
        pathname: '/(tabs)/perfil',
        params: { openEspontaneas: fromEspontaneas || 'false' }
      });
    }
  };

  const handleSeek = (event) => {
    if (!player || player.duration <= 0) return;
    const touchX = event.nativeEvent.locationX;
    const widthBarra = SCREEN_WIDTH - 30;
    const porcentaje = Math.max(0, Math.min(1, touchX / widthBarra));
    player.currentTime = porcentaje * player.duration;
  };

  useEffect(() => {
    if (!player) return;
    const timeSub = player.addListener('timeUpdate', (p) => {
      if (!isMounted.current) return;
      setCurrentTime(p.currentTime);
      const dur = player.duration;
      if (dur > 0) { setTotalDuration(dur); setProgreso(p.currentTime / dur); }
      if (p.currentTime > 0.05) setCargando(false);
    });
    const playSub = player.addListener('playingChange', (e) => { if (isMounted.current) setEstaPausado(!e.isPlaying); });
    return () => { timeSub.remove(); playSub.remove(); };
  }, [player]);

  if (!videoUri) return null;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={styles.videoWrapper}>
        <VideoView key={`vp-${videoKey}`} player={player} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} contentFit="contain" nativeControls={false} />
      </View>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => player.playing ? player.pause() : player.play()}>
        {post?.textoSobreMedia ? (
          <View style={styles.floatingTextWrap}>
            <Text style={styles.floatingTextContenido}>{post.textoSobreMedia}</Text>
          </View>
        ) : null}
        {estaPausado && !cargando && <View style={styles.fullCenterOverlay}><View style={styles.playCircle}><Ionicons name="play" size={60} color="white" style={{ marginLeft: 8 }} /></View></View>}
        {cargando && <View style={styles.fullCenterOverlay}><ActivityIndicator size="large" color="#FF6600" /></View>}
      </Pressable>
      <TouchableOpacity style={[styles.backBtn, { top: Math.max(40, insets.top + 10) }]} onPress={cerrarViewer}><Ionicons name="arrow-back" size={30} color="#FFFFFF" /></TouchableOpacity>
      <View style={styles.rightBar}>
        <TouchableOpacity style={styles.action} onPress={toggleLikePost}>
          <Ionicons
            name={yoLikee ? "heart" : "heart-outline"}
            size={34}
            color={yoLikee ? "#FF6600" : "#FFF"}
          />
          <Text style={styles.label} maxFontSizeMultiplier={1.25} numberOfLines={1}>{post?.likes?.length || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={() => setMostrarComentarios(true)}>
          <Ionicons name="chatbubble-outline" size={32} color="#FFF" />
          <Text style={styles.label} maxFontSizeMultiplier={1.25} numberOfLines={1}>{post?.comentariosCount || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={handleDescargar} disabled={descargando}>
          {descargando ? (
            <ActivityIndicator size="small" color="#FF6600" />
          ) : (
            <Ionicons name="download-outline" size={32} color="#FFF" />
          )}
          <Text style={styles.label} maxFontSizeMultiplier={1.25} numberOfLines={1}>Guardar</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.bottomBlock, { paddingBottom: Math.max(35, insets.bottom + 25) }]}>
        <TouchableOpacity style={styles.userRow} onPress={cerrarViewer}>
          <Image source={{ uri: post?.userPhotoUrl || 'https://picsum.photos/100' }} style={styles.avatar} />
          <Text style={styles.name}>{post?.userName || 'Perfil'}</Text>
        </TouchableOpacity>
        {(post?.texto || post?.text) && <Text style={styles.caption} numberOfLines={2}>{post?.texto || post?.text}</Text>}

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(currentTime)} / {formatTime(totalDuration)}</Text>
        </View>
        <Pressable style={styles.barArea} onPress={handleSeek}>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${progreso * 100}%` }]} />
          </View>
        </Pressable>
      </View>
      <ComentariosModal visible={mostrarComentarios} onClose={() => setMostrarComentarios(false)} post={post} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
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
  name: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  caption: { color: '#FFF', fontSize: 14, lineHeight: 18, marginBottom: 15, paddingRight: 60 },
  floatingTextWrap: {
    position: 'absolute',
    bottom: 180,
    left: 20,
    right: 80,
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 60,
  },
  floatingTextContenido: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timeRow: { marginBottom: 5 },
  timeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  barArea: { width: '100%', height: 36, justifyContent: 'center' },
  barTrack: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#FF6600' }
});
