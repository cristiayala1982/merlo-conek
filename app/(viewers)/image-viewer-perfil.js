import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  Alert
} from 'react-native';
import { Image } from 'expo-image';
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

export default function ImageViewerPerfilScreen() {
  const { originUserId, fromEspontaneas } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isMounted = useRef(true);

  const [descargando, setDescargando] = useState(false);
  const [post, setPost] = useState(null);
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [yoLikee, setYoLikee] = useState(false);

  const payload = getVideoViewerPayload() || {};
  const initialPost = payload.post || {};
  const imageUri = payload.videoUri || '';
  const targetId = initialPost?.id || initialPost?.postId;

  useEffect(() => {
    isMounted.current = true;
    const backAction = () => { cerrarViewer(); return true; };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => {
      isMounted.current = false;
      backHandler.remove();
      clearVideoViewerPayload();
    };
  }, [originUserId]);

  useEffect(() => {
    if (!targetId) { setPost(initialPost); return; }
    const unsub = onSnapshot(doc(db, 'posts', targetId), (snap) => {
      if (!isMounted.current) return;
      if (snap.exists()) {
        const data = snap.data();
        setPost({ id: snap.id, ...data });
        const miId = auth.currentUser?.uid;
        if (miId && data.likes) setYoLikee(data.likes.includes(miId));
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
        await crearNotificacion({ paraUserId: post.userId, tipo: 'like', postId: targetId, texto: 'le gusta tu publicación' });
      }
    } catch (e) { Alert.alert('Error', 'No se pudo actualizar.'); }
  };

  const handleDescargar = async () => {
    if (!imageUri || descargando) return;
    try {
      setDescargando(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert("Permiso denegado"); return; }
      const fileUri = `${FileSystem.cacheDirectory}Conek_I_${Date.now()}.jpg`;
      const downloadRes = await FileSystem.downloadAsync(imageUri, fileUri);
      if (downloadRes.status === 200) {
        await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
        Alert.alert("¡Guardado!");
        await FileSystem.deleteAsync(downloadRes.uri, { idempotent: true });
      }
    } finally { setDescargando(false); }
  };

  const cerrarViewer = () => {
    if (originUserId && originUserId !== auth.currentUser?.uid) {
      router.replace({ pathname: '/(tabs)/perfilAjeno', params: { userId: originUserId, openEspontaneas: fromEspontaneas || 'false' } });
    } else {
      router.replace({ pathname: '/(tabs)/perfil', params: { openEspontaneas: fromEspontaneas || 'false' } });
    }
  };

  if (!imageUri) return null;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Pressable style={styles.imageWrapper} onPress={cerrarViewer}>
        <Image
          source={{ uri: imageUri }}
          style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={200}
        />
        {post?.textoSobreMedia ? (
          <View style={styles.floatingTextWrap}><Text style={styles.floatingTextContenido}>{post.textoSobreMedia}</Text></View>
        ) : null}
      </Pressable>
      <TouchableOpacity style={[styles.backBtn, { top: Math.max(40, insets.top + 10) }]} onPress={cerrarViewer}><Ionicons name="arrow-back" size={30} color="#FFFFFF" /></TouchableOpacity>
      <View style={styles.rightBar}>
        <TouchableOpacity style={styles.action} onPress={toggleLikePost}><Ionicons name={yoLikee ? "heart" : "heart-outline"} size={34} color={yoLikee ? "#FF6600" : "#FFF"} /><Text style={styles.label} maxFontSizeMultiplier={1.25} numberOfLines={1}>{post?.likes?.length || 0}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => setMostrarComentarios(true)}><Ionicons name="chatbubble-outline" size={32} color="#FFF" /><Text style={styles.label} maxFontSizeMultiplier={1.25} numberOfLines={1}>{post?.comentariosCount || 0}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={handleDescargar} disabled={descargando}>{descargando ? <ActivityIndicator size="small" color="#FF6600" /> : <Ionicons name="download-outline" size={32} color="#FFF" />}<Text style={styles.label} maxFontSizeMultiplier={1.25} numberOfLines={1}>Guardar</Text></TouchableOpacity>
      </View>
      <View style={[styles.bottomBlock, { paddingBottom: Math.max(35, insets.bottom + 25) }]}>
        <TouchableOpacity style={styles.userRow} onPress={cerrarViewer}>
          <Image
            source={{ uri: post?.userPhotoUrl || 'https://picsum.photos/100' }}
            style={styles.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <Text style={styles.name}>{post?.userName || 'Perfil'}</Text>
        </TouchableOpacity>
        {(post?.texto || post?.text) && <Text style={styles.caption} numberOfLines={2}>{post?.texto || post?.text}</Text>}
      </View>
      <ComentariosModal visible={mostrarComentarios} onClose={() => setMostrarComentarios(false)} post={post} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  imageWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: { position: 'absolute', left: 16, zIndex: 100, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 22 },
  rightBar: { position: 'absolute', right: 12, bottom: 180, alignItems: 'center', zIndex: 50 },
  action: { alignItems: 'center', marginBottom: 25 },
  label: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  bottomBlock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 15, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.2)' },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#FFF' },
  name: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  caption: { color: '#FFF', fontSize: 14, lineHeight: 18, marginBottom: 15, paddingRight: 60 },
  floatingTextWrap: { position: 'absolute', bottom: 180, left: 20, right: 80, alignItems: 'flex-start', justifyContent: 'center', zIndex: 60 },
  floatingTextContenido: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'left', textShadowColor: 'rgba(0, 0, 0, 0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 10, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
});
