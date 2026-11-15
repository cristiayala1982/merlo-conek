import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { tiempoRelativo } from '../../services/dateUtils';
import { crearNotificacion, enviarReporte, borrarArchivoPorUrl, borrarPostConComentarios } from '../../services/firebaseService';
import { setVideoViewerPayload } from '../../services/videoViewerState';
import SelectorCompartir from '../compartir/SelectorCompartir';
import SelectorOpcionesModal from '../reportes/SelectorOpcionesModal';
import SelectorReporteModal from '../reportes/SelectorReporteModal';
import EditarAlerta from './EditarAlerta';

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

function CardAlerta({ item, onComentarOverride = null }) {
  const router = useRouter();
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [expandido, setExpandido] = useState(false);

  const handleComentar = () => {
    if (onComentarOverride) onComentarOverride();
    else setMostrarComentarios(true);
  };
  const [mostrarEditar, setMostrarEditar] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [mostrarCompartir, setMostrarCompartir] = useState(false);

  const [mostrarMenuOpciones, setMostrarMenuOpciones] = useState(false);
  const [mostrarMenuReporte, setMostrarMenuReporte] = useState(false);

  const miId = auth.currentUser?.uid;
  const esLocal = item.url?.startsWith('file://');
  const esUrgente = item.tipo === 'Alerta';
  const esMio = item.userId === miId;
  const esVideo = item.tipo === 'video' || item.url?.includes('.mp4');
  const esSubiendo = item.status === 'uploading';
  const progresoSubida = Math.max(0, Math.min(100, Number(item.uploadProgress) || 0));
  const comentariosCount = Number(item.comentariosCount) || 0;

  const likes = Array.isArray(item.likes) ? item.likes : [];
  const yoLikee = miId && likes.includes(miId);

  const abrirImagen = () => {
    if (!item.url || esSubiendo) return;

    setVideoViewerPayload({
      videoUri: item.url,
      post: { ...item, collectionName: 'alertas_comunitarias' }
    });
    router.push({
      pathname: esVideo ? '/(viewers)/video-viewer' : '/(viewers)/image-viewer',
      params: { t: String(Date.now()) },
    });
  };

  const abrirImagenRepost = (url, repostOriginal) => {
    if (!url) return;
    setVideoViewerPayload({
      videoUri: url,
      post: {
        id: repostOriginal?.id,
        url: url,
        tipo: 'foto',
        userName: repostOriginal?.userName || 'Usuario',
        userPhotoUrl: repostOriginal?.userPhotoUrl || null,
        texto: repostOriginal?.texto || '',
        createdAt: repostOriginal?.createdAt || null,
        collectionName: repostOriginal?.collectionName || 'alertas_comunitarias'
      }
    });
    router.push({
      pathname: '/(viewers)/image-viewer',
      params: { t: String(Date.now()) },
    });
  };

  const toggleLike = async () => {
    if (!miId || esSubiendo) return;
    try {
      const docRef = doc(db, 'alertas_comunitarias', item.id);
      await updateDoc(docRef, {
        likes: yoLikee ? arrayRemove(miId) : arrayUnion(miId)
      });
      if (!yoLikee && !esMio) {
        await crearNotificacion({
          paraUserId: item.userId,
          tipo: 'like',
          postId: item.id,
          collectionName: 'alertas_comunitarias', // ESPECIFICAMOS LA COLECCIÓN
          texto: 'le gusta tu aviso comunitario'
        });
      }
    } catch (e) { console.log(e); }
  };

  const irAlPerfil = () => {
    if (!item?.userId) return;
    if (item.userId === auth.currentUser?.uid) {
      router.push('/(tabs)/perfil');
    } else {
      router.push({
        pathname: '/(tabs)/perfilAjeno',
        params: { userId: item.userId }
      });
    }
  };

  const handleOpciones = () => {
    if (esSubiendo) return;
    setMostrarMenuOpciones(true);
  };

  const confirmarEliminar = async () => {
    setMostrarMenuOpciones(false);
    Alert.alert("Eliminar", "¿Estás seguro de borrar este aviso?", [
      { text: "No", style: "cancel" },
      { text: "Sí, Borrar", style: "destructive", onPress: async () => {
        try {
          if (item?.url) await borrarArchivoPorUrl(item.url);
          if (item?.thumbnailUrl) await borrarArchivoPorUrl(item.thumbnailUrl);
          if (item?.thumbnailLqUrl) await borrarArchivoPorUrl(item.thumbnailLqUrl);
          await borrarPostConComentarios(item.id, 'alertas_comunitarias');
        } catch (e) {
          Alert.alert("Error", "No se pudo eliminar el aviso.");
        }
      }}
    ]);
  };

  const ejecutarReportar = async (motivo) => {
    setMostrarMenuReporte(false);
    try {
      await enviarReporte({
        tipo: 'alerta_comunitaria',
        idContenido: item.id,
        idAutor: item.userId,
        motivo,
        textoOpcional: item.texto,
        extraData: {
          tipo: item.tipo,
          barrio: item.barrio,
          texto: item.texto,
          url: item.url,
          userName: item.userName
        }
      });
      Alert.alert("Gracias", "Tu reporte ha sido enviado para revisión.");
    } catch (e) {
      Alert.alert("Error", "No se pudo enviar el reporte.");
    }
  };

  const obtenerOpcionesMenu = () => {
    if (esMio) {
      return [
        {
          label: 'Editar aviso',
          icon: 'create-outline',
          color: '#374151',
          onPress: () => setMostrarEditar(true)
        },
        {
          label: 'Eliminar aviso',
          icon: 'trash-outline',
          color: '#EF4444',
          onPress: confirmarEliminar
        }
      ];
    } else {
      return [
        {
          label: 'Ocultar aviso',
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

  const tieneMedia = !!item.url;

  return (
    <View style={[styles.card, esUrgente ? styles.cardAlerta : styles.cardGeneral]}>
      <View style={tieneMedia ? styles.fixedHeightContent : styles.fixedHeightContentTextOnly}>

        {/* SI ES UN REPOST (INDICADOR SUPERIOR) */}
        {item.tipo === 'repost' && (
          <View style={styles.repostTopBadge}>
            <Ionicons name="repeat" size={14} color="#FF6600" />
            <Text style={styles.repostTopBadgeTxt}>{item.userName} compartió esto</Text>
          </View>
        )}

        {/* HEADER (Con padding) */}
        <View style={styles.headerPadding}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerUserInfo} onPress={irAlPerfil}>
              <Image source={{ uri: item.userPhoto || item.userPhotoUrl || auth.currentUser?.photoURL || 'https://picsum.photos/100' }} style={styles.avatar} />
              <View style={styles.headerText}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName}>{item.userName}</Text>
                  <Text style={styles.fecha}>{esSubiendo ? 'Publicando...' : (item.createdAt?.toDate ? tiempoRelativo(item.createdAt) : 'Ahora')}</Text>
                </View>
                <View style={styles.badgeRow}>
                  <Ionicons name={esUrgente ? "warning" : "business"} size={14} color={esUrgente ? "#EF4444" : "#3B82F6"} />
                  <Text style={[styles.tipoLabel, { color: esUrgente ? "#EF4444" : "#3B82F6" }]}>{item.tipo?.toUpperCase()}</Text>
                  <View style={styles.dot} />
                  <Ionicons name="location" size={12} color="#6B7280" />
                  <Text style={styles.barrioTxt} numberOfLines={1}>
                    {item.localidad || item.partido || 'Zona'}
                    {item.barrio ? `, ${item.barrio}` : ''}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleOpciones} style={styles.moreBtn}>
              <Ionicons name="ellipsis-vertical" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* TEXTO CON ALTURA FIJA PARA PRECISIÓN */}
          <TouchableOpacity
            style={tieneMedia ? styles.captionContainer : styles.captionContainerTextOnly}
            onPress={() => setExpandido(!expandido)}
            activeOpacity={0.8}
          >
            <Text style={styles.texto} numberOfLines={expandido ? undefined : (tieneMedia ? 3 : 5)} maxFontSizeMultiplier={1.3}>{renderTextoConMenciones(item.texto)}</Text>
          </TouchableOpacity>

          {/* SI ES UN REPOST (TARJETA ANIDADA PROFESIONAL) */}
          {item.tipo === 'repost' && item.repostOriginal && (
            <TouchableOpacity
              style={styles.repostNestedCard}
              onPress={() => {
                if (item.repostOriginal.id) {
                  router.push({
                    pathname: '/postDetalle',
                    params: {
                      postId: item.repostOriginal.id,
                      collectionName: item.repostOriginal.collectionName || 'alertas_comunitarias'
                    }
                  });
                }
              }}
              activeOpacity={0.9}
            >
              <View style={styles.repostHeaderRow}>
                <Image
                  source={{ uri: item.repostOriginal.userPhotoUrl || 'https://picsum.photos/100' }}
                  style={styles.repostAvatar}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.repostAuthorName} numberOfLines={1}>{item.repostOriginal.userName || 'Usuario'}</Text>
                  {(item.repostOriginal.localidad || item.repostOriginal.partido || item.repostOriginal.barrio) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1, marginBottom: 1 }}>
                      <Ionicons name="location" size={10} color="#FF6600" />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#4B5563', marginLeft: 3 }} numberOfLines={1}>
                        {item.repostOriginal.localidad || item.repostOriginal.partido || 'Zona'}
                        {item.repostOriginal.barrio ? `, ${item.repostOriginal.barrio}` : ''}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.repostDateText}>{tiempoRelativo(item.repostOriginal.createdAt)}</Text>
                </View>
              </View>

              {item.repostOriginal.texto ? (
                <Text style={styles.repostCaptionText} numberOfLines={3}>{renderTextoConMenciones(item.repostOriginal.texto)}</Text>
              ) : null}

              {(item.repostOriginal.url || item.repostOriginal.thumbnailUrl) && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    abrirImagenRepost(item.repostOriginal.url || item.repostOriginal.thumbnailUrl, item.repostOriginal);
                  }}
                >
                  <Image
                    source={{ uri: item.repostOriginal.thumbnailUrl || item.repostOriginal.url }}
                    style={styles.repostImageMedia}
                  />
                </Pressable>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* --- ESTADO SUBIENDO --- */}
        {esSubiendo && (
          <View style={styles.contenedorSubidaFixed}>
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

        {/* IMAGEN O VIDEO (FULL WIDTH) */}
        {item.url && (
          <Pressable onPress={abrirImagen} style={styles.fullWidthMedia}>
            <Image
              source={{ uri: item.thumbnailUrl || item.url }}
              placeholder={{ uri: item.thumbnailLqUrl }}
              placeholderContentFit="cover"
              style={[styles.imagen, esSubiendo && !esLocal && { opacity: 0.5 }]}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              blurRadius={(esSubiendo && !esLocal) ? 10 : 0}
            />

            {esVideo && (!esSubiendo || esLocal) && (
              <View style={styles.videoOverlay}>
                <View style={styles.playButtonCircle}>
                  <Ionicons name="play" size={50} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </View>
              </View>
            )}

            {esSubiendo && !esLocal && <ActivityIndicator style={styles.spinner} color="#FF6600" />}

            {/* TEXTO SOBRE MEDIA (Si existe) */}
            {item.textoSobreMedia && (!esSubiendo || esLocal) && (
              <View style={styles.overlayTextoContainer}>
                <Text style={styles.overlayTexto}>{item.textoSobreMedia}</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>

      {/* ACCIONES (Con padding) */}
      {!esSubiendo && (
        <View style={styles.actionsPadding}>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
              <Ionicons name={yoLikee ? "heart" : "heart-outline"} size={25} color={yoLikee ? "#FF6600" : "#374151"} />
              {likes.length > 0 ? (
                <Text
                  style={[styles.actionLabel, yoLikee && {color: "#FF6600", fontWeight: '700'}]}
                  maxFontSizeMultiplier={1.25}
                  numberOfLines={1}
                >
                  {likes.length}
                </Text>
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleComentar}>
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

          <EditarAlerta
            visible={mostrarEditar}
            post={item}
            onClose={() => setMostrarEditar(false)}
          />

          <SelectorCompartir
            visible={mostrarCompartir}
            onClose={() => setMostrarCompartir(false)}
            contenido={{
              id: item.id,
              tipo: 'alerta',
              titulo: (item.tipo === 'repost' && item.repostOriginal) ? (item.texto || item.repostOriginal.texto || `${item.tipo} en ${item.barrio}`) : (item.texto || `${item.tipo} en ${item.barrio}`),
              imagen: (item.tipo === 'repost' && item.repostOriginal) ? (item.repostOriginal.thumbnailUrl || item.repostOriginal.url || item.url) : (item.url || null),
              subTitulo: (item.tipo === 'repost' && item.repostOriginal) ? `De ${item.repostOriginal.userName || 'Usuario'}` : `${item.tipo} - ${item.barrio}`,
              postObjeto: item
            }}
          />

          {/* MODAL GLOBAL DE OPCIONES */}
          <SelectorOpcionesModal
            visible={mostrarMenuOpciones}
            onClose={() => setMostrarMenuOpciones(false)}
            titulo="Opciones del aviso"
            opciones={obtenerOpcionesMenu()}
          />

          {/* MODAL GLOBAL DE REPORTE */}
          <SelectorReporteModal
            visible={mostrarMenuReporte}
            onClose={() => setMostrarMenuReporte(false)}
            onReportar={ejecutarReportar}
          />
        </View>
      )}
    </View>
  );
}

export default React.memo(CardAlerta);

const styles = StyleSheet.create({
  card: { marginHorizontal: 10, marginTop: 8, borderRadius: 16, overflow: 'hidden', borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  cardAlerta: { backgroundColor: '#FFFBFA', borderColor: '#FECACA' },
  cardGeneral: { backgroundColor: '#F8FBFF', borderColor: '#DBEAFE' },
  headerPadding: { padding: 12, paddingBottom: 0 },
  actionsPadding: { paddingHorizontal: 12, paddingBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  headerUserInfo: { flexDirection: 'row', flex: 1, alignItems: 'flex-start' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EEE' },
  headerText: { flex: 1, marginLeft: 10, marginTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userName: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  fecha: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  tipoLabel: { fontSize: 10, fontWeight: '900', marginLeft: 4, letterSpacing: 0.5 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#9CA3AF', marginHorizontal: 6 },
  barrioTxt: { fontSize: 12, color: '#4B5563', fontWeight: '800', marginLeft: 2, flexShrink: 1 },
  moreBtn: { padding: 5, marginRight: -5, marginTop: -5 },
  texto: { fontSize: 16, color: '#1F2937', lineHeight: 22 },
  fixedHeightContent: { minHeight: 460, maxHeight: 1200, overflow: 'hidden' },
  fixedHeightContentTextOnly: { minHeight: 120, maxHeight: 1200, overflow: 'hidden' },
  captionContainer: {
    minHeight: 10,
    maxHeight: 600,
    justifyContent: 'flex-start',
    paddingTop: 4, // Añadido espacio arriba para igualar al Muro Social
    paddingBottom: 8, // Añadido espacio abajo para que respire
  },
  captionContainerTextOnly: {
    minHeight: 40,
    maxHeight: 800,
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 8,
  },
  contenedorSubidaFixed: { height: 50, paddingHorizontal: 15, justifyContent: 'center' },
  fullWidthMedia: { width: '100%', height: 420, backgroundColor: '#000' },
  imagen: { width: '100%', height: '100%' },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 10, marginTop: 5, justifyContent: 'space-between' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', minWidth: 0 },
  actionLabel: { marginLeft: 4, fontSize: 12, color: '#374151', fontWeight: '700', flexShrink: 1 },
  contenedorSubida: { paddingHorizontal: 15, paddingVertical: 12, backgroundColor: '#FAFAFA' },
  infoSubidaFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  repostTopBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 15, paddingTop: 10 },
  repostTopBadgeTxt: { fontSize: 13, fontWeight: '700', color: '#FF6600' },
  repostNestedCard: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 12, marginHorizontal: 15, marginTop: 8, marginBottom: 8, overflow: 'hidden' },
  repostHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  repostAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E5E7EB' },
  repostAuthorName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  repostDateText: { fontSize: 11, color: '#9CA3AF' },
  repostCaptionText: { fontSize: 14, color: '#374151', marginBottom: 8, lineHeight: 20 },
  repostImageMedia: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#E5E7EB', marginTop: 4 },
  iconoSubidaPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#FFE0CC' },
  textoSubiendoPill: { fontSize: 11, color: '#FF6600', fontWeight: '900', marginLeft: 4, textTransform: 'uppercase' },
  porcentajeTexto: { fontSize: 13, color: '#FF6600', fontWeight: '800' },
  miniBarraCargaBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  miniBarraCargaFill: { height: '100%', backgroundColor: '#FF6600', borderRadius: 3 },
  spinner: { position: 'absolute', alignSelf: 'center', top: '45%' },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  playButtonCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  // Estilos Texto sobre Media
  overlayTextoContainer: {
    position: 'absolute',
    bottom: 10,
    left: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  overlayTexto: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center'
  },
});
