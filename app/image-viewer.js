import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { clearVideoViewerPayload, getVideoViewerPayload } from '../services/videoViewerState';
import { auth, db } from '../firebaseConfig';
import { doc, onSnapshot, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { crearNotificacion } from '../services/firebaseService';
import ComentariosModal from '../components/home/ComentariosModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ImageViewerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [descargando, setDescargando] = useState(false);
  const [post, setPost] = useState(null);
  const [mostrarComentarios, setMostrarComentarios] = useState(false);

  const payload = getVideoViewerPayload() || {}; // Reutilizamos el mismo payload state
  const initialPost = payload.post || {};
  const imageUri = payload.videoUri || ''; // En este caso es la imagen
  const targetId = initialPost?.id || initialPost?.postId;

  useEffect(() => {
    if (!targetId) {
      setPost(initialPost);
      return;
    }

    const unsub = onSnapshot(doc(db, 'posts', targetId), (snap) => {
      if (snap.exists()) {
        setPost({ id: snap.id, ...snap.data() });
      }
    });
    return () => unsub();
  }, [targetId]);

  const toggleLike = async () => {
    if (!targetId || !post) return;
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
          texto: 'le gusta tu foto'
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
    if (!imageUri || descargando) return;
    try {
      setDescargando(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert("Permiso denegado", "Habilitá el acceso a la galería para poder guardar fotos.");
        setDescargando(false);
        return;
      }

      const filename = `Conek_${Date.now()}.jpg`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      const downloadRes = await FileSystem.downloadAsync(imageUri, fileUri);

      if (downloadRes.status === 200) {
        await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
        Alert.alert("¡Guardado!", "La foto se guardó en tu álbum.");
        await FileSystem.deleteAsync(downloadRes.uri, { idempotent: true });
      }
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar la imagen.");
    } finally {
      setDescargando(false);
    }
  };

  const cerrarViewer = () => {
    clearVideoViewerPayload();
    router.back();
  };

  if (!imageUri) return null;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <Pressable style={styles.imageWrapper} onPress={cerrarViewer}>
        <Image
          source={{ uri: imageUri }}
          style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
          resizeMode="contain"
        />
      </Pressable>

      <TouchableOpacity style={[styles.backBtn, { top: Math.max(40, insets.top + 10) }]} onPress={cerrarViewer}>
        <Ionicons name="arrow-back" size={30} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.rightBar}>
        <TouchableOpacity style={styles.action} onPress={toggleLike}>
          <Ionicons
            name={post?.likes?.includes(auth.currentUser?.uid) ? "heart" : "heart-outline"}
            size={36}
            color={post?.likes?.includes(auth.currentUser?.uid) ? "#FF6600" : "#FFF"}
          />
          <Text style={styles.label}>{post?.likes?.length || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => setMostrarComentarios(true)}>
          <Ionicons name="chatbubble-outline" size={32} color="#FFF" />
          <Text style={styles.label}>{post?.comentariosCount || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action}>
          <Ionicons name="share-social-outline" size={32} color="#FFF" />
          <Text style={styles.label}>Compartir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={handleDescargar} disabled={descargando}>
          {descargando ? <ActivityIndicator size="small" color="#FF6600" /> : <Ionicons name="download-outline" size={32} color="#FFF" />}
          <Text style={styles.label}>Guardar</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.bottomBlock, { paddingBottom: Math.max(35, insets.bottom + 25) }]}>
        <TouchableOpacity style={styles.userRow} onPress={irAlPerfil}>
          <Image source={{ uri: post?.userPhotoUrl || 'https://picsum.photos/100' }} style={styles.avatar} />
          <Text style={styles.name}>{post?.userName || 'Cargando...'}</Text>
        </TouchableOpacity>
        {(post?.texto || post?.text) && <Text style={styles.caption} numberOfLines={3}>{post?.texto || post?.text}</Text>}
      </View>

      <ComentariosModal visible={mostrarComentarios} onClose={() => setMostrarComentarios(false)} post={post} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  imageWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: { position: 'absolute', left: 16, zIndex: 100, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 22 },
  rightBar: { position: 'absolute', right: 12, bottom: 150, alignItems: 'center', zIndex: 50 },
  action: { alignItems: 'center', marginBottom: 25 },
  label: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  bottomBlock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 15, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.3)', paddingTop: 20 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#FFF' },
  name: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginLeft: 10, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  caption: { color: '#FFF', fontSize: 14, lineHeight: 18, marginBottom: 15, paddingRight: 60, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
});
