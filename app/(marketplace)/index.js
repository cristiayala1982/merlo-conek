import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Linking, Modal, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import SelectorCompartir from '../../components/compartir/SelectorCompartir';
import { HaloBrandIcon, HaloMarketIcon, HaloUserIcon } from '../../components/icons/HaloIcons';
import BotonReload from '../../components/utilidades/BotonReload';
import PublicidadBadge from '../../components/utilidades/PublicidadBadge';
import { auth, db } from '../../firebaseConfig';
import { obtenerPerfilUsuario, toggleLikeProducto } from '../../services/firebaseService';
import { getGlobalUserProfile } from '../../services/userState';
import { procesarMuroMarket } from '../../services/marketAlgorithm';
import { setSectionScrollOffset, getSectionScrollOffset, setSectionCache, getSectionCache } from '../../services/feedState';
import { UI_CONSTANTS } from '../../constants/uiConstants';
import { obtenerPartidosDeProvincia, obtenerLocalidadesDePartido } from '../../constants/geografiaArgentina';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 40) / 2;
const CARD_HEIGHT = 266;

const PROVINCIAS_ARGENTINA = [
  "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Ciudad Autónoma de Buenos Aires",
  "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
  "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
].sort();

const formatPrecio = (val) => {
  if (typeof val === 'number') return val.toLocaleString('es-AR');
  if (!val) return '';
  const num = String(val).replace(/[^0-9]/g, '');
  if (!num) return '';
  return parseInt(num, 10).toLocaleString('es-AR');
};

const ProductCardUltra = React.memo(({ item, router, miUid, onLike, onShare }) => {
  const tieneLike = item.likes?.includes(miUid);
  const esMio = item.vendedorId === miUid;
  const handleWhatsApp = (e) => {
    e.stopPropagation();
    if (!item.whatsapp) return;
    const tel = item.whatsapp.replace(/\D/g, '');
    const numFinal = tel.startsWith('54') ? tel : `549${tel.startsWith('0') ? tel.substring(1) : tel}`;
    const mensaje = encodeURIComponent(`¡Hola! Me interesa tu publicación: *${item.titulo}*`);
    const url = `whatsapp://send?phone=${numFinal}&text=${mensaje}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://wa.me/${numFinal}?text=${mensaje}`));
  };
  return (
    <TouchableOpacity style={styles.ultraCard} onPress={() => router.push({ pathname: '/(marketplace)/marketDetalle', params: { productId: item.id } })}>
      <View style={styles.ultraImageWrapper}>
        <Image source={{ uri: item.fotos[0] }} style={styles.ultraImage} contentFit="cover" transition={300} />
        <PublicidadBadge />
        <View style={styles.ultraActionsTop}>
          {!esMio && (
            <TouchableOpacity style={styles.actionBtnCircle} onPress={(e) => { e.stopPropagation(); onLike(item); }}>
              <Ionicons name={tieneLike ? "heart" : "heart-outline"} size={22} color={tieneLike ? "#FF6600" : "#FFF"} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionBtnCircle} onPress={(e) => { e.stopPropagation(); onShare(item); }}>
            <Ionicons name="share-social-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.ultraInfo}>
        <View style={styles.ultraRow}><View style={{ flex: 1 }}><Text style={styles.ultraPrice}>${formatPrecio(item.price || item.precio)}</Text><Text style={styles.ultraTitle} numberOfLines={1}>{item.titulo}</Text></View>
        {item.whatsapp && !esMio && <TouchableOpacity style={styles.whatsappRoundBtn} onPress={handleWhatsApp}><Ionicons name="logo-whatsapp" size={32} color="white" /></TouchableOpacity>}</View>
        <Text style={styles.productLocation}><Ionicons name="location" size={14} color="#FFB800" /> {item.partido ? `${item.partido}, ${item.localidad}` : item.localidad}</Text>
      </View>
    </TouchableOpacity>
  );
});

