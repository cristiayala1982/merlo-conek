import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, Dimensions, FlatList, Modal, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Navbar } from '../../../components/barraNavegacion/Navbar';
import SelectorCompartir from '../../../components/compartir/SelectorCompartir';
import SelectorOpcionesModal from '../../../components/reportes/SelectorOpcionesModal';
import SelectorReporteModal from '../../../components/reportes/SelectorReporteModal';
import PublicidadBadge from '../../../components/utilidades/PublicidadBadge';
import { UI_CONSTANTS } from '../../../constants/uiConstants';
import { auth, db } from '../../../firebaseConfig';
import { procesarMuroClasificadosV2 } from '../../../services/clasificadosAlgorithm';
import { setClasificadoPayload } from '../../../services/clasificadosState';
import { obtenerPartidosDeProvincia, obtenerLocalidadesDePartido } from '../../../constants/geografiaArgentina';
import { getSectionCache, getSectionScrollOffset, setSectionCache, setSectionScrollOffset } from '../../../services/feedState';
import { enviarReporte, obtenerPerfilUsuario, borrarArchivoPorUrl } from '../../../services/firebaseService';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 10) / 2;

const PROVINCIAS_ARGENTINA = [
  "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Ciudad Autónoma de Buenos Aires",
  "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
  "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
].sort();

