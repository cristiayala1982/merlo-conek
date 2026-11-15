import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { auth, db } from '../../firebaseConfig';
import { setVideoViewerPayload } from '../../services/videoViewerState';
import { crearNotificacion, enviarReporte, borrarArchivoPorUrl } from '../../services/firebaseService';
import { tiempoRelativo } from '../../services/dateUtils';
import EditarPost from '../home/EditarPost';
import SelectorCompartir from '../compartir/SelectorCompartir';
import SelectorOpcionesModal from '../reportes/SelectorOpcionesModal';
import SelectorReporteModal from '../reportes/SelectorReporteModal';

const COLORS = {
  graphiteSoft: '#6B7280',
  likeBlend: '#FF6600',
};

export default function PostPerfil({ post, onComentar }) {
  const router = useRouter();
  const [mostrarEditar, setMostrarEditar] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [mostrarCompartir, setMostrarCompartir] = useState(false);
  const [mostrarMenuOpciones, setMostrarMenuOpciones] = useState(false);
  const [mostrarMenuReporte, setMostrarMenuReporte] = useState(false);

  const usuario = useMemo(() => post?.userName || 'usuario', [post?.userName]);
  const texto = post?.texto || '';
  const esSubiendo = post?.status === 'uploading';
  const esVideo = post?.tipo === 'video' && post?.url;
  const esImagen = post?.tipo === 'foto' && post?.url;
  const thumbnailVideo = post?.thumbnailUrl || post?.thumbnailURL || null;
  const comentariosCount = Number(post?.comentariosCount) || 0;
  const postId = post?.postId || post?.id;
  const miId = auth.currentUser?.uid;
  const esMio = post?.userId && miId && post.userId === miId;
  const likesPost = Array.isArray(post?.likes) ? post.likes : [];
  const yoLikee = !!miId && likesPost.includes(miId);

  const abrirVideo = () => {
    if (!post?.url) return;
    setVideoViewerPayload({ videoUri: post.url, post: post });
    router.push({
      pathname: '/video-viewer-perfil',
      params: { originUserId: post.userId }
    });
  };

  const abrirImagen = () => {
    if (!post?.url) return;
    setVideoViewerPayload({ videoUri: post.url, post: post });
    router.push({
      pathname: '/image-viewer-perfil',
      params: { originUserId: post.userId }
    });
  };

  const toggleLikePost = async () => {
    if (!postId || !miId) return;
    try {
      await updateDoc(doc(db, 'posts', postId), { likes: yoLikee ? arrayRemove(miId) : arrayUnion(miId) });
      if (!yoLikee) await crearNotificacion({ paraUserId: post.userId, tipo: 'like', postId: postId, texto: 'le gusta tu publicación' });
    } catch (e) { Alert.alert('Error', 'No se pudo dar like.'); }
  };

  const handleOpcionesPost = () => {
    if (esSubiendo) return;
    setMostrarMenuOpciones(true);
  };

  const confirmarEliminar = async () => {
    setMostrarMenuOpciones(false);
    Alert.alert('Eliminar', '¿Estás seguro?', [
      { text: 'No' },
      { text: 'Sí, eliminar', style: 'destructive', onPress: async () => {
        if (!postId) return;
        try {
          if (post?.url) await borrarArchivoPorUrl(post.url);
          if (post?.thumbnailUrl) await borrarArchivoPorUrl(post.thumbnailUrl);
          if (post?.thumbnailLqUrl) await borrarArchivoPorUrl(post.thumbnailLqUrl);
          await deleteDoc(doc(db, 'posts', postId));
        }
        catch (e) { Alert.alert('Error', 'No se pudo eliminar.'); }
      }}
    ]);
  };

  const ejecutarReportarPost = async (motivo) => {
    setMostrarMenuReporte(false);
    try {
      await enviarReporte({
        tipo: 'post',
        idContenido: postId,
        idAutor: post.userId,
        motivo: motivo,
        extraData: {
          texto: texto || '',
          url: post.url || post.thumbnailUrl || null,
          userName: usuario
        }
      });
      Alert.alert("Gracias", "Tu reporte ha sido enviado a los administradores para su revisión.");
    } catch (e) {
      Alert.alert("Error", "No se pudo enviar el reporte.");
    }
  };

  const obtenerOpcionesMenu = () => {
    if (esMio) {
      const esEspontanea = post?.esEspontanea || post?.tipo === 'desafio' || post?.tipo === 'espontanea';
      const opciones = [];

      if (!esEspontanea) {
        opciones.push({
          label: 'Editar publicación',
          icon: 'create-outline',
          color: '#374151',
          onPress: () => setMostrarEditar(true)
        });
      }

      opciones.push({
        label: 'Eliminar publicación',
        icon: 'trash-outline',
        color: '#EF4444',
        onPress: confirmarEliminar
      });

      return opciones;
    } else {
      return [
        {
          label: 'Ocultar esta publicación',
          icon: 'eye-off-outline',
          color: '#374151',
          onPress: () => setOculto(true)
        },
        {
          label: 'Reportar contenido',
          icon: 'flag-outline',
          color: '#EF4444',
          onPress: () => setMostrarMenuReporte(true)
        }
      ];
    }
  };

  if (oculto) return null;

  return (
    <View style={[styles.postContainer, post.esEspontanea && styles.postEspontaneaContainer]}>
      {/* SI ES UN REPOST (INDICADOR SUPERIOR) */}
      {post.tipo === 'repost' && (
        <View style={styles.repostTopBadge}>
          <Ionicons name="repeat" size={14} color="#FF6600" />
          <Text style={styles.repostTopBadgeTxt}>{usuario} compartió esto</Text>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.headerUserInfo}>
          <Image
            source={{ uri: post?.userPhotoUrl || 'https://picsum.photos/100' }}
            style={styles.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <View style={styles.headerTextContainer}><Text style={styles.username}>{usuario}</Text><Text style={styles.timestamp}>{tiempoRelativo(post?.createdAt)}</Text></View>
        </View>
        <TouchableOpacity style={styles.postMenuBtn} onPress={handleOpcionesPost} disabled={esSubiendo}><Ionicons name="ellipsis-horizontal" size={18} color="#6B7280" /></TouchableOpacity>
      </View>
      {texto ? <Text style={styles.caption}>{texto}</Text> : null}
      {esImagen && (
        <Pressable onPress={abrirImagen} style={styles.mediaContainer}>
          <Image
            source={{ uri: post.url }}
            placeholder={{ uri: post.thumbnailLqUrl || post.thumbnailUrl || post.url }}
            placeholderContentFit="cover"
            style={styles.postImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        </Pressable>
      )}
      {esVideo && (
        <Pressable style={styles.videoWrap} onPress={abrirVideo}>
          {thumbnailVideo ? (
            <Image
                source={{ uri: thumbnailVideo }}
                style={styles.postImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.videoNoThumbFallback} />
          )}
          <View style={styles.videoTapOverlay}>
            <View style={styles.playButtonCirclePost}>
              <Ionicons name="play" size={50} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </View>
          </View>
        </Pressable>
      )}

      {/* SI ES UN REPOST (TARJETA ANIDADA PROFESIONAL) */}
      {post.tipo === 'repost' && post.repostOriginal && (
        <TouchableOpacity
          style={styles.repostNestedCard}
          onPress={() => {
            if (post.repostOriginal.id) {
              router.push({
                pathname: '/postDetalle',
                params: {
                  postId: post.repostOriginal.id,
                  collectionName: post.repostOriginal.collectionName || 'posts'
                }
              });
            }
          }}
          activeOpacity={0.9}
        >
          <View style={styles.repostHeaderRow}>
            <Image
              source={{ uri: post.repostOriginal.userPhotoUrl || 'https://picsum.photos/100' }}
              style={styles.repostAvatar}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.repostAuthorName} numberOfLines={1}>{post.repostOriginal.userName || 'Usuario'}</Text>
              <Text style={styles.repostDateText}>{tiempoRelativo(post.repostOriginal.createdAt)}</Text>
            </View>
          </View>

          {post.repostOriginal.texto ? (
            <Text style={styles.repostCaptionText} numberOfLines={3}>{post.repostOriginal.texto}</Text>
          ) : null}

          {(post.repostOriginal.url || post.repostOriginal.thumbnailUrl) && (
            <Image
              source={{ uri: post.repostOriginal.thumbnailUrl || post.repostOriginal.url }}
              style={styles.repostImageMedia}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          )}
        </TouchableOpacity>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={toggleLikePost}>
          <Ionicons name={yoLikee ? 'heart' : 'heart-outline'} size={25} color={yoLikee ? '#FF6600' : '#374151'} />
          {likesPost.length > 0 ? (
            <Text style={[styles.actionLabel, yoLikee && { color: '#FF6600', fontWeight: '700' }]} maxFontSizeMultiplier={1.25} numberOfLines={1}>
              {likesPost.length}
            </Text>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onComentar?.(post)}>
          <Ionicons name="chatbubble-outline" size={25} color="#374151" />
          {comentariosCount > 0 ? (
            <Text style={styles.actionLabel} maxFontSizeMultiplier={1.25} numberOfLines={1}>
              {comentariosCount}
            </Text>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setMostrarCompartir(true)}>
          <Ionicons name="share-social-outline" size={25} color="#374151" />
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />
      <EditarPost visible={mostrarEditar} post={post} onClose={() => setMostrarEditar(false)} />

      <SelectorCompartir
        visible={mostrarCompartir}
        onClose={() => setMostrarCompartir(false)}
        contenido={{
          id: postId,
          tipo: 'post',
          titulo: texto || 'Publicación',
          imagen: esImagen ? post.url : (thumbnailVideo || post.url),
          subTitulo: `De ${usuario}`,
          postObjeto: post
        }}
      />

      <SelectorOpcionesModal
        visible={mostrarMenuOpciones}
        onClose={() => setMostrarMenuOpciones(false)}
        titulo={esMio ? "Mis opciones" : "Opciones de publicación"}
        opciones={obtenerOpcionesMenu()}
      />

      <SelectorReporteModal
        visible={mostrarMenuReporte}
        onClose={() => setMostrarMenuReporte(false)}
        onReportar={ejecutarReportarPost}
        onSelectMotivo={ejecutarReportarPost}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  postContainer: { backgroundColor: '#FFF', marginBottom: 0, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 },
  headerUserInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17, marginRight: 10, backgroundColor: '#DDD' },
  headerTextContainer: { flex: 1 },
  username: { fontWeight: 'bold', fontSize: 16, color: '#333' },
  timestamp: { fontSize: 13, color: '#888' },
  postMenuBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  postImage: { width: '100%', height: 400, resizeMode: 'cover' },
  mediaContainer: { position: 'relative', width: '100%', height: 400 },
  videoWrap: { position: 'relative', width: '100%', height: 400, backgroundColor: '#111827', overflow: 'hidden' },
  videoTapOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.12)' },
  playButtonCirclePost: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  videoNoThumbFallback: { width: '100%', height: '100%', backgroundColor: '#0B1220' },
  caption: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, fontSize: 17, color: '#333' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderColor: '#F0F0F0', paddingHorizontal: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', minWidth: 0 },
  actionLabel: { marginLeft: 4, color: '#374151', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  divider: { height: 6, backgroundColor: '#F8F8F8' },
  postEspontaneaContainer: { borderWidth: 2, borderColor: '#FF914D', marginHorizontal: 8, borderRadius: 16, marginTop: 10, backgroundColor: '#FFFBF5' },
  repostTopBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 12, paddingTop: 6 },
  repostTopBadgeTxt: { fontSize: 13, fontWeight: '700', color: '#FF6600' },
  repostNestedCard: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 12, marginHorizontal: 12, marginTop: 8, marginBottom: 8, overflow: 'hidden' },
  repostHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  repostAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E5E7EB' },
  repostAuthorName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  repostDateText: { fontSize: 11, color: '#9CA3AF' },
  repostCaptionText: { fontSize: 14, color: '#374151', marginBottom: 8, lineHeight: 20 },
  repostImageMedia: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#E5E7EB', marginTop: 4 }
});
