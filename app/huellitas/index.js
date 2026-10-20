import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Dimensions, ActivityIndicator, DeviceEventEmitter, RefreshControl, Platform, ScrollView, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Navbar } from '../../components/barraNavegacion/Navbar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { db, auth } from '../../firebaseConfig';
import { collection, query, orderBy, onSnapshot, where, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { obtenerPerfilUsuario } from '../../services/firebaseService';
import { Image } from 'expo-image';
import SelectorCompartir from '../../components/compartir/SelectorCompartir';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 10) / 2;

// --- COMPONENTE DE TARJETA ---
const MascotaCard = React.memo(({ item, onPress, miUid, onShare }) => {
  const mainPhoto = item.fotos?.[0] || item.foto;
  const esPerdido = item.estado === 'perdido';
  const esEncontrado = item.estado === 'encontrado';
  const esAdopcion = item.estado === 'adopcion';

  let colorEstado = '#6B7280';
  let labelEstado = 'Mascota';
  if (esPerdido) { colorEstado = '#EF4444'; labelEstado = 'SE PERDIÓ'; }
  if (esEncontrado) { colorEstado = '#3B82F6'; labelEstado = 'LO ENCONTRÉ'; }
  if (esAdopcion) { colorEstado = '#10B981'; labelEstado = 'EN ADOPCIÓN'; }

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => onPress(item)}>
      <View style={styles.imageContainer}>
        {mainPhoto ? (
          <Image source={{ uri: mainPhoto }} style={styles.cardImage} contentFit="cover" transition={200} />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="paw-outline" size={40} color="#D1D5DB" />
          </View>
        )}
        <View style={[styles.estadoBadge, { backgroundColor: colorEstado }]}>
          <Text style={styles.estadoBadgeText}>{labelEstado}</Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.nombre || 'Sin nombre'}</Text>
        <View style={styles.barrioRow}>
          <Ionicons name="location" size={12} color="#6B7280" />
          <Text style={styles.cardBarrio} numberOfLines={1}>{item.barrio}</Text>
        </View>
        <View style={styles.cardFooter}>
           <Text style={styles.especieTxt}>{item.especie} • {item.sexo}</Text>
           <TouchableOpacity onPress={(e) => { e.stopPropagation(); onShare(item); }}>
              <Ionicons name="share-social-outline" size={20} color="#6B7280" />
           </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function HuellitasIndex() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mascotas, setMascotas] = useState([]);
  const [miPerfil, setMiPerfil] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('todos'); // 'todos', 'perdido', 'encontrado', 'adopcion'
  const [barrioFiltro, setBarrioFiltro] = useState('');

  const [itemSeleccionado, setItemSeleccionado] = useState(null);
  const [mostrarCompartir, setMostrarCompartir] = useState(false);
  const [itemParaCompartir, setItemParaCompartir] = useState(null);

  const miUid = auth.currentUser?.uid;

  useEffect(() => {
    if (miUid) obtenerPerfilUsuario(miUid, setMiPerfil);
  }, [miUid]);

  useEffect(() => {
    if (!miPerfil) return;
    const q = query(
      collection(db, 'mascotas'),
      where('localidad', '==', miPerfil.localidad),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMascotas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setRefreshing(false);
    });
    return () => unsub();
  }, [miPerfil]);

  const dataProcesada = useMemo(() => {
    return mascotas.filter(m => {
      const matchEstado = filtroEstado === 'todos' || m.estado === filtroEstado;
      const matchBarrio = !barrioFiltro || m.barrio?.toLowerCase().includes(barrioFiltro.toLowerCase());
      return matchEstado && matchBarrio;
    });
  }, [mascotas, filtroEstado, barrioFiltro]);

  const irAlChat = (item) => {
    const msg = `[HUELLITAS] ¡Hola! Te contacto por la mascota "${item.nombre || item.especie}" que publicaste en ${item.barrio}.`;
    setItemSeleccionado(null);
    router.push({ pathname: '/chats', params: { userId: item.userId, prefilledMsg: msg } });
  };

  const renderItem = useCallback(({ item }) => (
    <MascotaCard
      item={item}
      miUid={miUid}
      onPress={setItemSeleccionado}
      onShare={(it) => { setItemParaCompartir(it); setMostrarCompartir(true); }}
    />
  ), [miUid]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Navbar />

      <View style={styles.header}>
        <Text style={styles.title}>Huellitas {miPerfil?.localidad || 'Conek'}</Text>
        <Text style={styles.subtitle}>Ayudemos a nuestras mascotas a volver a casa</Text>
      </View>

      {/* FILTROS RÁPIDOS */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <FilterChip label="Todos" active={filtroEstado === 'todos'} onPress={() => setFiltroEstado('todos')} color="#6B7280" />
          <FilterChip label="Perdidos" active={filtroEstado === 'perdido'} onPress={() => setFiltroEstado('perdido')} color="#EF4444" />
          <FilterChip label="Encontrados" active={filtroEstado === 'encontrado'} onPress={() => setFiltroEstado('encontrado')} color="#3B82F6" />
          <FilterChip label="Adopción" active={filtroEstado === 'adopcion'} onPress={() => setFiltroEstado('adopcion')} color="#10B981" />
        </ScrollView>
        <View style={styles.searchBar}>
           <Ionicons name="location-outline" size={18} color="#9CA3AF" />
           <TextInput
             placeholder="Filtrar por barrio..."
             style={styles.searchInput}
             value={barrioFiltro}
             onChangeText={setBarrioFiltro}
           />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#FF6600" /></View>
      ) : (
        <FlatList
          data={dataProcesada}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="paw" size={50} color="#EEE" />
              <Text style={styles.emptyTxt}>No hay avisos con estos filtros.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/huellitas/nuevo')}>
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      {/* MODAL DETALLE */}
      <Modal visible={!!itemSeleccionado} animationType="fade" transparent onRequestClose={() => setItemSeleccionado(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Image source={{ uri: itemSeleccionado?.fotos?.[0] || itemSeleccionado?.foto }} style={styles.modalImg} contentFit="cover" />
            <TouchableOpacity style={styles.closeModal} onPress={() => setItemSeleccionado(null)}>
              <Ionicons name="close-circle" size={36} color="white" />
            </TouchableOpacity>

            <View style={styles.modalBody}>
              <Text style={styles.modalTitle}>{itemSeleccionado?.nombre || 'Mascota sin nombre'}</Text>
              <Text style={styles.modalBarrio}>{itemSeleccionado?.barrio}, {itemSeleccionado?.localidad}</Text>
              <View style={styles.modalInfoRow}>
                 <View style={styles.infoPill}><Text style={styles.infoPillTxt}>{itemSeleccionado?.especie}</Text></View>
                 <View style={styles.infoPill}><Text style={styles.infoPillTxt}>{itemSeleccionado?.sexo}</Text></View>
              </View>
              <Text style={styles.modalDesc}>{itemSeleccionado?.descripcion}</Text>

              {itemSeleccionado?.userId !== miUid && (
                <TouchableOpacity style={styles.btnChat} onPress={() => irAlChat(itemSeleccionado)}>
                  <Ionicons name="chatbubble-ellipses" size={24} color="white" />
                  <Text style={styles.btnChatTxt}>Contactar al Protector</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {itemParaCompartir && (
        <SelectorCompartir
          visible={mostrarCompartir}
          onClose={() => setMostrarCompartir(false)}
          contenido={{
            id: itemParaCompartir.id,
            tipo: 'huellita',
            titulo: `${itemParaCompartir.estado === 'perdido' ? '¡Mascota Perdida!' : 'Mascota'} - ${itemParaCompartir.nombre || itemParaCompartir.especie}`,
            imagen: itemParaCompartir.fotos?.[0] || itemParaCompartir.foto || null,
            subTitulo: `${itemParaCompartir.barrio}`
          }}
        />
      )}
    </View>
  );
}

function FilterChip({ label, active, onPress, color }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && { color: 'white' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: '900', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  filterSection: { backgroundColor: 'white', paddingBottom: 15 },
  filterScroll: { paddingHorizontal: 15, gap: 10, marginBottom: 15 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F3F4F6' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  searchBar: { marginHorizontal: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  listContent: { padding: 5, paddingBottom: 100 },
  columnWrapper: { justifyContent: 'space-between' },
  card: { width: ITEM_WIDTH, backgroundColor: 'white', borderRadius: 12, marginBottom: 10, overflow: 'hidden', elevation: 2 },
  imageContainer: { width: '100%', height: 150, position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  placeholderImage: { width: '100%', height: '100%', backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  estadoBadge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  estadoBadgeText: { color: 'white', fontSize: 10, fontWeight: '900' },
  cardContent: { padding: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  barrioRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardBarrio: { fontSize: 12, color: '#6B7280', marginLeft: 4, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8 },
  especieTxt: { fontSize: 11, color: '#9CA3AF', fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 110, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyTxt: { color: '#9CA3AF', marginTop: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: width * 0.9, backgroundColor: 'white', borderRadius: 20, overflow: 'hidden' },
  modalImg: { width: '100%', height: 300 },
  closeModal: { position: 'absolute', top: 15, right: 15 },
  modalBody: { padding: 20 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#111827' },
  modalBarrio: { fontSize: 16, color: '#6B7280', marginTop: 2, fontWeight: 'bold' },
  modalInfoRow: { flexDirection: 'row', gap: 10, marginVertical: 15 },
  infoPill: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  infoPillTxt: { fontSize: 13, fontWeight: 'bold', color: '#374151' },
  modalDesc: { fontSize: 15, color: '#4B5563', lineHeight: 22, marginBottom: 25 },
  btnChat: { backgroundColor: '#10B981', height: 54, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnChatTxt: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
