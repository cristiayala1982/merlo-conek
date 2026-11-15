import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { tiempoRelativo } from '../../services/dateUtils';
import { crearNotificacion, enviarReporte, borrarArchivoPorUrl, borrarPostConComentarios } from '../../services/firebaseService';
import { setVideoViewerPayload } from '../../services/videoViewerState';
import SelectorCompartir from '../compartir/SelectorCompartir';
import SelectorOpcionesModal from '../reportes/SelectorOpcionesModal';
import SelectorReporteModal from '../reportes/SelectorReporteModal';
import EditarPost from './EditarPost';

const COLORS = {
  graphiteSoft: '#6B7280',
  likeBlend: '#FF6600',
};

function Post({ post, onComentar }) {
  const router = useRouter();
  const [mostrarEditar, setMostrarEditar] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [mostrarCompartir, setMostrarCompartir] = useState(false);
  const [mostrarMenuOpciones, setMostrarMenuOpciones] = useState(false);
  const [mostrarMenuReporte, setMostrarMenuReporte] = useState(false);
  const [expandido, setExpandido] = useState(false);

  // --- FUNCIÓN GLOBAL PARA RENDERIZAR MENCIONES EN NEGRITA ---
  const renderTextoConMenciones = (textoInput) => {
    if (!textoInput) return null;
    const regex = /(@\w+)/g;
    const partes = textoInput.split(regex);
    return partes.map((part, index) => {
      if (part.match(regex)) {
        return <Text key={index} style={{ fontWeight: '900', color: '#4B5563' }}>{part}</Text>; // Grafito intenso
      }
      return part;
    });
  };

  const usuario = useMemo(() => post?.userName || 'usuario', [post?.userName]);
  const texto = post?.texto || '';
  const esSubiendo = post?.status === 'uploading';
  const esLocal = post?.url?.startsWith('file://');
  const esVideo = post?.tipo === 'video' && post?.url;
  const esImagen = post?.tipo === 'foto' && post?.url;
  const thumbnailVideo = post?.thumbnailUrl || post?.thumbnailURL || null;
  const comentariosCount = Number(post?.comentariosCount) || 0;
  const postId = post?.postId || post?.id;
  const miId = auth.currentUser?.uid;
  const likesPost = Array.isArray(post?.likes) ? post.likes : [];
  const yoLikee = !!miId && likesPost.includes(miId);
  const progresoSubida = Math.max(0, Math.min(100, Number(post.uploadProgress) || 0));

  const abrirVideo = () => {
    if (!post?.url || esSubiendo) return;
    DeviceEventEmitter.emit('MEDIA_VIEWER_OPENED');
    setVideoViewerPayload({ videoUri: post.url, post: post });
    router.push({
      pathname: '/video-viewer',
      params: { t: String(Date.now()) }
    });
  };

  const abrirImagen = () => {
    if (!post?.url || esSubiendo) return;
    DeviceEventEmitter.emit('MEDIA_VIEWER_OPENED');
    setVideoViewerPayload({ videoUri: post.url, post: post });
    router.push({
      pathname: '/image-viewer',
      params: { t: String(Date.now()) }
    });
  };

  const abrirImagenRepost = (url, repostOriginal) => {
    if (!url) return;
    DeviceEventEmitter.emit('MEDIA_VIEWER_OPENED');
    setVideoViewerPayload({
      videoUri: url,
      post: {
        id: repostOriginal?.id,
        url: url,
        tipo: 'foto',
        userName: repostOriginal?.userName || 'Usuario',
        userPhotoUrl: repostOriginal?.userPhotoUrl || null,
        texto: repostOriginal?.texto || '',
        createdAt: repostOriginal?.createdAt || null
      }
    });
    router.push({
      pathname: '/image-viewer',
      params: { t: String(Date.now()) }
    });
  };

  const toggleLikePost = async () => {
    if (!postId || !miId || esSubiendo) return;
    try {
      await updateDoc(doc(db, 'posts', postId), { likes: yoLikee ? arrayRemove(miId) : arrayUnion(miId) });
      if (!yoLikee && post.userId !== miId) {
        await crearNotificacion({ paraUserId: post.userId, tipo: 'like', postId: postId, texto: 'le gusta tu publicación' });
      }
    } catch (e) { console.log(e); }
  };

  const irAlPerfil = () => {
    if (!post?.userId || esSubiendo) return;
    if (post.userId === auth.currentUser?.uid) router.push('/(tabs)/perfil');
    else router.push({ pathname: '/(tabs)/perfilAjeno', params: { userId: post.userId } });
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
          await borrarPostConComentarios(postId, 'posts');
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

  const handleReportarPost = (motivo) => {
    ejecutarReportarPost(motivo);
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

  const esMio = post?.userId && miId && post.userId === miId;
  const tieneMedia = esImagen || esVideo;

  return (
    <View style={post.esEspontanea ? styles.postOuterEspontanea : styles.postOuterCommon}>
      <View style={[styles.postContainer, post.esEspontanea && styles.postEspontaneaContainer]}>
        <View style={tieneMedia ? styles.fixedHeightContent : styles.fixedHeightContentTextOnly}>

          {/* SI ES UN REPOST (INDICADOR SUPERIOR) */}
          {post.tipo === 'repost' && (
            <View style={styles.repostTopBadge}>
              <Ionicons name="repeat" size={14} color="#FF6600" />
              <Text style={styles.repostTopBadgeTxt}>{usuario} compartió esto</Text>
            </View>
          )}

          <View style={styles.header}>
            <TouchableOpacity style={styles.headerUserInfo} onPress={irAlPerfil}>
              <Image
                source={{ uri: post?.userPhotoUrl || 'https://picsum.photos/100' }}
                style={styles.avatar}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              <View style={styles.headerTextContainer}>
                <View style={styles.nameRow}>
                  <Text style={styles.username} numberOfLines={1}>{usuario}</Text>
                  {post.esEspontanea && (
                    <View style={styles.espontaneaBadge}>
                      <Ionicons name="sparkles" size={12} color="#FF6600" />
                      <Text style={styles.espontaneaText}>ESPONTÁNEA</Text>
                    </View>
                  )}
                </View>

                {/* UBICACIÓN DEL POSTEO */}
                {(post.partido || post.localidad || post.barrio) && (
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={10} color="#6B7280" />
                    <Text style={styles.locationText}>
                      {post.localidad || post.partido || 'Zona'}
                      {post.barrio ? `, ${post.barrio}` : ''}
                    </Text>
                  </View>
                )}

                <Text style={styles.timestamp}>{esSubiendo ? 'Publicando...' : tiempoRelativo(post?.createdAt)}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.postMenuBtn} onPress={handleOpcionesPost} disabled={esSubiendo}><Ionicons name="ellipsis-vertical" size={18} color="#6B7280" /></TouchableOpacity>
          </View>

          {/* ALTURA FIJA PARA TEXTO PARA NO ROMPER EL SCROLL */}
          <TouchableOpacity
            style={tieneMedia ? styles.captionContainer : styles.captionContainerTextOnly}
            onPress={() => setExpandido(!expandido)}
            activeOpacity={0.8}
          >
            {texto ? (
              <Text
                style={styles.caption}
                numberOfLines={expandido ? undefined : (tieneMedia ? 3 : 5)}
                maxFontSizeMultiplier={1.3}
              >
                {renderTextoConMenciones(texto)}
              </Text>
            ) : <View style={{height: 10}} />}
          </TouchableOpacity>

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
                  {(post.repostOriginal.localidad || post.repostOriginal.partido || post.repostOriginal.barrio) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1, marginBottom: 1 }}>
                      <Ionicons name="location" size={10} color="#FF6600" />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#4B5563', marginLeft: 3 }} numberOfLines={1}>
                        {post.repostOriginal.localidad || post.repostOriginal.partido || 'Zona'}
                        {post.repostOriginal.barrio ? `, ${post.repostOriginal.barrio}` : ''}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.repostDateText}>{tiempoRelativo(post.repostOriginal.createdAt)}</Text>
                </View>
              </View>

              {post.repostOriginal.texto ? (
                <Text style={styles.repostCaptionText} numberOfLines={3}>{renderTextoConMenciones(post.repostOriginal.texto)}</Text>
              ) : null}

              {(post.repostOriginal.url || post.repostOriginal.thumbnailUrl) && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    abrirImagenRepost(post.repostOriginal.url || post.repostOriginal.thumbnailUrl, post.repostOriginal);
                  }}
                >
                  <Image
                    source={{ uri: post.repostOriginal.thumbnailUrl || post.repostOriginal.url }}
                    style={styles.repostImageMedia}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                </Pressable>
              )}
            </TouchableOpacity>
          )}

          {/* --- ESTADO SUBIENDO (BARRA DE PROGRESO) --- */}
          {esSubiendo && (
            <View style={styles.contenedorSubidafixed}>
              <View style={styles.infoSubidaFila}>
                <View style={styles.iconoSubidaPill}>
                  <ActivityIndicator size="small" color="#FF6600" style={{ transform: [{ scale: 0.8 }] }} />
                  <Text style={styles.textoSubiendoPill}>Publicando...</Text>
                </View>
                <Text style={styles.porcentajeTexto}>{progresoSubida}%</Text>
              </View>

              <View style={styles.miniBarraCargaBg}>
                <View style={[styles.miniBarraCargaFill, { width: `${progresoSubida}%` }]} />
              </View>
            </View>
          )}

          {esImagen && (
            <Pressable onPress={abrirImagen} style={styles.mediaContainer}>
              <Image
                source={{ uri: post.url }}
                placeholder={{ uri: post.thumbnailLqUrl || post.thumbnailUrl || post.url }}
                placeholderContentFit="cover"
                style={[styles.postImage, esSubiendo && !esLocal && { opacity: 0.6 }]}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
                priority="high"
                blurRadius={(esSubiendo && !esLocal) ? 10 : 0}
              />
              {esSubiendo && !esLocal && <ActivityIndicator style={styles.spinner} color="#FF6600" />}

              {/* TEXTO SOBRE MEDIA (Vista Previa) */}
              {post.textoSobreMedia && !esSubiendo && (
                <View style={styles.overlayTextoContainer}>
                  <Text style={styles.overlayTexto}>{post.textoSobreMedia}</Text>
                </View>
              )}
            </Pressable>
          )}

          {esVideo && (
            <Pressable style={styles.videoWrap} onPress={abrirVideo}>
              <Image
                source={{ uri: thumbnailVideo || post.url }}
                placeholder={{ uri: post.thumbnailLqUrl }}
                placeholderContentFit="cover"
                style={[styles.postImage, esSubiendo && !esLocal && { opacity: 0.6 }]}
                contentFit="cover"
                transition={400}
                cachePolicy="memory-disk"
                priority="high"
                blurRadius={(esSubiendo && !esLocal) ? 10 : 0}
              />
              {!esSubiendo || esLocal ? (
                <View style={styles.videoTapOverlay}>
                  <View style={styles.playButtonCirclePost}>
                    <Ionicons name="play" size={50} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  </View>

                  {/* TEXTO SOBRE MEDIA (Vista Previa) */}
                  {post.textoSobreMedia && (
                    <View style={styles.overlayTextoContainer}>
                      <Text style={styles.overlayTexto}>{post.textoSobreMedia}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <ActivityIndicator style={styles.spinner} color="#FF6600" />
              )}
            </Pressable>
          )}
        </View>

        {!esSubiendo && (
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
        )}
      </View>
      <View style={styles.divider} />

      {/* MODAL GLOBAL DE OPCIONES */}
      <SelectorOpcionesModal
        visible={mostrarMenuOpciones}
        onClose={() => setMostrarMenuOpciones(false)}
        titulo="Opciones de publicación"
        opciones={obtenerOpcionesMenu()}
      />

      {/* MODAL GLOBAL DE REPORTE */}
      <SelectorReporteModal
        visible={mostrarMenuReporte}
        onClose={() => setMostrarMenuReporte(false)}
        onReportar={handleReportarPost}
      />

      <EditarPost visible={mostrarEditar} post={post} onClose={() => setMostrarEditar(false)} />

      <SelectorCompartir
        visible={mostrarCompartir}
        onClose={() => setMostrarCompartir(false)}
        contenido={{
          id: postId,
          tipo: 'post',
          titulo: (post.tipo === 'repost' && post.repostOriginal) ? (texto || post.repostOriginal.texto || 'Publicación') : (texto || 'Publicación'),
          imagen: (post.tipo === 'repost' && post.repostOriginal) ? (post.repostOriginal.thumbnailUrl || post.repostOriginal.url || post.url) : (esImagen ? post.url : (thumbnailVideo || post.url)),
          subTitulo: (post.tipo === 'repost' && post.repostOriginal) ? `De ${post.repostOriginal.userName || 'Usuario'}` : `De ${usuario}`,
          postObjeto: post
        }}
      />
    </View>
  );
}