const ProductCard = React.memo(({ item, router, miUid, onLike, onShare }) => {
  const tieneLike = item.likes?.includes(miUid);
  const esMio = item.vendedorId === miUid;
  const esImpulsado = item.esPremium && item.nivelPremium === 1;
  const esMaximoImpulso = item.esPremium && item.nivelPremium === 2;

  return (
    <TouchableOpacity
      style={[
        styles.productCard,
        esImpulsado && {
          borderColor: '#FFB000',
          borderWidth: 2,
          backgroundColor: '#FFF7ED', // Soft Orange Background
          shadowColor: '#FFB000',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.12,
          shadowRadius: 6,
          elevation: 2,
        },
        esMaximoImpulso && {
          borderColor: '#FFB000',
          borderWidth: 10,
          backgroundColor: '#FFF4BF',
          shadowColor: '#FFB000',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 20,
          elevation: 12,
        }
      ]}
      onPress={() => router.push({ pathname: '/(marketplace)/marketDetalle', params: { productId: item.id } })}
    >
      <View style={styles.imageWrapper}>
        <Image source={{ uri: item.fotos[0] }} style={styles.productImage} contentFit="cover" transition={200} />
        <View style={styles.cardActionsTop}>
          {!esMio && (
            <TouchableOpacity style={styles.actionBtnCircleSmall} onPress={(e) => { e.stopPropagation(); onLike(item); }}>
              <Ionicons name={tieneLike ? "heart" : "heart-outline"} size={18} color={tieneLike ? "#FF6600" : "#FFF"} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionBtnCircleSmall} onPress={(e) => { e.stopPropagation(); onShare(item); }}>
            <Ionicons name="share-social-outline" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
        {(esImpulsado || esMaximoImpulso) && <PublicidadBadge />}
      </View>
        <View style={[styles.productInfo, esMaximoImpulso && { backgroundColor: '#FDE68A' }, esImpulsado && !esMaximoImpulso && { backgroundColor: '#FFF7ED' }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.productPrice, esMaximoImpulso && { color: '#7A4B00' }, esImpulsado && !esMaximoImpulso && { color: '#C2410C' }]}>
            ${formatPrecio(item.price || item.precio)}
          </Text>
        </View>
        <Text style={styles.productTitle} numberOfLines={1}>{item.titulo}</Text>
        <Text style={styles.productLocation} numberOfLines={1}>
          <Ionicons name="location-outline" size={14} color="#000000" /> {item.partido ? `${item.partido}${item.localidad ? `, ${item.localidad}` : ''}` : (item.localidad || 'Ubicación no especificada')}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export default function MarketplaceHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);
  const isRestoringScroll = useRef(false);
  const seedRef = useRef(Date.now());
  const [perfil, setPerfil] = useState(() => getGlobalUserProfile() || null);
  const [productos, setProductos] = useState(getSectionCache('market'));
  const [cargandoMuro, setCargandoMuro] = useState(productos.length === 0);
  const [refreshing, setRefreshing] = useState(true); // Iniciamos en true para inmediatez
  const [refreshKey, setRefreshKey] = useState(0);

  const [provincia, setProvincia] = useState('');
  const [partido, setPartido] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [barrio, setBarrio] = useState('');
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [mostrarBuscador, setMostrarBuscador] = useState(false);
  const [mostrarCompartir, setMostrarCompartir] = useState(false);
  const [productoACompartir, setProductoACompartir] = useState(null);

  const [modalProvVisible, setModalProvVisible] = useState(false);
  const [modalPartVisible, setModalPartVisible] = useState(false);
  const [modalLocVisible, setModalLocVisible] = useState(false);
  const [partidos, setPartidos] = useState([]);
  const [localidades, setLocalidades] = useState([]);
  const [cargandoPart, setCargandoPart] = useState(false);
  const [cargandoLoc, setCargandoLoc] = useState(false);

  const miUid = auth.currentUser?.uid;

  useFocusEffect(
    useCallback(() => {
        // Al entrar al Marketplace, ya NO forzamos el refresh automático.
        // Esto permite persistencia: si vas al Home y vuelves, sigues en el mismo producto.
        // El refresh total solo ocurrirá si:
        // 1. Tocas el icono del carrito en la Navbar (RELOAD_MARKET)
        // 2. Haces Pull-to-refresh
        // 3. Vuelves a la app tras 5 min (AppStateManager)

        const timer = setTimeout(() => {
          setRefreshing(false);
        }, 300);

        return () => {
          clearTimeout(timer);
          console.log('🧹 [Marketplace] Temporizador de recarga cancelado al salir.');
        };
    }, [])
  );

  useEffect(() => {
    if (miUid) obtenerPerfilUsuario(miUid, setPerfil);

    const subReload = DeviceEventEmitter.addListener('RELOAD_MARKET', () => {
      handleReset();
    });

    return () => {
      subReload.remove();
    };
  }, [miUid]);

  useEffect(() => {
    const q = query(collection(db, 'productos_market'), where('estado', '==', 'activo'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (perfil?.bloqueados) docs = docs.filter(p => !perfil.bloqueados.includes(p.vendedorId));
        setProductos(docs);
        setSectionCache('market', docs);
        setCargandoMuro(false);
    });
  }, [perfil]);

  // Restaurar scroll al montar
  useEffect(() => {
    const offset = getSectionScrollOffset('market');
    if (offset > 0 && !cargandoMuro) {
      isRestoringScroll.current = true;
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset, animated: false });
        setTimeout(() => { isRestoringScroll.current = false; }, 100);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [cargandoMuro]);

  // Cargar Partidos cuando cambia la provincia
  useEffect(() => {
    setPartido('');
    setLocalidad('');
    if (provincia) cargarPartidos(provincia);
  }, [provincia]);

  // Cargar Localidades cuando cambia el partido
  useEffect(() => {
    if (partido && provincia) {
      cargarLocalidades(partido, provincia);
    }
  }, [partido, provincia]);

  const cargarPartidos = (prov) => setPartidos(obtenerPartidosDeProvincia(prov));

  const cargarLocalidades = (part, prov) => setLocalidades(obtenerLocalidadesDePartido(part, prov));

  const productosFiltrados = useMemo(() => {
    return productos.filter(p => {
      if (terminoBusqueda && !p.titulo?.toLowerCase().includes(terminoBusqueda.toLowerCase())) return false;
      if (provincia && p.provincia !== provincia) return false;
      if (partido && p.partido !== partido) return false;
      if (localidad && p.localidad !== localidad) return false;
      if (barrio && !p.barrio?.toLowerCase().includes(barrio.toLowerCase())) return false;
      return true;
    });
  }, [productos, terminoBusqueda, provincia, partido, localidad, barrio]);

  const dataProcesada = useMemo(() => procesarMuroMarket(productosFiltrados, seedRef.current), [productosFiltrados, refreshKey]);

  const handleToggleLike = async (item) => {
    if (!miUid) return;
    const yaTieneLike = item.likes?.includes(miUid);
    await toggleLikeProducto(item.id, yaTieneLike);
  };

  const handleShare = (item) => {
    setProductoACompartir({
      id: item.id,
      tipo: 'producto_market',
      titulo: item.titulo,
      imagen: item.fotos[0],
      subTitulo: `$${item.price || item.precio} - ${item.localidad || 'Merlo'}`
    });
    setMostrarCompartir(true);
  };

  const handleReset = () => {
    setRefreshing(true);
    seedRef.current = Date.now();
    setProvincia(''); setPartido(''); setLocalidad(''); setBarrio(''); setTerminoBusqueda('');
    setRefreshKey(prev => prev + 1);
    setSectionScrollOffset('market', 0);

    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, UI_CONSTANTS.SCROLL_DELAY);

    setTimeout(() => setRefreshing(false), UI_CONSTANTS.REFRESH_DURATION);
  };

  const handleScroll = (event) => {
    if (isRestoringScroll.current) return;
    const offset = event.nativeEvent.contentOffset.y;
    if (offset >= 0) {
      setSectionScrollOffset('market', offset);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/home')} style={styles.logoBtn}><HaloBrandIcon size={46} /></TouchableOpacity>

          <BotonReload
            label="Marketplace"
            onReload={handleReset}
            color="#FF6600"
            bgColor="#FFF7ED"
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => setMostrarBuscador(!mostrarBuscador)}>
              <Ionicons name="search" size={26} color="#111827" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/(marketplace)/marketPerfil')}>
               {perfil?.fotoUrl ? (
                 <Image source={{ uri: perfil.fotoUrl }} style={styles.miniAvatar} contentFit="cover" cachePolicy="memory-disk" />
               ) : (
                 <View style={[styles.miniAvatar, { backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' }]}>
                   <HaloUserIcon size={18} color="#FFF" />
                 </View>
               )}
            </TouchableOpacity>
          </View>
        </View>

        {mostrarBuscador && (
          <View style={styles.searchBarWrapper}>
             <View style={styles.inputSearchContainer}>
                <Ionicons name="search" size={18} color="#999" />
                <TextInput placeholder="¿Qué buscas?" style={styles.inputPrincipal} value={terminoBusqueda} onChangeText={setTerminoBusqueda} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {terminoBusqueda ? (
                    <TouchableOpacity onPress={() => setTerminoBusqueda('')}>
                      <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => setMostrarBuscador(false)} style={{ padding: 4 }}>
                    <Ionicons name="close" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
             </View>
             <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
                <FilterChip label={provincia || "Provincia"} active={!!provincia} onClear={() => {setProvincia(''); setPartido(''); setLocalidad(''); setBarrio('');}} onPress={() => setModalProvVisible(true)} />
                <FilterChip label={partido || (provincia === 'Buenos Aires' ? "Partido" : "Departamento")} active={!!partido} disabled={!provincia} onClear={() => {setPartido(''); setLocalidad(''); setBarrio('');}} onPress={() => setModalPartVisible(true)} />
                <FilterChip label={localidad || (provincia === 'Buenos Aires' ? "Localidad" : "Municipio")} active={!!localidad} disabled={!partido} onClear={() => {setLocalidad(''); setBarrio('');}} onPress={() => setModalLocVisible(true)} />

                <View style={styles.barrioSearchBox}>
                  <Ionicons name="business-outline" size={14} color={barrio ? "#FF6600" : "#9CA3AF"} />
                  <TextInput placeholder="Barrio..." style={styles.barrioSearchInput} value={barrio} onChangeText={setBarrio} placeholderTextColor="#9CA3AF" />
                  {barrio ? <TouchableOpacity onPress={() => setBarrio('')}><Ionicons name="close-circle" size={16} color="#9CA3AF" /></TouchableOpacity> : null}
                </View>
             </ScrollView>
          </View>
        )}
      </View>

      {cargandoMuro ? <View style={styles.center}><ActivityIndicator color="#FF6600" size="large" /></View> : (
        <FlatList
          ref={flatListRef}
          data={dataProcesada}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={() => (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 25, opacity: 0.8, paddingHorizontal: 20 }}>
               <HaloMarketIcon size={65} color="#374151" />
               <Text
                 style={{ fontSize: 14, fontWeight: '900', color: '#374151', letterSpacing: 1.5, marginTop: 8, textAlign: 'center' }}
                 numberOfLines={1}
                 ellipsizeMode="tail"
               >
                 MARKET - {perfil?.partido?.toUpperCase() || perfil?.localidad?.toUpperCase() || 'MERLO'}
               </Text>
            </View>
          )}
          keyExtractor={(item) => item.key}
          renderItem={({item}) => (
            item.type === 'ultra' ? <ProductCardUltra item={item.item} router={router} miUid={miUid} onLike={handleToggleLike} onShare={handleShare} /> :
            <View style={styles.rowGrid}>{item.items.map(sub => <ProductCard key={sub.id} item={sub} router={router} miUid={miUid} onLike={handleToggleLike} onShare={handleShare} />)}</View>
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          initialNumToRender={4}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleReset}
              colors={["#FF6600"]}
              tintColor="#FF6600"
              size="large"
              progressViewOffset={insets.top + 60}
            />
          }
        />
      )}

      <TouchableOpacity style={[styles.fab, { bottom: Math.max(80, insets.bottom + 20) }]} onPress={() => router.push('/(marketplace)/marketVender')}><View style={styles.fabIconBg}><Ionicons name="add" size={28} color="white" /></View><Text style={styles.fabText}>Vender algo</Text></TouchableOpacity>

      <SelectorModal visible={modalProvVisible} onClose={() => setModalProvVisible(false)} data={PROVINCIAS_ARGENTINA} onSelect={(i) => { setProvincia(i); setPartido(''); setLocalidad(''); setBarrio(''); setModalProvVisible(false); }} titulo="Provincia" />
      <SelectorModal visible={modalPartVisible} onClose={() => setModalPartVisible(false)} data={partidos} onSelect={(i) => { setPartido(i); setLocalidad(''); setBarrio(''); setModalPartVisible(false); }} titulo={provincia === 'Buenos Aires' ? "Partido" : "Departamento"} cargando={cargandoPart} />
      <SelectorModal visible={modalLocVisible} onClose={() => setModalLocVisible(false)} data={localidades} onSelect={(i) => { setLocalidad(i); setBarrio(''); setModalLocVisible(false); }} titulo={provincia === 'Buenos Aires' ? "Localidad" : "Municipio"} cargando={cargandoLoc} />

      {productoACompartir && (
        <SelectorCompartir
          visible={mostrarCompartir}
          onClose={() => { setMostrarCompartir(false); setProductoACompartir(null); }}
          contenido={productoACompartir}
        />
      )}
    </View>
  );
}

function FilterChip({ label, active, onPress, onClear, disabled }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive, disabled && { opacity: 0.4 }]} onPress={active && onClear ? onClear : onPress} disabled={disabled}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text><Ionicons name={active ? "close-circle" : "chevron-down"} size={14} color={active ? "#FFF" : "#9CA3AF"} style={{ marginLeft: 6 }} /></TouchableOpacity>
  );
}

