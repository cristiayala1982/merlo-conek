import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View, Modal, Alert, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';
import { obtenerPerfilUsuario, escucharPostsUsuario, escucharHistoriasUsuario, obtenerHistoriasGrupales } from '../../services/firebaseService';
import { setStoriesCache } from '../../services/storiesState';
import { setVideoViewerPayload } from '../../services/videoViewerState';
import AmigosModal from '../amigos/AmigosModal';
import ComentariosModal from '../home/ComentariosModal';
import PostPerfil from './PostPerfil';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - 40) / 3;

export default function PerfilScreen() {
  const router = useRouter();
  const { openEspontaneas } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const isMounted = useRef(true);

  const [perfil, setPerfil] = useState(null);
  const [posts, setPosts] = useState([]);
  const [historias, setHistorias] = useState([]);
  const [mostrarAmigos, setMostrarAmigos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [postSeleccionado, setPostSeleccionado] = useState(null);
  const [modalEspontaneasVisible, setModalEspontaneasVisible] = useState(false);

  useEffect(() => {
    if (openEspontaneas === 'true') {
      setModalEspontaneasVisible(true);
    }
  }, [openEspontaneas]);

  useEffect(() => {
    isMounted.current = true;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubPerfil = obtenerPerfilUsuario(uid, (data) => { if (isMounted.current) setPerfil(data); });
    const unsubPosts = escucharPostsUsuario(uid, (lista) => { if (isMounted.current) { setPosts(lista); setCargando(false); } }, () => { if (isMounted.current) setCargando(false); });
    const unsubStories = escucharHistoriasUsuario(uid, (lista) => { if (isMounted.current) setHistorias(lista); });
    return () => { isMounted.current = false; unsubPerfil(); unsubPosts(); unsubStories(); };
  }, []);

  const handleVerHistorias = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || historias.length === 0) return;
    const dataCompleta = await obtenerHistoriasGrupales([uid], uid);
    dataCompleta[0].stories = dataCompleta[0].stories.filter(s => !s.esEspontanea);
    if (dataCompleta[0].stories.length === 0) return;
    setStoriesCache(dataCompleta);
    router.push({ pathname: '/historias-viewer-perfil', params: { userId: uid } });
  };

  const abrirEspontaneaIndividual = (item) => {
    setVideoViewerPayload({ videoUri: item.url, post: { ...item, id: item.id || item.postId, userName: item.userName || perfil?.nombre, userPhotoUrl: item.userPhotoUrl || perfil?.fotoUrl } });
    const esVideo = item.tipo?.includes('video') || item.type?.includes('video') || !!item.thumbnailUrl || (typeof item.url === 'string' && item.url.toLowerCase().includes('.mp4'));
    router.push({
      pathname: esVideo ? '/video-viewer-perfil' : '/image-viewer-perfil',
      params: { t: String(Date.now()), originUserId: auth.currentUser?.uid, fromEspontaneas: 'true' }
    });
  };

  const abrirImagen = (url) => {
    if (!url) return;
    setVideoViewerPayload({ videoUri: url, isProfileView: true, post: { userName: perfil?.nombre || 'Mi Perfil', userPhotoUrl: perfil?.fotoUrl || '', texto: 'Foto de perfil / portada', userId: auth.currentUser?.uid } });
    router.push({ pathname: '/image-viewer-perfil', params: { originUserId: auth.currentUser?.uid } });
  };

  const renderHeader = () => (
    <View>
      <View style={styles.portadaContainer}>
        {perfil?.portadaUrl ? (
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
        )}
      </View>
      <View style={styles.headerInfo}>
        <View style={styles.avatarContainer}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => abrirImagen(perfil?.fotoUrl)}>
            <Image
              source={{ uri: perfil?.fotoUrl || 'https://picsum.photos/200' }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBadge} onPress={() => router.push('/editarPerfil')}>
            <Ionicons name="pencil" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
        <Text style={styles.nombre}>{perfil?.nombre || 'Mi Perfil'}</Text>
        <Text style={styles.bio}>{perfil?.bio || 'Sin biografía aún'}</Text>
        <View style={styles.detailsContainer}>
          {perfil?.profesion && <View style={styles.detailItem}><Ionicons name="briefcase-outline" size={16} color="#6B7280" /><Text style={styles.detailText}>{perfil.profesion}</Text></View>}
          {(perfil?.provincia || perfil?.partido || perfil?.localidad || perfil?.ciudad) && (
            <View style={styles.detailItem}>
              <Ionicons name="location-outline" size={16} color="#6B7280" />
              <Text style={styles.detailText}>
                {perfil.provincia ? `${perfil.provincia}, ` : ''}
                {perfil.partido || perfil.localidad || perfil.ciudad}
                {perfil.localidadInterna ? ` (${perfil.localidadInterna})` : ''}
              </Text>
            </View>
          )}
          {perfil?.link && <View style={styles.detailItem}><Ionicons name="link-outline" size={16} color="#6B7280" /><Text style={[styles.detailText, { color: '#3B82F6' }]}>{perfil.link}</Text></View>}
          {perfil?.instagram && <View style={styles.detailItem}><Ionicons name="logo-instagram" size={16} color="#6B7280" /><Text style={styles.detailText}>{perfil.instagram}</Text></View>}
          {perfil?.musica && <View style={styles.detailItem}><Ionicons name="musical-notes-outline" size={16} color="#6B7280" /><Text style={styles.detailText}>{perfil.musica}</Text></View>}
          {perfil?.familia && <View style={styles.detailItem}><Ionicons name="heart-outline" size={16} color="#6B7280" /><Text style={styles.detailText}>{perfil.familia}</Text></View>}
          {perfil?.hobbies && <View style={styles.detailItem}><Ionicons name="bicycle-outline" size={16} color="#6B7280" /><Text style={styles.detailText}>{perfil.hobbies}</Text></View>}
        </View>
        <TouchableOpacity style={styles.friendsBtn} onPress={() => setMostrarAmigos(true)}><Ionicons name="people" size={18} color="#FF6600" /><Text style={styles.friendsBtnTxt}>Ver mis amigos</Text></TouchableOpacity>
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
            {historias.find(h => !h.esEspontanea)?.tipo === 'video' && <View style={styles.rectPlayOverlay}><View style={styles.playButtonCircleGrid}><Ionicons name="play" size={24} color="#FFFFFF" style={{ marginLeft: 3 }} /></View></View>}
            <View style={styles.storyRectOverlay}><Text style={styles.storyRectTitle}>Historias</Text></View>
          </TouchableOpacity>
        )}
        {posts.some(p => p.esEspontanea) && (
          <TouchableOpacity style={[styles.storyRectCard, styles.storyRectCardEsp]} onPress={() => setModalEspontaneasVisible(true)}>
            <Image
                source={{ uri: posts.find(p => p.esEspontanea)?.url || posts.find(p => p.esEspontanea)?.thumbnailUrl }}
                style={styles.storyRectImage}
                contentFit="cover"
            />
            <View style={[styles.storyRectOverlay, styles.storyRectOverlayEsp]}><Ionicons name="sparkles" size={16} color="#FFF" style={{ marginBottom: 4 }} /><Text style={styles.storyRectTitle}>Espontáneas</Text></View>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.tabSection}><Text style={styles.tabTitle}>Mis Publicaciones</Text></View>
    </View>
  );

  if (cargando && !perfil) return <View style={styles.center}><ActivityIndicator size="large" color="#FF6600" /></View>;
  const misEspontaneas = posts.filter(p => p.esEspontanea);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF' }}>
      <FlatList data={posts} keyExtractor={(item) => item.id} ListHeaderComponent={renderHeader} renderItem={({ item }) => (<PostPerfil post={item} onComentar={(p) => { setPostSeleccionado(p); setMostrarComentarios(true); }} />)} ListEmptyComponent={<View style={styles.emptyFeed}><Ionicons name="grid-outline" size={40} color="#DDD" /><Text style={styles.emptyText}>Todavía no tienes publicaciones.</Text></View>} removeClippedSubviews={true} initialNumToRender={5} windowSize={5} />
      <AmigosModal visible={mostrarAmigos} onClose={() => setMostrarAmigos(false)} />
      <ComentariosModal visible={mostrarComentarios} onClose={() => setMostrarComentarios(false)} post={postSeleccionado} />
      <Modal visible={modalEspontaneasVisible} animationType="slide" transparent={false} onRequestClose={() => setModalEspontaneasVisible(false)}>
        <View style={[styles.modalGridContainer, { paddingTop: insets.top + 20 }]}><View style={styles.modalGridHeader}><TouchableOpacity onPress={() => setModalEspontaneasVisible(false)} style={styles.modalGridClose}><Ionicons name="close" size={32} color="#333" /></TouchableOpacity><Text style={styles.modalGridTitle}>Mis Espontáneas</Text><View style={{ width: 40 }} /></View><FlatList data={misEspontaneas} numColumns={3} keyExtractor={(item) => item.id} contentContainerStyle={styles.gridContent} renderItem={({ item }) => (<TouchableOpacity style={styles.gridItem} onPress={() => abrirEspontaneaIndividual(item)}><Image source={{ uri: item.thumbnailUrl || item.url }} style={styles.gridImage} contentFit="cover" />{(item.tipo?.includes('video') || !!item.thumbnailUrl) && (<View style={styles.gridVideoBadge} pointerEvents="none"><Ionicons name="videocam" size={10} color="#FFFFFF" /><Text style={styles.gridVideoBadgeText}>VIDEO</Text></View>)}</TouchableOpacity>)} ListEmptyComponent={<View style={styles.center}><Text>No hay espontáneas aún.</Text></View>} /></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  portadaContainer: { height: 180, width: '100%', backgroundColor: '#EEE' },
  portada: { height: '100%', width: '100%', resizeMode: 'cover' },
  headerInfo: { alignItems: 'center', marginTop: -50, paddingHorizontal: 20 },
  avatarContainer: { position: 'relative', marginBottom: 10 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#FFF', backgroundColor: '#EEE' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#FF6600', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF', elevation: 3 },
  nombre: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  bio: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 4, marginBottom: 15 },
  detailsContainer: { width: '100%', paddingHorizontal: 20, marginBottom: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  detailText: { marginLeft: 6, fontSize: 13, color: '#4B5563', fontWeight: '500' },
  friendsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FFEDD5', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  friendsBtnTxt: { marginLeft: 8, color: '#FF6600', fontWeight: 'bold', fontSize: 14 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 25, paddingHorizontal: 60 },
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
  modalGridContainer: { flex: 1, backgroundColor: '#FFF' },
  modalGridHeader: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalGridClose: { padding: 5 },
  modalGridTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  gridContent: { padding: 10 },
  gridItem: { width: GRID_ITEM_WIDTH, height: GRID_ITEM_WIDTH * 1.5, margin: 5, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F3F4F6', position: 'relative' },
  gridImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  gridVideoBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    zIndex: 10
  },
  gridVideoBadgeText: {
    marginLeft: 4,
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  playButtonCircleGrid: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 8
  },
  rectPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)'
  }
});