const OficioCard = React.memo(({ item, onPress, miUid, onLike, onMore, onShare, router }) => {
  if (item.isAd) {
    return (
      <View style={styles.adCard}>
        <View style={styles.adBadge}><Text style={styles.adBadgeText}>Publicidad</Text></View>
        <Ionicons name="megaphone-outline" size={40} color="#9CA3AF" />
        <Text style={styles.adTitle}>Espacio Publicitario</Text>
      </View>
    );
  }

  const mainPhoto = item.fotosServicio?.[0] || item.fotoServicio;
  const likes = item.likes || [];
  const loLikee = miUid && likes.includes(miUid);
  const esPremium = item.esPremiumReal;

  const handlePress = () => {
    // 1. Guardar payload primero
    setClasificadoPayload(item);
    // 2. Navegar de inmediato sin esperar a nada
    router.push({
        pathname: '/alertas/clasificados/detalle',
        params: { postId: item.id, t: Date.now() }
    });
  };

  return (
    <TouchableOpacity
      style={[styles.card, esPremium && styles.cardPremium]}
      activeOpacity={0.7}
      onPress={handlePress}
      delayPressIn={0} // Respuesta táctil instantánea
    >
      <View style={styles.fixedHeightWrapper}>
        <View style={styles.imageContainer}>
          {mainPhoto ? (
            <Image source={{ uri: mainPhoto }} style={styles.cardImage} contentFit="cover" transition={200} />
          ) : (
            <View style={styles.placeholderImage}><Ionicons name="construct-outline" size={40} color="#D1D5DB" /></View>
          )}
          {esPremium && <PublicidadBadge />}
          <TouchableOpacity style={styles.cardMoreBtn} onPress={(e) => { e.stopPropagation(); onMore(item); }}>
            <Ionicons name="ellipsis-vertical" size={18} color="white" />
          </TouchableOpacity>
          {item.textoSobreMedia ? (
            <View style={styles.textOverlay}><Text style={styles.textOverlayContent} numberOfLines={2}>{item.textoSobreMedia}</Text></View>
          ) : null}
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.titulo}</Text>
          <View style={styles.barrioRow}>
            <Ionicons name="location" size={12} color="#6B7280" />
            <Text style={styles.cardBarrio} numberOfLines={1}>{item.provincia}, {item.partido}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.userRowMini}>
          {item.userPhoto ? (
            <Image source={{ uri: item.userPhoto }} style={styles.userAvatarMini} />
          ) : (
            <View style={styles.userAvatarPlaceholderMini}><Ionicons name="person" size={12} color="#9CA3AF" /></View>
          )}
          <Text style={styles.userNameMini} numberOfLines={1}>{item.userName}</Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.cardActionBtn} onPress={(e) => { e.stopPropagation(); onLike(item); }}>
            <Ionicons name={loLikee ? "heart" : "heart-outline"} size={22} color={loLikee ? "#FF6600" : "#6B7280"} />
            {likes.length > 0 && <Text style={[styles.likeCount, loLikee && { color: "#FF6600" }]}>{likes.length}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cardActionBtn} onPress={(e) => { e.stopPropagation(); onShare(item); }}>
            <Ionicons name="share-social-outline" size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function ClasificadosIndex() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);
  const isRestoringScroll = useRef(false);
  const seedRef = useRef(12345);

  const [oficios, setOficios] = useState(getSectionCache('clasificados'));
  const [loading, setLoading] = useState(oficios.length === 0);
  const [refreshing, setRefreshing] = useState(true); // Nace con el spinner activo para inmediatez
  const [miPerfil, setMiPerfil] = useState(null);
  const [ocultos, setOcultos] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [mostrarBuscador, setMostrarBuscador] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [provincia, setProvincia] = useState('');
  const [partido, setPartido] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [barrioFiltro, setBarrioFiltro] = useState('');

  const [modalProvVisible, setModalProvVisible] = useState(false);
  const [modalPartVisible, setModalPartVisible] = useState(false);
  const [modalLocVisible, setModalLocVisible] = useState(false);
  const [partidos, setPartidos] = useState([]);
  const [localidades, setLocalidades] = useState([]);
  const [cargandoPart, setCargandoPart] = useState(false);
  const [cargandoLoc, setCargandoLoc] = useState(false);

  const [itemSeleccionado, setItemSeleccionado] = useState(null);
  const [mostrarMenuOpciones, setMostrarMenuOpciones] = useState(false);
  const [mostrarMenuReporte, setMostrarMenuReporte] = useState(false);
  const [itemParaOpciones, setItemParaOpciones] = useState(null);
  const [mostrarCompartir, setMostrarCompartir] = useState(false);
  const [itemParaCompartir, setItemParaCompartir] = useState(null);

  const miUid = auth.currentUser?.uid;

  useFocusEffect(
    useCallback(() => {
        // Al entrar a Clasificados, ya NO forzamos el refresh automático.
        // Esto permite persistencia al navegar entre pestañas.
        const timer = setTimeout(() => {
          setRefreshing(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [])
  );

  useEffect(() => {
    if (miUid) obtenerPerfilUsuario(miUid, (data) => {
      setMiPerfil(data);
      setOcultos(data?.clasificadosOcultos || []);
    });

    const subReload = DeviceEventEmitter.addListener('RELOAD_CLASIFICADOS', () => {
      handleManualRefresh();
    });

    return () => {
      subReload.remove();
    };
  }, [miUid]);

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

  useEffect(() => {
    let q = collection(db, 'clasificados');
    const constraints = [orderBy('createdAt', 'desc')];
    if (provincia) constraints.push(where('provincia', '==', provincia));
    if (partido) constraints.push(where('partido', '==', partido));

    return onSnapshot(query(q, ...constraints), (snap) => {
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data = data.filter(i => (!i.status || i.status === 'ready') && (!i.publicidadPendiente || i.esPremium));
      setOficios(data);
      setSectionCache('clasificados', data);
      setLoading(false);
      setRefreshing(false);
    });
  }, [provincia, partido]);

  // Restaurar scroll al montar
  useEffect(() => {
    const offset = getSectionScrollOffset('clasificados');
    if (offset > 0 && !loading) {
      isRestoringScroll.current = true;
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset, animated: false });
        setTimeout(() => { isRestoringScroll.current = false; }, 100);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const dataProcesada = useMemo(() => {
    const filtrados = oficios.filter(i => {
      if (ocultos.includes(i.id)) return false;
      if (busqueda && !i.titulo?.toLowerCase().includes(busqueda.toLowerCase())) return false;
      if (localidad && i.localidad !== localidad) return false;
      if (barrioFiltro && !i.barrio?.toLowerCase().includes(barrioFiltro.toLowerCase())) return false;
      return true;
    });
    const lista = procesarMuroClasificadosV2(filtrados, seedRef.current);
    return lista;
  }, [oficios, busqueda, localidad, barrioFiltro, ocultos, refreshKey]);

  // MEDIDAS MATEMÁTICAS PARA CLASIFICADOS
  const CARD_HEIGHT_FIXED = 265;
  const getItemLayout = useCallback((data, index) => {
    const length = CARD_HEIGHT_FIXED;
    const offset = (CARD_HEIGHT_FIXED + 12) * Math.floor(index / 2); // 12 es el margen vertical aproximado
    return { length, offset, index };
  }, []);

  const handleManualRefresh = (resetScroll = true) => {
    seedRef.current = Date.now();
    setProvincia(''); setPartido(''); setLocalidad(''); setBarrioFiltro(''); setBusqueda('');
    setMostrarBuscador(false); setRefreshKey(p => p + 1);
    // Solo activamos refreshing visual, el onSnapshot se encargará de setRefreshing(false)
    setRefreshing(true);
    if (resetScroll) {
        setSectionScrollOffset('clasificados', 0);
        // Usamos un pequeño delay para asegurar que el FlatList esté listo para el scroll
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, UI_CONSTANTS.SCROLL_DELAY);
    }
    // Si por alguna razón onSnapshot no dispara, aseguramos el cierre
    setTimeout(() => setRefreshing(false), UI_CONSTANTS.REFRESH_DURATION);
  };

  const handleScroll = (event) => {
    if (isRestoringScroll.current) return;
    const offset = event.nativeEvent.contentOffset.y;
    if (offset >= 0) {
      setSectionScrollOffset('clasificados', offset);
    }
  };

  const handleToggleLike = async (item) => {
    if (!miUid) return;
    const likes = item.likes || [];
    const loLikee = likes.includes(miUid);
    try { await updateDoc(doc(db, 'clasificados', item.id), { likes: loLikee ? arrayRemove(miUid) : arrayUnion(miUid) }); } catch (e) {}
  };

  const ejecutarReportar = async (motivo) => {
    setMostrarMenuReporte(false);
    try {
      // Filtrar campos undefined para evitar error de Firebase
      const extraDataLimpio = {
        titulo: itemParaOpciones.titulo,
        localidad: itemParaOpciones.localidad,
        userName: itemParaOpciones.userName
      };
      
      // Eliminar campos undefined
      Object.keys(extraDataLimpio).forEach(key => {
        if (extraDataLimpio[key] === undefined) {
          delete extraDataLimpio[key];
        }
      });

      await enviarReporte({
        tipo: 'clasificado',
        idContenido: itemParaOpciones.id,
        idAutor: itemParaOpciones.userId,
        motivo,
        textoOpcional: itemParaOpciones.titulo,
        extraData: extraDataLimpio
      });
      Alert.alert("Gracias", "Tu reporte ha sido enviado para revisión.");
    } catch (e) {
      Alert.alert("Error", "No se pudo enviar el reporte.");
    }
  };

  const obtenerOpcionesMenu = () => {
    if (itemParaOpciones?.userId === miUid) {
      return [
        {
          label: 'Editar anuncio',
          icon: 'create-outline',
          color: '#374151',
          onPress: () => router.push({ pathname: '/alertas/clasificados/nuevo', params: { editId: itemParaOpciones.id } })
        },
        {
          label: 'Eliminar anuncio',
          icon: 'trash-outline',
          color: '#EF4444',
          onPress: () => Alert.alert("Eliminar", "¿Borrar?", [{ text: "No" }, { text: "Sí", style: "destructive", onPress: async () => {
            try {
              const item = itemParaOpciones;
              const todasLasFotos = [
                ...(item?.fotosServicio || []),
                ...(item?.thumbnailLqUrls || []),
                item?.fotoServicio,
                item?.thumbnailUrl,
                item?.url
              ].filter(Boolean);

              for (const f of todasLasFotos) {
                await borrarArchivoPorUrl(f);
              }
              await deleteDoc(doc(db, 'clasificados', item.id));
            } catch (e) {
              Alert.alert("Error", "No se pudo eliminar el anuncio.");
            }
          }}])
        }
      ];
    } else {
      return [
        {
          label: 'Reportar anuncio',
          icon: 'flag-outline',
          color: '#EF4444',
          onPress: () => setMostrarMenuReporte(true)
        }
      ];
    }
  };

  const renderHeader = () => (
    <View style={styles.headerFilters}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Clasificados</Text>
        <View style={styles.titleActions}>
          <TouchableOpacity
            style={[styles.headerIconBtn, mostrarBuscador && styles.headerIconBtnActive]}
            onPress={() => setMostrarBuscador(!mostrarBuscador)}
          >
            <Ionicons name="search" size={24} color={mostrarBuscador ? "#FFF" : "#059669"} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPublicarCircular} onPress={() => router.push('/alertas/clasificados/nuevo')}>
            <Ionicons name="add" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {mostrarBuscador && (
        <View style={styles.searchPanel}>
          <View style={styles.mainSearchInput}>
            <Ionicons name="search" size={18} color="#9CA3AF" style={{marginLeft: 10}}/>
            <TextInput placeholder="¿Qué servicio buscás?" style={styles.searchInput} value={busqueda} onChangeText={setBusqueda} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 10 }}>
              {busqueda ? (
                <TouchableOpacity onPress={() => setBusqueda('')}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => setMostrarBuscador(false)}>
                <Ionicons name="close" size={22} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.locationScroll}>
            <FilterChip label={provincia || "Provincia"} active={!!provincia} onClear={() => { setProvincia(''); setPartido(''); setLocalidad(''); }} onPress={() => setModalProvVisible(true)} />
            <FilterChip label={partido || (provincia === 'Buenos Aires' ? "Partido" : "Departamento")} active={!!partido} disabled={!provincia} onClear={() => { setPartido(''); setLocalidad(''); }} onPress={() => setModalPartVisible(true)} />
            <FilterChip label={localidad || (provincia === 'Buenos Aires' ? "Localidad" : "Municipio")} active={!!localidad} disabled={!partido} onClear={() => setLocalidad('')} onPress={() => setModalLocVisible(true)} />
            <View style={styles.barrioSearchBox}>
                <Ionicons name="business-outline" size={14} color={barrioFiltro ? "#059669" : "#9CA3AF"} />
                <TextInput placeholder="Barrio..." style={styles.barrioSearchInput} value={barrioFiltro} onChangeText={setBarrioFiltro} placeholderTextColor="#9CA3AF" />
            </View>
          </ScrollView>
        </View>
      )}

      <View style={styles.decoRow}>
          <View style={styles.decoContent}>
              <Text style={styles.decoText}>
                  Oficios <Text style={styles.ampersand}>&</Text> Servicios
              </Text>
              <View style={styles.decoIcons}>
                  <Ionicons name="hammer-outline" size={22} color="#059669" />
                  <Ionicons name="construct-outline" size={22} color="#059669" />
              </View>
          </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />
      <Navbar />

      <FlatList
        ref={flatListRef}
        data={dataProcesada}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : `item-${index}`}
        renderItem={({ item }) => (
          <OficioCard
            item={item}
            miUid={miUid}
            router={router}
            onPress={(it) => router.push({ pathname: '/alertas/clasificados/detalle', params: { postId: it.id } })}
            onLike={handleToggleLike}
            onMore={(it) => { setItemParaOpciones(it); setMostrarMenuOpciones(true); }}
            onShare={(it) => { setItemParaCompartir(it); setMostrarCompartir(true); }}
          />
        )}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={renderHeader()}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={21}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleManualRefresh} colors={["#059669"]} tintColor="#059669" size="large" progressViewOffset={56} />}
      />

      <SelectorModal visible={modalProvVisible} onClose={() => setModalProvVisible(false)} data={PROVINCIAS_ARGENTINA} onSelect={(i) => { setProvincia(i); setPartido(''); setLocalidad(''); setModalProvVisible(false); }} titulo="Provincia" />
      <SelectorModal visible={modalPartVisible} onClose={() => setModalPartVisible(false)} data={partidos} onSelect={(i) => { setPartido(i); setLocalidad(''); setModalPartVisible(false); }} titulo={provincia === 'Buenos Aires' ? "Partido" : "Departamento"} cargando={cargandoPart} />
      <SelectorModal visible={modalLocVisible} onClose={() => setModalLocVisible(false)} data={localidades} onSelect={(i) => { setLocalidad(i); setModalLocVisible(false); }} titulo={provincia === 'Buenos Aires' ? "Localidad" : "Municipio"} cargando={cargandoLoc} />

      {itemParaCompartir && <SelectorCompartir visible={mostrarCompartir} onClose={() => { setMostrarCompartir(false); setItemParaCompartir(null); }} contenido={{ id: itemParaCompartir.id, tipo: 'clasificado', titulo: itemParaCompartir.titulo, imagen: itemParaCompartir.fotosServicio?.[0], subTitulo: itemParaCompartir.userName }} />}

      {/* MODAL GLOBAL DE OPCIONES */}
      <SelectorOpcionesModal
        visible={mostrarMenuOpciones}
        onClose={() => setMostrarMenuOpciones(false)}
        titulo="Opciones del anuncio"
        opciones={obtenerOpcionesMenu()}
      />

      {/* MODAL GLOBAL DE REPORTE */}
      <SelectorReporteModal
        visible={mostrarMenuReporte}
        onClose={() => setMostrarMenuReporte(false)}
        onReportar={ejecutarReportar}
      />
    </View>
  );
}

