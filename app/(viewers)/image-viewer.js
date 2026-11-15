import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ImageViewerScreen() {
  const { t } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [descargando, setDescargando] = useState(false);
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [verMas, setVerMas] = useState(false);

  const payload = getVideoViewerPayload() || {};
  const initialPost = payload.post || {};
  const imageUri = payload.videoUri || '';
  const isProfileView = payload.isProfileView || false;
  const targetId = isProfileView ? null : (initialPost?.id || initialPost?.postId);
  const collectionName = initialPost?.collectionName || 'posts';

  // PRIORIDAD INMEDIATA: Usamos los datos del payload para carga instantánea
  const [post, setPost] = useState({
    ...initialPost,
    userName: initialPost.userName || initialPost.user || 'Usuario',
    userPhotoUrl: initialPost.userPhotoUrl || initialPost.userPhoto || 'https://picsum.photos/100',
    texto: initialPost.texto || initialPost.text || ''
  });

  useEffect(() => {
    return () => {
      clearVideoViewerPayload();
    };
  }, []);

  useEffect(() => {
    if (!targetId || !collectionName) {
      setPost(initialPost);
      return;
    }

    try {
      const unsub = onSnapshot(doc(db, collectionName, targetId), (snap) => {
        if (snap.exists()) {
          setPost({ id: snap.id, ...snap.data(), collectionName });
        } else {
          setPost({ ...initialPost, collectionName });
        }
      });
      return () => unsub();
    } catch (e) {
      console.log("Error viewer snapshot:", e);
      setPost(initialPost);
    }
  }, [targetId, collectionName]);

  const toggleLike = async () => {
    if (!targetId || !post) return;
    const miId = auth.currentUser?.uid;
    const yoLikee = post.likes?.includes(miId);
    try {
      await updateDoc(doc(db, collectionName, targetId), {
        likes: yoLikee ? arrayRemove(miId) : arrayUnion(miId),
      });
      if (!yoLikee) {
        await crearNotificacion({
          paraUserId: post.userId,
          tipo: 'like',
          postId: targetId,
          collectionName: collectionName,
          texto: collectionName === 'posts' ? 'le gusta tu foto' : 'le gusta tu aviso comunitario'
        });
      }
    } catch (e) { Alert.alert('Error', 'No se pudo procesar.'); }
  };

  const irAlPerfil = () => {
    if (isProfileView) {
      cerrarViewer();
      return;
    }
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
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={200}
        />
        {post?.textoSobreMedia ? (
          <View style={styles.floatingTextWrap}>
            <Text style={styles.floatingTextContenido}>{post.textoSobreMedia}</Text>
          </View>
        ) : null}
      </Pressable>

      <TouchableOpacity style={[styles.backBtn, { top: Math.max(40, insets.top + 10) }]} onPress={cerrarViewer}>
        <Ionicons name="arrow-back" size={30} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.rightBar}>
        {!isProfileView && (
          <>
            <TouchableOpacity style={styles.action} onPress={toggleLike}>
              <Ionicons
                name={post?.likes?.includes(auth.currentUser?.uid) ? "heart" : "heart-outline"}
                size={36}
                color={post?.likes?.includes(auth.currentUser?.uid) ? "#FF6600" : "#FFF"}
              />
              <Text style={styles.label} maxFontSizeMultiplier={1.25} numberOfLines={1}>{post?.likes?.length || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => setMostrarComentarios(true)}>
              <Ionicons name="chatbubble-outline" size={32} color="#FFF" />
              <Text style={styles.label} maxFontSizeMultiplier={1.25} numberOfLines={1}>{post?.comentariosCount || 0}</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.action}>
          <Ionicons name="share-social-outline" size={32} color="#FFF" />
          <Text style={styles.label} maxFontSizeMultiplier={1.25} numberOfLines={1}>Compartir</Text>
        </TouchableOpacity>
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
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <Text style={styles.name}>{post?.userName || 'Usuario'}</Text>
        </TouchableOpacity>

        {(post?.texto || post?.text) ? (
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
        ) : null}
      </View>

      <ComentariosModal
        visible={mostrarComentarios}
        onClose={() => setMostrarComentarios(false)}
        post={post}
        collectionName={collectionName}
      />
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
  name: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginLeft: 10, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  caption: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, marginBottom: 15, paddingRight: 60, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  verMasBtn: {
    color: '#CCC',
    fontWeight: 'bold',
    fontSize: 13
  },
  floatingTextWrap: {
    position: 'absolute',
    bottom: 195, // Bajado a 195 para afinar la posición
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
});