function SelectorModal({ visible, onClose, data, onSelect, titulo, cargando }) {
  const [search, setSearch] = useState('');
  const filtrados = data.filter(i => i.toLowerCase().includes(search.toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" transparent><View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{titulo}</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#333" /></TouchableOpacity></View><View style={styles.modalSearch}><Ionicons name="search" size={18} color="#999" /><TextInput placeholder="Buscar..." style={styles.modalSearchInput} value={search} onChangeText={setSearch} /></View>
    {cargando ? <ActivityIndicator color="#FF6600" style={{margin: 20}} /> : <FlatList data={filtrados} keyExtractor={(i, idx) => `${i}-${idx}`} renderItem={({item}) => (<TouchableOpacity style={styles.modalItem} onPress={() => { onSelect(item); setSearch(''); }}><Text style={styles.modalItemText}>{item}</Text></TouchableOpacity>)} contentContainerStyle={{ paddingBottom: 60 }} />}</View></View></Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, height: 56 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  logoBtn: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  profileBtn: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', borderWidth: 1.5, borderColor: '#FF6600', backgroundColor: '#F3F4F6' },
  miniAvatar: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  searchBarWrapper: { paddingHorizontal: 15, paddingBottom: 15 },
  inputSearchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, height: 40, marginBottom: 12 },
  inputPrincipal: { flex: 1, fontSize: 14, color: '#111827' },
  filtersScroll: { flexDirection: 'row' },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#FF6600', borderColor: '#FF6600' },
  chipText: { fontSize: 13, color: '#4B5563', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  barrioSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 12, height: 36, borderWidth: 1, borderColor: '#E5E7EB' },
  barrioSearchInput: { fontSize: 13, color: '#111827', marginLeft: 6, width: 80 },
  rowGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  productCard: {
    width: (width - 20) / 2,
    height: CARD_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  imageWrapper: { width: '100%', height: 170 },
  productImage: { width: '100%', height: '100%' },
  productInfo: { padding: 10, paddingBottom: 16 },
  productPrice: { fontSize: 17, fontWeight: '900', color: '#111827' },
  productTitle: { fontSize: 16, color: '#000000', marginTop: 2, fontWeight: 'bold' },
  productLocation: { fontSize: 14, color: '#000000', marginTop: 4 },
  ultraCard: {
    marginHorizontal: 8,
    backgroundColor: '#F7F0D1',
    borderRadius: 26,
    marginBottom: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#C99B2F',
    elevation: 1,
    shadowColor: '#C99B2F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  ultraImageWrapper: {
    width: '100%',
    height: 220,
    backgroundColor: '#F3F4F6',
  },
  ultraImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
  },
  ultraInfo: {
    padding: 12,
    backgroundColor: '#F4E7B5',
  },
  ultraRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 2 },
  ultraPrice: { fontSize: 20, fontWeight: '900', color: '#000000' },
  ultraTitle: { fontSize: 16, fontWeight: 'bold', color: '#000000' },
  whatsappRoundBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', right: 20, backgroundColor: '#FF6600', flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 18, paddingVertical: 8, borderRadius: 30, elevation: 8 },
  fabIconBg: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  fabText: { color: 'white', fontWeight: '900', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', height: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 17, fontWeight: 'bold' },
  modalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, marginBottom: 10 },
  modalSearchInput: { flex: 1, height: 40, marginLeft: 8 },
  modalItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalItemText: { fontSize: 15 },
  likeBtnCard: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.3)', width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  cardActionsTop: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'column',
    gap: 8,
    zIndex: 5
  },
  ultraActionsTop: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'column',
    gap: 10,
    zIndex: 5
  },
  actionBtnCircle: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center'
  },
  actionBtnCircleSmall: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  impulsadoIconBadge: {
    // Deprecated in favor of PublicidadBadge
  },
});