function FilterChip({ label, active, onPress, onClear, disabled }) {
  return (<TouchableOpacity style={[styles.chip, active && styles.chipActive, disabled && { opacity: 0.4 }]} onPress={active ? onClear : onPress} disabled={disabled}><Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{label}</Text><Ionicons name={active ? "close-circle" : "chevron-down"} size={14} color={active ? "#FFF" : "#9CA3AF"} style={{ marginLeft: 6 }} /></TouchableOpacity>);
}

function SelectorModal({ visible, onClose, data, onSelect, titulo, cargando }) {
  const [search, setSearch] = useState('');
  const filtrados = data.filter(i => i.toLowerCase().includes(search.toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlaySel}><View style={styles.modalContentSel}>
          <View style={styles.modalHeaderInner}><Text style={styles.modalTitleInner}>{titulo}</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#333" /></TouchableOpacity></View>
          <View style={styles.modalSearch}><Ionicons name="search" size={18} color="#999" /><TextInput placeholder="Buscar..." style={styles.modalSearchInput} value={search} onChangeText={setSearch} /></View>
          {cargando ? <ActivityIndicator color="#059669" style={{ margin: 20 }} /> : <FlatList data={filtrados} keyExtractor={(item, index) => `${item}-${index}`} renderItem={({ item }) => (<TouchableOpacity style={styles.modalItem} onPress={() => { onSelect(item); setSearch(''); }}><Text style={styles.modalItemText}>{item}</Text></TouchableOpacity>)} contentContainerStyle={{ paddingBottom: 60 }} />}
      </View></View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerFilters: { paddingBottom: 15 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '900', color: '#111827' },
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DCFCE7' },
  headerIconBtnActive: { backgroundColor: '#059669', borderColor: '#059669' },
  btnPublicarCircular: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  searchPanel: { paddingHorizontal: 15, gap: 12 },
  mainSearchInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, height: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '600' },
  locationScroll: { gap: 10, paddingRight: 20, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, height: 40, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  chipTxt: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  chipTxtActive: { color: 'white' },
  barrioSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 10, height: 40, borderWidth: 1, borderColor: '#E5E7EB', minWidth: 120 },
  barrioSearchInput: { fontSize: 13, marginLeft: 6, width: 80, fontWeight: '700' },
  listContent: { paddingHorizontal: 5, paddingBottom: 120 },
  columnWrapper: { justifyContent: 'space-between' },
  card: { width: ITEM_WIDTH, backgroundColor: 'white', borderRadius: 12, marginBottom: 12, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  cardPremium: { borderColor: '#059669', borderWidth: 2, backgroundColor: '#F0FDF4' },
  imageContainer: { width: '100%', height: 130, backgroundColor: '#F9FAFB', position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  placeholderImage: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  premiumBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: '#059669', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, zIndex: 10 },
  premiumBadgeText: { color: 'white', fontSize: 8, fontWeight: '900', marginLeft: 3 },
  cardMoreBtn: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.3)', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', zIndex: 11 },
  textOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', padding: 6 },
  textOverlayContent: { color: 'white', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  cardContent: { padding: 8 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  barrioRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardBarrio: { fontSize: 11, color: '#6B7280', fontWeight: '700', marginLeft: 4 },
  fixedHeightWrapper: { height: 200, overflow: 'hidden' }, // Estabilizador de contenido
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8 },
  userRowMini: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 },
  userAvatarMini: { width: 32, height: 32, borderRadius: 16 },
  userAvatarPlaceholderMini: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  userNameMini: { fontSize: 13, color: '#374151', fontWeight: '800', flex: 1 },
  cardActions: { flexDirection: 'row', gap: 6 },
  cardActionBtn: { padding: 2, alignItems: 'center', justifyContent: 'center' },
  likeCount: { fontSize: 11, color: '#6B7280', fontWeight: 'bold', textAlign: 'center', marginTop: -2 },
  decoRow: { alignItems: 'center', justifyContent: 'center', marginVertical: 45 },
  decoContent: {
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#DCFCE7',
    elevation: 4,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  decoText: {
    fontSize: 22,
    color: '#065F46',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 8,
  },
  ampersand: {
    fontSize: 28,
    color: '#10B981',
    fontWeight: 'bold',
    fontStyle: 'normal',
  },
  decoIcons: { flexDirection: 'row', gap: 25, alignItems: 'center', marginTop: 5 },
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  adCard: { width: ITEM_WIDTH, height: 180, backgroundColor: '#F0F9FF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', padding: 10, borderWidth: 1, borderColor: '#BAE6FD' },
  adBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#0EA5E9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adBadgeText: { color: 'white', fontSize: 8, fontWeight: 'bold' },
  adTitle: { fontSize: 12, fontWeight: '800', color: '#0369A1', marginTop: 10 },
  adSubtitle: { fontSize: 9, color: '#0EA5E9', textAlign: 'center', marginTop: 4 },
  modalOverlaySel: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContentSel: { backgroundColor: 'white', height: '80%', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20 },
  modalHeaderInner: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitleInner: { fontSize: 18, fontWeight: 'bold' },
  modalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, height: 46 },
  modalSearchInput: { flex: 1, marginLeft: 10 },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalItemText: { fontSize: 16, color: '#333' }
});