export default React.memo(Post);

const styles = StyleSheet.create({
  postOuterEspontanea: { backgroundColor: '#FFFFFF', paddingBottom: 10 },
  postOuterCommon: { backgroundColor: '#FFFFFF' },
  postContainer: { backgroundColor: '#FFF', marginBottom: 0, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 2 },
  headerUserInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 12, backgroundColor: '#DDD' },
  headerTextContainer: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  username: { fontWeight: '800', fontSize: 16, color: '#111827', flexShrink: 1 },
  espontaneaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginLeft: 8, borderWidth: 1, borderColor: '#FFEDD5' },
  espontaneaText: { color: '#FF6600', fontSize: 11, fontWeight: '900', marginLeft: 2 },
  pendienteBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginLeft: 8, borderWidth: 1, borderColor: '#FDE68A' },
  pendienteText: { color: '#D97706', fontSize: 11, fontWeight: '900', marginLeft: 2 },
  timestamp: { fontSize: 12, color: '#888', marginTop: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  locationText: { fontSize: 12, color: '#4B5563', marginLeft: 3, fontWeight: '700' },
  postMenuBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  postImage: { width: '100%', height: 400 },
  mediaContainer: { position: 'relative', width: '100%', height: 400 },
  videoWrap: { position: 'relative', width: '100%', height: 400, backgroundColor: '#111827', overflow: 'hidden' },
  videoTapOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.12)' },
  playButtonCirclePost: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  overlayTextoContainer: {
    position: 'absolute',
    bottom: 10,
    left: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  overlayTexto: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  repostTopBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 },
  repostTopBadgeTxt: { fontSize: 13, fontWeight: '700', color: '#FF6600' },
  repostNestedCard: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 12, marginTop: 8, marginBottom: 8, overflow: 'hidden' },
  repostHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  repostAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E5E7EB' },
  repostAuthorName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  repostDateText: { fontSize: 11, color: '#9CA3AF' },
  repostCaptionText: { fontSize: 14, color: '#374151', marginBottom: 8, lineHeight: 20 },
  repostImageMedia: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#E5E7EB', marginTop: 4 },
  caption: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, fontSize: 17, color: '#333' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderColor: '#F0F0F0', paddingHorizontal: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', minWidth: 0 },
  actionLabel: { marginLeft: 4, color: '#374151', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  divider: { height: 8, backgroundColor: '#E5E7EB', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#D1D5DB' },
  fixedHeightContent: { minHeight: 460, maxHeight: 1200, overflow: 'hidden' },
  fixedHeightContentTextOnly: { minHeight: 120, maxHeight: 1200, overflow: 'hidden' },
  captionContainer: {
    minHeight: 10,
    maxHeight: 600,
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 4,
  },
  captionContainerTextOnly: {
    minHeight: 40,
    maxHeight: 800,
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  contenedorSubidafixed: { height: 50, paddingHorizontal: 15, justifyContent: 'center', backgroundColor: '#FAFAFA' },
  postEspontaneaContainer: {
    borderWidth: 2,
    borderColor: '#FF914D',
    marginHorizontal: 8,
    borderRadius: 16,
    marginTop: 10,
    marginBottom: 12,
    backgroundColor: '#FFFBF5',
    overflow: 'hidden'
  },
  contenedorSubida: { paddingHorizontal: 15, paddingVertical: 12, backgroundColor: '#FAFAFA' },
  infoSubidaFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  iconoSubidaPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#FFE0CC' },
  textoSubiendoPill: { fontSize: 11, color: '#FF6600', fontWeight: '900', marginLeft: 4, textTransform: 'uppercase' },
  porcentajeTexto: { fontSize: 13, color: '#FF6600', fontWeight: '800' },
  miniBarraCargaBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  miniBarraCargaFill: { height: '100%', backgroundColor: '#FF6600', borderRadius: 3 },
  spinner: { position: 'absolute', alignSelf: 'center', top: '45%' },
});
