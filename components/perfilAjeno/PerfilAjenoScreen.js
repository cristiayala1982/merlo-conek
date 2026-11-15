import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View, Alert, Share, Modal, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';
import { dejarDeSeguirUsuario, obtenerPerfilUsuario, enviarSolicitudAmistad, escucharPostsUsuario, escucharHistoriasUsuario, escucharEstadoAmistad, aceptarSolicitudAmistad, bloquearUsuario, reportarPerfil, obtenerHistoriasGrupales, enviarReporte } from '../../services/firebaseService';
import { setStoriesCache } from '../../services/storiesState';
import { setVideoViewerPayload } from '../../services/videoViewerState';
import ComentariosModal from '../home/ComentariosModal';
import PostPerfil from '../perfil/PostPerfil';
import SelectorCompartir from '../compartir/SelectorCompartir';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - 40) / 3;

export default function PerfilAjenoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, openEspontaneas } = useLocalSearchParams();

  const [perfil, setPerfil] = useState(null);
  const [miPerfil, setMiPerfil] = useState(null); // Mi info para chequear bloqueos
  const [relacion, setRelacion] = useState(null);
  const [posts, setPosts] = useState([]);
  const [historias, setHistorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [postSeleccionado, setPostSeleccionado] = useState(null);
  const [modalEspontaneasVisible, setModalEspontaneasVisible] = useState(false);
  const [mostrarMenuOpciones, setMostrarMenuOpciones] = useState(false);
  const [mostrarCompartir, setMostrarCompartir] = useState(false);

  useEffect(() => {
    if (openEspontaneas === 'true') {
      setModalEspontaneasVisible(true);
    }
  }, [openEspontaneas]);

  const miUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId || !miUid) return;

    // Escuchar mi perfil para ver bloqueos en tiempo real
    const unsubMe = obtenerPerfilUsuario(miUid, setMiPerfil);

    const unsubPerfil = obtenerPerfilUsuario(userId, setPerfil);
    const unsubRel = escucharEstadoAmistad(userId, setRelacion);
    const unsubPosts = escucharPostsUsuario(userId, (lista) => { setPosts(lista); setCargando(false); });
    const unsubStories = escucharHistoriasUsuario(userId, (lista) => { setHistorias(lista); });

    return () => { unsubMe(); unsubPerfil(); unsubRel(); unsubPosts(); unsubStories(); };
  }, [userId, miUid]);

  // Chequeo de bloqueo
  const loTengoBloqueado = miPerfil?.bloqueados?.includes(userId);
  const meTieneBloqueado = perfil?.bloqueados?.includes(miUid);
  const bloqueoActivo = loTengoBloqueado || meTieneBloqueado;

  const handleVerHistorias = async () => {
    if (!userId || historias.length === 0 || bloqueoActivo) return;
    const dataCompleta = await obtenerHistoriasGrupales([userId], miUid);
    dataCompleta[0].stories = dataCompleta[0].stories.filter(s => !s.esEspontanea);
    if (dataCompleta[0].stories.length === 0) return;
    setStoriesCache(dataCompleta);
    router.push({ pathname: '/historias-viewer-perfil', params: { userId: userId } });
  };

  const abrirEspontaneaIndividual = (item) => {
    setVideoViewerPayload({ videoUri: item.url, post: { ...item, id: item.id || item.postId, userName: item.userName || perfil?.nombre, userPhotoUrl: item.userPhotoUrl || perfil?.fotoUrl } });
    const esVideo = item.tipo?.includes('video') || item.type?.includes('video') || !!item.thumbnailUrl || (item.url && String(item.url).toLowerCase().includes('.mp4'));
    router.push({
      pathname: esVideo ? '/video-viewer-perfil' : '/image-viewer-perfil',
      params: { t: String(Date.now()), originUserId: userId, fromEspontaneas: 'true' }
    });
  };

  const abrirImagen = (url) => {
    if (!url) return;
    setVideoViewerPayload({ videoUri: url, isProfileView: true, post: { userName: perfil?.nombre || 'Usuario', userPhotoUrl: perfil?.fotoUrl || '', texto: 'Foto de perfil / portada', userId: userId } });
    router.push({ pathname: '/image-viewer-perfil', params: { originUserId: userId } });
  };

  const handleAccionAmigo = async () => {
    try {
      if (!relacion) await enviarSolicitudAmistad(userId);
      else if (relacion.status === 'aceptada') await dejarDeSeguirUsuario(userId);
      else if (relacion.status === 'pendiente' && relacion.deUid !== miUid) await aceptarSolicitudAmistad(null, userId);
    } catch (e) { console.log(e); }
  };

  const renderHeader = () => {
    let btnText = "Agregar Amigo", btnIcon = "add", esAmigo = false;
    if (relacion) {
      if (relacion.status === 'aceptada') { btnText = "Amigo"; btnIcon = "checkmark"; esAmigo = true; }
      else if (relacion.status === 'pendiente') { if (relacion.deUid === miUid) { btnText = "Enviada"; btnIcon = "time-outline"; } else { btnText = "Aceptar"; btnIcon = "person-add"; } }
    }
    const esAmigoAceptado = relacion && relacion.status === 'aceptada';
    return (
      <View>
        <View style={[styles.headerButtons, { top: insets.top + 10 }]}>
          <TouchableOpacity style={styles.floatingBtnHeader} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.floatingBtnHeader} onPress={() => setMostrarMenuOpciones(true)}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <View style={styles.portadaContainer}>{perfil?.portadaUrl ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => abrirImagen(perfil.portadaUrl)}>
            <Image
              source={{ uri: perfil.portadaUrl }}
              style={styles.portada}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </TouchableOpacity>
        ) : (
          <View style={[styles.portada, { backgroundColor: '#F3F4F6' }]} />
        )}</View>
        <View style={styles.headerInfo}>
          <TouchableOpacity style={styles.avatarContainer} activeOpacity={0.9} onPress={() => abrirImagen(perfil?.fotoUrl)}>
            <Image
              source={{ uri: perfil?.fotoUrl || 'https://picsum.photos/200' }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </TouchableOpacity>
          <Text style={styles.nombre}>{perfil?.nombre || 'Usuario'}</Text>
          <Text style={styles.bio}>{perfil?.bio || 'Sin biografía'}</Text>
          <View style={styles.detailsContainer}>
            {perfil?.profesion && <View style={styles.detailItem}><Ionicons name="briefcase-outline" size={16} color="#6B7280" /><Text style={styles.detailText}>{perfil.profesion}</Text></View>}
            {perfil?.ciudad && <View style={styles.detailItem}><Ionicons name="location-outline" size={16} color="#6B7280" /><Text style={styles.detailText}>{perfil.ciudad}</Text></View>}
            {perfil?.link && <View style={styles.detailItem}><Ionicons name="link-outline" size={16} color="#6B7280" /><Text style={[styles.detailText, { color: '#3B82F6' }]}>{perfil.link}</Text></View>}
            {perfil?.instagram && <View style={styles.detailItem}><Ionicons name="logo-instagram" size={16} color="#6B7280" /><Text style={styles.detailText}>{perfil.instagram}</Text></View>}
            {perfil?.musica && <View style={styles.detailItem}><Ionicons name="musical-notes-outline" size={16} color="#6B7280" /><Text style={styles.detailText}>{perfil.musica}</Text></View>}
            {perfil?.familia && <View style={styles.detailItem}><Ionicons name="heart-outline" size={16} color="#6B7280" /><Text style={styles.detailText}>{perfil.familia}</Text></View>}
            {perfil?.hobbies && <View style={styles.detailItem}><Ionicons name="bicycle-outline" size={16} color="#6B7280" /><Text style={styles.detailText}>{perfil.hobbies}</Text></View>}
          </View>
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={[styles.followBtn, esAmigo && styles.followBtnActive]} onPress={handleAccionAmigo}>
              <Ionicons name={btnIcon} size={18} color={esAmigo ? "#6B7280" : "#FFF"} style={{ marginRight: 6 }} />
              <Text style={[styles.followBtnTxt, esAmigo && styles.followBtnTxtActive]}>{btnText}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.messageBtn} onPress={() => router.push({ pathname: '/chats', params: { userId: userId, nombre: perfil?.nombre, tipo: 'regular' } })}>
              <Ionicons name="chatbubble-outline" size={18} color="#FF6600" style={{ marginRight: 6 }} />
              <Text style={styles.messageBtnTxt}>Mensaje</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shareProfileBtn}
              onPress={() => setMostrarCompartir(true)}
            >
              <Ionicons name="share-social-outline" size={20} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.statsRow}><View style={styles.statItem}><Text style={styles.statNum}>{posts.length}</Text><Text style={styles.statLabel}>Posts</Text></View><View style={styles.statItem}><Text style={styles.statNum}>{perfil?.siguiendo?.length || 0}</Text><Text style={styles.statLabel}>Amigos</Text></View></View>
        <View style={styles.historiasCardsRow}>
          {historias.some(h => !h.esEspontanea) && (
            <TouchableOpacity style={styles.storyRectCard} onPress={handleVerHistorias}>
              <Image
                source={{ uri: historias.find(h => !h.esEspontanea)?.thumbnailUrl || historias.find(h => !h.esEspontanea)?.url }}
                style={styles.storyRectImage}
                contentFit="cover"
              />
              {historias.find(h => !h.esEspontanea)?.tipo === 'video' && <View style={styles.rectPlayOverlay}><View style={styles.playButtonCircleGrid}><Ionicons name="play" size={24} color="#FFFFFF" /></View></View>}
              <View style={styles.storyRectOverlay}><Text style={styles.storyRectTitle}>Historias</Text></View>
            </TouchableOpacity>
          )}
          {posts.some(p => p.esEspontanea) && (
            <TouchableOpacity style={[styles.storyRectCard, styles.storyRectCardEsp]} onPress={() => setModalEspontaneasVisible(true)}>
              <Image
                source={{ uri: posts.find(p => p.esEspontanea)?.thumbnailUrl || posts.find(p => p.esEspontanea)?.url }}
                style={styles.storyRectImage}
                contentFit="cover"
              />
              <View style={[styles.storyRectOverlay, styles.storyRectOverlayEsp]}><Ionicons name="sparkles" size={16} color="#FFF" /><Text style={styles.storyRectTitle}>Espontáneas</Text></View>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.tabSection}><Text style={styles.tabTitle}>Publicaciones</Text></View>
      </View>
    );
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator size="large" color="#FF6600" /></View>;

  // --- INTERFAZ SI EL USUARIO ESTÁ BLOQUEADO ---
  if (bloqueoActivo) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFF' }}>
        <View style={[styles.topBarActions, { top: insets.top + 10 }]}>
          <TouchableOpacity style={styles.floatingBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <View style={[styles.center, { paddingHorizontal: 40 }]}>
          <View style={styles.lockCircle}>
             <Ionicons name="lock-closed" size={60} color="#EF4444" />
          </View>
          <Text style={styles.lockTitle}>Usuario Bloqueado</Text>
          <Text style={styles.lockSub}>No puedes ver el contenido de este usuario porque hay un bloqueo activo.</Text>

          {loTengoBloqueado && (
            <TouchableOpacity
              style={styles.unblockBtn}
              onPress={async () => {
                await desbloquearUsuario(userId);
                Alert.alert("Desbloqueado", "Ahora puedes volver a interactuar con este usuario.");
              }}
            >
              <Text style={styles.unblockText}>Desbloquear a {perfil?.nombre || 'este usuario'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const esAmigoAceptado = relacion && relacion.status === 'aceptada';
  const lasEspontaneas = posts.filter(p => p.esEspontanea);

  const handleBloquear = () => {
    setMostrarMenuOpciones(false);
    Alert.alert('Bloquear', '¿Estás seguro? Ya no verás su contenido.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, bloquear',
        style: 'destructive',
        onPress: async () => {
          await bloquearUsuario(userId);
          router.back();
        }
      }
    ]);
  };

  const handleReportar = () => {
    setMostrarMenuOpciones(false);
    Alert.alert('Reportar', '¿Por qué quieres reportar este perfil?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Contenido inapropiado',
        onPress: async () => {
          await enviarReporte({ tipo: 'perfil', idContenido: userId, idAutor: userId, motivo: 'Inapropiado' });
          Alert.alert('Gracias', 'Recibimos tu reporte.');
        }
      },
      {
        text: 'Spam',
        onPress: async () => {
          await enviarReporte({ tipo: 'perfil', idContenido: userId, idAutor: userId, motivo: 'Spam' });
          Alert.alert('Gracias', 'Recibimos tu reporte.');
        }
      }
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF' }}>
      <FlatList
        data={esAmigoAceptado ? posts : []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (<PostPerfil post={item} onComentar={(p) => { setPostSeleccionado(p); setMostrarComentarios(true); }} />)}
        ListEmptyComponent={<View style={styles.emptyFeed}>{!esAmigoAceptado ? (<View style={styles.privateProfile}><Ionicons name="lock-closed" size={50} color="#CCC" /><Text style={styles.privateTitle}>Perfil Privado</Text></View>) : (<Text style={styles.emptyText}>No hay publicaciones aún.</Text>)}</View>}
        removeClippedSubviews={true}
        initialNumToRender={5}
        windowSize={5}
      />

      {/* MENÚ DE OPCIONES PERSONALIZADO */}
      <Modal visible={mostrarMenuOpciones} transparent animationType="fade" onRequestClose={() => setMostrarMenuOpciones(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMostrarMenuOpciones(false)}>
          <View style={styles.menuContent}>
            <View style={styles.menuIndicator} />

            <TouchableOpacity style={styles.menuOption} onPress={handleReportar}>
              <Ionicons name="flag-outline" size={22} color="#EF4444" />
              <Text style={[styles.menuOptionText, { color: '#EF4444' }]}>Reportar perfil</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuOption} onPress={handleBloquear}>
              <Ionicons name="ban-outline" size={22} color="#374151" />
              <Text style={styles.menuOptionText}>Bloquear usuario</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuCancelBtn} onPress={() => setMostrarMenuOpciones(false)}>
              <Text style={styles.menuCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ComentariosModal visible={mostrarComentarios} onClose={() => setMostrarComentarios(false)} post={postSeleccionado} />
      <Modal visible={modalEspontaneasVisible} animationType="slide" transparent={false} onRequestClose={() => setModalEspontaneasVisible(false)}>
        <View style={[styles.modalGridContainer, { paddingTop: insets.top + 20 }]}><View style={styles.modalGridHeader}><TouchableOpacity onPress={() => setModalEspontaneasVisible(false)} style={styles.modalGridClose}><Ionicons name="close" size={32} color="#333" /></TouchableOpacity><Text style={styles.modalGridTitle}>Espontáneas</Text></View><FlatList data={lasEspontaneas} numColumns={3} keyExtractor={(item) => item.id} contentContainerStyle={styles.gridContent} renderItem={({ item }) => (<TouchableOpacity style={styles.gridItem} onPress={() => abrirEspontaneaIndividual(item)}><Image source={{ uri: item.thumbnailUrl || item.url }} style={styles.gridImage} contentFit="cover" />{(item.tipo?.includes('video') || !!item.thumbnailUrl) && (<View style={styles.gridVideoBadge}><Ionicons name="videocam" size={10} color="#FFFFFF" /></View>)}</TouchableOpacity>)} /></View>
      </Modal>

      <SelectorCompartir
        visible={mostrarCompartir}
        onClose={() => setMostrarCompartir(false)}
        contenido={{
          id: userId,
          tipo: 'perfil',
          titulo: perfil?.nombre || 'Usuario',
          imagen: perfil?.fotoUrl || null,
          subTitulo: perfil?.profesion || 'Perfil de Conek'
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerButtons: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  floatingBtnHeader: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3
  },
  portadaContainer: { height: 180, width: '100%', backgroundColor: '#F3F4F6' },
  portada: { height: '100%', width: '100%', resizeMode: 'cover' },
  headerInfo: { alignItems: 'center', marginTop: -50, paddingHorizontal: 20 },
  avatarContainer: { position: 'relative', marginBottom: 10 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#FFF', backgroundColor: '#EEE' },
  nombre: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  bio: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 4, marginBottom: 15 },
  detailsContainer: { width: '100%', paddingHorizontal: 20, marginBottom: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  detailText: { marginLeft: 6, fontSize: 13, color: '#4B5563', fontWeight: '500' },
  followBtn: { backgroundColor: '#FF6600', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 25, flexDirection: 'row', alignItems: 'center' },
  followBtnActive: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  actionButtonsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  followBtnTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  followBtnTxtActive: { color: '#6B7280' },
  messageBtn: { marginLeft: 10, backgroundColor: '#FFF', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 25, borderWidth: 1, borderColor: '#FF6600', flexDirection: 'row', alignItems: 'center' },
  messageBtnTxt: { color: '#FF6600', fontWeight: 'bold', fontSize: 14 },
  shareProfileBtn: {
    marginLeft: 10,
    backgroundColor: '#F3F4F6',
    width: 45,
    height: 45,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  blockActionBtn: {
    marginLeft: 10,
    backgroundColor: '#FEF2F2',
    width: 45,
    height: 45,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 25, paddingHorizontal: 20 },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280' },
  historiasCardsRow: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 15, paddingHorizontal: 16, flexWrap: 'wrap' },
  storyRectCard: { width: 120, height: 180, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', elevation: 3 },
  storyRectCardEsp: { borderColor: '#FF914D', borderWidth: 2 },
  storyRectImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  storyRectOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  storyRectOverlayEsp: { backgroundColor: 'rgba(255, 145, 77, 0.4)' },
  storyRectTitle: { color: '#FFF', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  tabSection: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 20 },
  tabTitle: { fontSize: 16, fontWeight: '700', marginLeft: 20, marginBottom: 15, color: '#333' },
  emptyFeed: { alignItems: 'center', marginTop: 40, opacity: 0.5 },
  emptyText: { marginTop: 10, color: '#6B7280' },
  privateProfile: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, backgroundColor: '#FAFAFA', marginTop: 10, borderRadius: 12 },
  modalGridContainer: { flex: 1, backgroundColor: '#FFF' },
  modalGridHeader: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalGridClose: { padding: 5 },
  modalGridTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginLeft: 10 },
  gridContent: { padding: 10 },
  gridItem: { width: GRID_ITEM_WIDTH, height: GRID_ITEM_WIDTH * 1.5, margin: 5, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F3F4F6', position: 'relative' },
  gridImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  gridVideoBadge: { position: 'absolute', top: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: 4 },
  playButtonCircleGrid: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  rectPlayOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },

  // Estilos del menú personalizado
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingTop: 10,
    paddingBottom: 40,
    paddingHorizontal: 20,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  menuIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuOptionText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    color: '#374151',
  },
  menuCancelBtn: {
    marginTop: 20,
    backgroundColor: '#F3F4F6',
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: 'center',
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  // Estilos de bloqueo
  lockCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10
  },
  lockSub: {
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 30,
    lineHeight: 20
  },
  unblockBtn: {
    backgroundColor: '#FF6600',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 12
  },
  unblockText: {
    color: 'white',
    fontWeight: 'bold'
  }
});
