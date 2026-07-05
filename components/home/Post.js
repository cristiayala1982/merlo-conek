import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { setVideoViewerPayload } from '../../services/videoViewerState';

const COLORS = {
  graphiteSoft: '#6B7280',
  likeBlend: '#FF6600',
};

const tiempoRelativo = (createdAt) => {
  const fecha = createdAt?.toDate ? createdAt.toDate() : null;
  if (!fecha) return 'Publicado ahora';

  const segundos = Math.max(1, Math.floor((Date.now() - fecha.getTime()) / 1000));
  if (segundos < 60) return `Hace ${segundos}s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `Hace ${minutos}m`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `Hace ${dias}d`;
};

export default function Post({ post, onComentar }) {
  const router = useRouter();
  const [mostrarImagenFullscreen, setMostrarImagenFullscreen] = useState(false);
  const [oculto, setOculto] = useState(false);

  const usuario = useMemo(() => {
    if (post?.userName) return post.userName;
    const uid = post?.userId || 'usuario';
    return `@${String(uid).slice(0, 6)}`;
  }, [post?.userId, post?.userName]);

  const texto = post?.texto || '';
  const esSubiendo = post?.status === 'uploading';
  const progresoSubida = Math.max(0, Math.min(100, Number(post?.uploadProgress) || 0));
  const esVideo = post?.tipo === 'video' && post?.url;
  const esVideoSinUrl = post?.tipo === 'video' && !post?.url;
  const esImagen = post?.tipo === 'foto' && post?.url;
  const thumbnailVideo = post?.thumbnailUrl || post?.thumbnailURL || null;
  const comentariosCount = Number(post?.comentariosCount) || 0;
  const postId = post?.postId || post?.id;
  const miId = auth.currentUser?.uid;
  const likesPost = Array.isArray(post?.likes) ? post.likes : [];
  const likesCount = likesPost.length;
  const yoLikee = !!miId && likesPost.includes(miId);
  const abrirVideo = () => {
    if (!post?.url) return;
    setVideoViewerPayload({ videoUri: post.url });
    router.push({
      pathname: '/video-viewer',
      params: {
        t: String(Date.now()),
      },
    });
  };

  const toggleLikePost = async () => {
    if (!postId || !miId) return;

    try {
      await updateDoc(doc(db, 'posts', postId), {
        likes: yoLikee ? arrayRemove(miId) : arrayUnion(miId),
      });
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo actualizar el me gusta.');
    }
  };

  

  const handleOpcionesPost = () => {
    const miId = auth.currentUser?.uid;
    const esMio = post?.userId && miId && post.userId === miId;

    const reportarPost = async () => {
      if (!postId) return;
      try {
        await addDoc(collection(db, 'reportes'), {
          tipo: 'post',
          postId,
          postUserId: post?.userId || null,
          reporterId: miId || null,
          motivo: 'contenido-inapropiado',
          createdAt: serverTimestamp(),
        });
        Alert.alert('Gracias', 'Recibimos tu reporte.');
      } catch (e) {
        Alert.alert('Error', e?.message || 'No se pudo enviar el reporte.');
      }
    };

    const eliminarPost = async () => {
      if (!postId) return;
      try {
        await deleteDoc(doc(db, 'posts', postId));
      } catch (e) {
        Alert.alert('Error', e?.message || 'No se pudo eliminar el post.');
      }
    };

    const ocultarPost = () => {
      setOculto(true);
    };

    Alert.alert(esMio ? 'Tu post' : 'Opciones', 'Que deseas hacer?', [
      { text: 'Cancelar', style: 'cancel' },
      ...(esMio
        ? [{ text: 'Eliminar post', style: 'destructive', onPress: eliminarPost }]
        : [
            { text: 'Ocultar post', onPress: ocultarPost },
            { text: 'Reportar post', style: 'destructive', onPress: reportarPost },
          ]),
    ]);
  };

  if (oculto) {
    return null;
  }

  return (
    <View style={styles.postContainer}>
      <View style={styles.header}>
        <Image
          source={{ uri: 'https://picsum.photos/100/100' }}
          style={styles.avatar}
        />
        <View style={styles.headerTextContainer}>
          <Text style={styles.username}>{usuario}</Text>
          <Text style={styles.timestamp}>{tiempoRelativo(post?.createdAt)}</Text>
        </View>

        <TouchableOpacity style={styles.postMenuBtn} onPress={handleOpcionesPost}>
          <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.graphiteSoft} />
        </TouchableOpacity>
      </View>

      {esImagen && (
        <Pressable onPress={() => setMostrarImagenFullscreen(true)}>
          <Image
            source={{ uri: post.url }}
            style={styles.postImage}
          />
        </Pressable>
      )}

{esVideo && (
  <Pressable style={styles.videoWrap} onPress={abrirVideo}>
    <View style={styles.videoPlaceholder}>
      {thumbnailVideo ? (
        <Image source={{ uri: thumbnailVideo }} style={styles.postImage} />
      ) : (
        <View style={styles.videoNoThumbFallback} />
      )}
    </View>

    <View style={styles.videoTypeBadge} pointerEvents="none">
      <Ionicons name="videocam" size={12} color="#FFFFFF" />
      <Text style={styles.videoTypeBadgeText}>VIDEO</Text>
    </View>

    <View style={styles.videoTapOverlay} pointerEvents="none">
      <View style={styles.videoCenterPlay}>
        <Ionicons name="play-circle" size={74} color="#FFFFFF" />
        <Text style={styles.videoCenterPlayText}>TOCAR</Text>
      </View>
    </View>
  </Pressable>
)}

      {esVideoSinUrl && (
        <View style={styles.videoPendingWrap}>
          <View style={styles.videoPendingFallback} />
          <View style={styles.videoPendingBadge}>
            <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
            <Text style={styles.videoPendingText}>Subiendo video...</Text>
          </View>
        </View>
      )}

      {/* Texto del post y comentario agregado */}
      {texto ? <Text style={styles.caption}>{texto}</Text> : null}

      {esSubiendo && (
        <View style={styles.estadoSubiendoWrap}>
          <Ionicons name="sync-outline" size={14} color="#92400E" />
          <Text style={styles.estadoSubiendoTxt}>Publicando {progresoSubida}%</Text>
        </View>
      )}

      {esSubiendo && (
        <View style={styles.barraWrap}>
          <View style={styles.barraBase}>
            <View style={[styles.barraFill, { width: `${progresoSubida}%` }]} />
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={toggleLikePost}>
          <Ionicons name={yoLikee ? 'heart' : 'heart-outline'} size={22} color={yoLikee ? COLORS.likeBlend : '#555'} />
          <Text style={[styles.actionLabel, yoLikee ? styles.actionLabelActive : null]}>
            Me gusta {likesCount > 0 ? `(${likesCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onComentar?.(post)}>
          <Ionicons name="chatbubble-outline" size={22} color="#555" />
          <Text style={styles.actionLabel}>Comentar {comentariosCount > 0 ? `(${comentariosCount})` : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="share-social-outline" size={22} color="#555" />
          <Text style={styles.actionLabel}>Compartir</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.divider} />

      <Modal
        visible={mostrarImagenFullscreen}
        transparent
        animationType="fade"
        onRequestClose={() => setMostrarImagenFullscreen(false)}
      >
        <View style={styles.viewerBackdrop}>
          <Pressable style={styles.viewerCloseBtn} onPress={() => setMostrarImagenFullscreen(false)}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>

          <Image
            source={{ uri: post.url }}
            style={styles.viewerImage}
            resizeMode="contain"
          />

          {texto ? <Text style={styles.viewerCaption}>{texto}</Text> : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  postContainer: { 
    backgroundColor: '#FFF', 
    marginBottom: 0, 
    overflow: 'hidden',
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 12, 
    paddingTop: 6, // Más pegado a la parte superior
    paddingBottom: 8,
  },
  avatar: { 
    width: 34, 
    height: 34, 
    borderRadius: 17, 
    marginRight: 10,
    backgroundColor: '#DDD' 
  },
  headerTextContainer: { flex: 1 },
  username: { 
    fontWeight: 'bold', 
    fontSize: 14, 
    color: '#333'
  },
  timestamp: {
    fontSize: 11,
    color: '#888'
  },
  postMenuBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  postImage: { 
    width: '100%', 
    height: 400, 
    resizeMode: 'cover' 
  },
  videoWrap: {
    position: 'relative',
    width: '100%',
    height: 400,
    maxHeight: 400,
    backgroundColor: '#111827',
    overflow: 'hidden',
    zIndex: 0,
  },
  videoTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  videoCenterPlay: {
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: 'rgba(249,115,22,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  videoCenterPlayText: {
    marginTop: 2,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  videoTapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  videoTapBadgeText: {
    marginLeft: 4,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  videoTypeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 13,
  },
  videoTypeBadgeText: {
    marginLeft: 4,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  videoPendingWrap: {
    position: 'relative',
    width: '100%',
    height: 400,
    backgroundColor: '#111827',
  },
  videoPendingFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0F172A',
  },
  videoPendingBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  videoPendingText: {
    marginLeft: 6,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoNoThumbFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0B1220',
  },
  videoPlayerLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 7,
  },
  videoBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  videoBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  caption: { 
    paddingHorizontal: 12, 
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 15, 
    color: '#333' 
  },
  estadoSubiendoWrap: {
    marginTop: 2,
    marginHorizontal: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  estadoSubiendoTxt: {
    marginLeft: 6,
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },
  barraWrap: {
    marginHorizontal: 12,
    marginBottom: 10,
  },
  barraBase: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  barraFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#F97316',
  },
  actions: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1, 
    borderColor: '#F0F0F0' 
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  actionLabel: { marginLeft: 5, color: '#555', fontSize: 12 },
  actionLabelActive: { color: COLORS.likeBlend, fontWeight: '700' },
  divider: {
    height: 6, 
    backgroundColor: '#F8F8F8'
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 20,
  },
  viewerCloseBtn: {
    position: 'absolute',
    top: 48,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '78%',
  },
  viewerCaption: {
    width: '100%',
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 12,
    paddingHorizontal: 8,
  },
});