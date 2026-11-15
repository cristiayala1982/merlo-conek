import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, Dimensions, FlatList, Modal, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MenuOpciones from '../../components/barraNavegacion/MenuOpciones';
import SelectorCompartir from '../../components/compartir/SelectorCompartir';
import CardNativeAd from '../../components/home/CardNativeAd';
import MascotaCard from '../../components/huellitas/MascotaCard';
import { HaloBrandIcon, HaloOptionsIcon } from '../../components/icons/HaloIcons';
import SelectorOpcionesModal from '../../components/reportes/SelectorOpcionesModal';
import SelectorReporteModal from '../../components/reportes/SelectorReporteModal';
import BotonReload from '../../components/utilidades/BotonReload';
import { UI_CONSTANTS } from '../../constants/uiConstants';
import { obtenerPartidosDeProvincia, obtenerLocalidadesDePartido } from '../../constants/geografiaArgentina';
import { auth, db } from '../../firebaseConfig';
import { getSectionCache, getSectionScrollOffset, setSectionCache, setSectionScrollOffset } from '../../services/feedState';
import { enviarReporte, obtenerPerfilUsuario, borrarArchivoPorUrl } from '../../services/firebaseService';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 10) / 2;

const PROVINCIAS_ARGENTINA = [
  "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Ciudad Autónoma de Buenos Aires",
  "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
  "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
].sort();

export default function HuellitasIndex() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = React.useRef(null);
  const isRestoringScroll = React.useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mascotas, setMascotas] = useState(getSectionCache('huellitas'));
  const [loading, setLoading] = useState(mascotas.length === 0);
  const [miPerfil, setMiPerfil] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const [mostrarAmigos, setMostrarAmigos] = useState(false);

  // FILTROS DE UBICACIÓN (4 Niveles)
  const [mostrarBuscador, setMostrarBuscador] = useState(false);
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

  const [mostrarMenuOpciones, setMostrarMenuOpciones] = useState(false);
  const [mostrarMenuReporte, setMostrarMenuReporte] = useState(false);
  const [itemParaOpciones, setItemParaOpciones] = useState(null);
  const [mostrarCompartir, setMostrarCompartir] = useState(false);
  const [itemParaCompartir, setItemParaCompartir] = useState(null);
  const [fotoActiva, setFotoActiva] = useState(0);

  const miUid = auth.currentUser?.uid;
  const pathname = usePathname();

  useFocusEffect(
    useCallback(() => {
        // Al entrar a Huellitas, simplemente apagamos cualquier spinner visual.
        // No forzamos handleManualRefresh para mantener la persistencia total.
        const timer = setTimeout(() => {
          setRefreshing(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [])
  );

  useEffect(() => {
    if (miUid) obtenerPerfilUsuario(miUid, setMiPerfil);

    const subReload = DeviceEventEmitter.addListener('RELOAD_HUELLITAS', () => {
      handleManualRefresh();
    });

    return () => {
      subReload.remove();
    };
  }, [miUid]);

  const handleToggleLike = async (item) => {
    if (!miUid) return;
    const likes = item.likes || [];
    const loLikee = likes.includes(miUid);
    const docRef = doc(db, 'mascotas', item.id);
    try {
      await updateDoc(docRef, { likes: loLikee ? arrayRemove(miUid) : arrayUnion(miUid) });
    } catch (e) { console.log(e); }
  };

  const handleMoreOptions = (item) => {
    setItemParaOpciones(item);
    setMostrarMenuOpciones(true);
  };

  const confirmarEliminar = async () => {
    if (!itemParaOpciones) return;
    setMostrarMenuOpciones(false);
    Alert.alert("Eliminar", "¿Borrar este aviso?", [
      { text: "No", style: "cancel" },
      { text: "Sí, Borrar", style: "destructive", onPress: async () => {
        try {
          const item = itemParaOpciones;
          const docSnap = await getDoc(doc(db, 'mascotas', item.id));
          if (docSnap.exists()) {
            const data = docSnap.data();
            const todasLasFotos = [
              ...(data.fotos || []),
              ...(data.thumbnailLqUrls || []),
              data.foto,
              data.url
            ].filter(Boolean);
            for (const f of todasLasFotos) {
              await borrarArchivoPorUrl(f);
            }
          }
          await deleteDoc(doc(db, 'mascotas', item.id));
        } catch (e) {
          Alert.alert("Error", "No se pudo eliminar el aviso.");
        }
      }}
    ]);
  };

  const ejecutarReportar = async (motivo) => {
    if (!itemParaOpciones) return;
    setMostrarMenuReporte(false);
    setMostrarMenuOpciones(false);
    try {
      await enviarReporte({
        tipo: 'huellita',
        idContenido: itemParaOpciones.id,
        idAutor: itemParaOpciones.userId,
        motivo,
        textoOpcional: itemParaOpciones.nombre || itemParaOpciones.especie,
        extraData: {
          nombre: itemParaOpciones.nombre,
          especie: itemParaOpciones.especie,
          estado: itemParaOpciones.estado,
          fotos: itemParaOpciones.fotos,
          userName: itemParaOpciones.userName
        }
      });
      Alert.alert("Gracias", "Tu reporte ha sido enviado.");
    } catch (e) { console.log(e); }
  };

  const obtenerOpcionesMenu = () => {
    if (!itemParaOpciones) return [];
    const esMio = itemParaOpciones.userId === miUid;

    if (esMio) {
      return [
        {
          label: 'Editar aviso',
          icon: 'create-outline',
          color: '#374151',
          onPress: () => router.push({ pathname: '/huellitas/nuevo', params: { editId: itemParaOpciones.id } })
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
          label: 'Reportar aviso',
          icon: 'flag-outline',
          color: '#EF4444',
          onPress: () => setMostrarMenuReporte(true)
        }
      ];
    }
  };

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'ad') {
      return (
        <View style={styles.adRowContainer}>
          <CardNativeAd compact={true} />
        </View>
      );
    }

    return (
      <View style={styles.pairRowContainer}>
        {item.items.map((pet) => (
          <MascotaCard
            key={pet.id}
            item={pet}
            miUid={miUid}
            onPress={(it) => router.push({ pathname: '/huellitas/detalle', params: { petId: it.id } })}
            onLike={handleToggleLike}
            onMore={handleMoreOptions}
            onShare={(it) => { setItemParaCompartir(it); setMostrarCompartir(true); }}
          />
        ))}
        {item.items.length === 1 && <View style={{ width: ITEM_WIDTH }} />}
      </View>
    );
  }, [miUid]);

  useEffect(() => {
    setPartido('');
    setLocalidad('');
    if (provincia) cargarPartidos(provincia);
  }, [provincia]);

  useEffect(() => {
    if (partido && provincia) cargarLocalidades(partido, provincia);
  }, [partido, provincia]);

  const cargarPartidos = (prov) => setPartidos(obtenerPartidosDeProvincia(prov));

  const cargarLocalidades = (part, prov) => setLocalidades(obtenerLocalidadesDePartido(part, prov));

  useEffect(() => {
    let q = collection(db, 'mascotas');
    const constraints = [orderBy('createdAt', 'desc')];

    // Filtros de servidor opcionales
    if (provincia) constraints.push(where('provincia', '==', provincia));
    if (partido) constraints.push(where('partido', '==', partido));

    const unsub = onSnapshot(query(q, ...constraints), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const ahora = Date.now();
      const tiempoExpiracionMs = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos para prueba APK

      data.forEach(async (aviso) => {
        const creadoEn = aviso.createdAt?.toMillis ? aviso.createdAt.toMillis() : aviso.createdAt;
        if (creadoEn && (ahora - creadoEn > tiempoExpiracionMs)) {
          try {
            const todasLasFotos = [
              ...(aviso.fotos || []),
              ...(aviso.thumbnailLqUrls || []),
              aviso.foto,
              aviso.url
            ].filter(Boolean);
            for (const f of todasLasFotos) {
              await borrarArchivoPorUrl(f).catch(() => {});
            }
            await deleteDoc(doc(db, 'mascotas', aviso.id));
            console.log(`[HUELLITAS AUTO-BORRADO] Aviso ${aviso.id} expirado a los 5 min y fotos eliminadas de R2.`);
          } catch (e) { console.log("Error borrando aviso expirado de huellitas:", e); }
        }
      });

      setMascotas(data.filter(a => {
        const creadoEn = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt;
        return !creadoEn || (ahora - creadoEn <= tiempoExpiracionMs);
      }));
      setSectionCache('huellitas', data);
      setLoading(false);
      setRefreshing(false);
    });
    return () => unsub();
  }, [provincia, partido]);

  // Restaurar scroll al montar
  useEffect(() => {
    const offset = getSectionScrollOffset('huellitas');
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
    const filtered = mascotas.filter(m => {
      if (filtroEstado !== 'todos' && m.estado !== filtroEstado) return false;
      if (localidad && m.localidad !== localidad) return false;
      if (barrioFiltro && !m.barrio?.toLowerCase().includes(barrioFiltro.toLowerCase())) return false;
      return true;
    });

    const rows = [];
    let currentPair = [];
    let petCount = 0;

    filtered.forEach((pet) => {
      currentPair.push(pet);
      petCount++;

      if (currentPair.length === 2) {
        rows.push({ id: `pair-${pet.id}`, type: 'pair', items: currentPair });
        currentPair = [];
      }

      if (petCount % 4 === 0) {
        rows.push({ id: `ad-${petCount}`, type: 'ad' });
      }
    });

    if (currentPair.length > 0) {
      rows.push({ id: `pair-${currentPair[0].id}`, type: 'pair', items: currentPair });
    }

    return rows;
  }, [mascotas, filtroEstado, localidad, barrioFiltro, refreshKey]);

  const handleManualRefresh = (resetScroll = true) => {
    setProvincia(''); setPartido(''); setLocalidad(''); setBarrioFiltro(''); setFiltroEstado('todos');
    setMostrarBuscador(false); setRefreshKey(p => p + 1); setRefreshing(true);
    if (resetScroll) {
        setSectionScrollOffset('huellitas', 0);
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
      setSectionScrollOffset('huellitas', offset);
    }
  };

  const irAlChat = (item) => {
    const msg = `🐾 [HUELLITAS] ¡Hola! Te contacto por la mascota "${item.nombre || item.especie}" en ${item.localidad}.`;
    setItemSeleccionado(null);
    router.push({ pathname: '/chats', params: { userId: item.userId, prefilledMsg: msg } });
  };

  const renderFilters = () => (
    <View style={styles.headerContainer}>
      {mostrarBuscador && (
        <View style={styles.locationFilters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.locationScroll}>
            <FilterChip label={provincia || "Provincia"} active={!!provincia} onClear={()=>{setProvincia('');setPartido('');setLocalidad('');setBarrioFiltro('');}} onPress={()=>setModalProvVisible(true)} />
            <FilterChip label={partido || (provincia === 'Buenos Aires' ? "Partido" : "Departamento")} active={!!partido} disabled={!provincia} onClear={()=>{setPartido('');setLocalidad('');setBarrioFiltro('');}} onPress={()=>setModalPartVisible(true)} />
            <FilterChip label={localidad || (provincia === 'Buenos Aires' ? "Localidad" : "Municipio")} active={!!localidad} disabled={!partido} onClear={()=>{setLocalidad('');setBarrioFiltro('');}} onPress={()=>setModalLocVisible(true)} />

            <View style={styles.miniInputContainer}>
              <Ionicons name="business-outline" size={14} color={barrioFiltro ? "#10B981" : "#9CA3AF"} style={{ marginLeft: 8 }} />
              <TextInput placeholder="Barrio..." style={styles.miniInput} value={barrioFiltro} onChangeText={setBarrioFiltro} placeholderTextColor="#9CA3AF" />
              {barrioFiltro ? <TouchableOpacity onPress={()=>setBarrioFiltro('')} style={{padding:4}}><Ionicons name="close-circle" size={16} color="#9CA3AF" /></TouchableOpacity> : null}
            </View>
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusScrollInside}>
            <StatusChip label="Perdidos" active={filtroEstado === 'perdido'} onPress={()=>setFiltroEstado(filtroEstado==='perdido'?'todos':'perdido')} color="#EF4444" />
            <StatusChip label="Vistos" active={filtroEstado === 'encontrado'} onPress={()=>setFiltroEstado(filtroEstado==='encontrado'?'todos':'encontrado')} color="#3B82F6" />
            <StatusChip label="Adopción" active={filtroEstado === 'adopcion'} onPress={()=>setFiltroEstado(filtroEstado==='adopcion'?'todos':'adopcion')} color="#10B981" />
            <StatusChip label="Reencuentros" active={filtroEstado === 'reencuentro'} onPress={()=>setFiltroEstado(filtroEstado==='reencuentro'?'todos':'reencuentro')} color="#8B5CF6" />
          </ScrollView>
        </View>
      )}
      {!mostrarBuscador && <View style={styles.decorativePawRow}><View style={styles.pawLine} /><Ionicons name="paw" size={40} color="#10B981" /><View style={styles.pawLine} /></View>}
    </View>
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.customHeader, { paddingTop: insets.top, height: 56 + insets.top }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4 }}>
          <TouchableOpacity onPress={()=>router.replace('/(tabs)/home')} style={styles.logoBtn}><HaloBrandIcon size={46} /></TouchableOpacity>

          <BotonReload
            label="Huellitas"
            onReload={handleManualRefresh}
            color="#065F46"
            bgColor="#DCFCE7"
          />

          <View style={styles.headerRight}>
             <TouchableOpacity style={styles.headerActionBtn} onPress={()=>setMostrarBuscador(!mostrarBuscador)}><Ionicons name={mostrarBuscador?"close":"search"} size={26} color={mostrarBuscador?"#10B981":"#333"} /></TouchableOpacity>
             <TouchableOpacity style={styles.headerActionBtn} onPress={()=>setMostrarMenu(true)}><HaloOptionsIcon size={30} color="#333" /></TouchableOpacity>
          </View>
        </View>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#10B981" /></View> : (
        <FlatList ref={flatListRef} data={dataProcesada} keyExtractor={item=>item.id} renderItem={renderItem} contentContainerStyle={styles.listContent} ListHeaderComponent={renderFilters()}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleManualRefresh} colors={["#10B981"]} tintColor="#10B981" size="large" progressViewOffset={56+insets.top} />}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="paw" size={50} color="#EEE" /><Text style={styles.emptyTxt}>No hay avisos.</Text></View>}
        />
      )}

      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={()=>router.push('/huellitas/nuevo')}><Ionicons name="add" size={30} color="white" /></TouchableOpacity>

      <SelectorModal visible={modalProvVisible} onClose={()=>setModalProvVisible(false)} data={PROVINCIAS_ARGENTINA} onSelect={(i)=>{setProvincia(i);setPartido('');setLocalidad('');setModalProvVisible(false);}} titulo="Provincia" />
      <SelectorModal visible={modalPartVisible} onClose={()=>setModalPartVisible(false)} data={partidos} onSelect={(i)=>{setPartido(i);setLocalidad('');setModalPartVisible(false);}} titulo={provincia === 'Buenos Aires' ? "Partido" : "Departamento"} cargando={cargandoPart} />
      <SelectorModal visible={modalLocVisible} onClose={()=>setModalLocVisible(false)} data={localidades} onSelect={(i)=>{setLocalidad(i);setModalLocVisible(false);}} titulo={provincia === 'Buenos Aires' ? "Localidad" : "Municipio"} cargando={cargandoLoc} />

      {itemParaCompartir && <SelectorCompartir visible={mostrarCompartir} onClose={() => { setMostrarCompartir(false); setItemParaCompartir(null); }} contenido={{ id: itemParaCompartir.id, tipo: 'huellita', titulo: itemParaCompartir.nombre || itemParaCompartir.especie, imagen: itemParaCompartir.fotos?.[0], subTitulo: itemParaCompartir.userName }} />}

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

      <Modal visible={mostrarMenu} transparent animationType="fade">
        <TouchableOpacity
          style={[styles.menuOverlayModal, { paddingTop: 56 + insets.top }]}
          activeOpacity={1}
          onPress={() => setMostrarMenu(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <MenuOpciones
              onClose={() => setMostrarMenu(false)}
              onOpenAmigos={() => { setMostrarMenu(false); setMostrarAmigos(true); }}
              perfil={miPerfil}
            />
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function StatusChip({ label, active, onPress, color }) {
  return (<TouchableOpacity style={[styles.statusChip, active && { backgroundColor: color, borderColor: color }]} onPress={onPress}><Text style={[styles.statusChipText, active && { color: 'white' }]}>{label}</Text></TouchableOpacity>);
}

function FilterChip({ label, active, onPress, onClear, disabled }) {
  return (<TouchableOpacity style={[styles.locationChip, active && styles.locationChipActive, disabled && {opacity:0.4}]} onPress={active?onClear:onPress} disabled={disabled}><Text style={[styles.locationChipText, active && styles.locationChipTextActive]} numberOfLines={1}>{label}</Text><Ionicons name={active?"close-circle":"chevron-down"} size={16} color={active?"#FFF":"#9CA3AF"} style={{marginLeft:6}}/></TouchableOpacity>);
}

function SelectorModal({ visible, onClose, data, onSelect, titulo, cargando }) {
  const [search, setSearch] = useState('');
  const filtrados = data.filter(i => i.toLowerCase().includes(search.toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" transparent><View style={styles.selModalOverlay}><View style={styles.selModalContent}>
    <View style={styles.selModalHeader}><Text style={styles.selModalTitle}>{titulo}</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#333" /></TouchableOpacity></View>
    <View style={styles.selModalSearch}><Ionicons name="search" size={18} color="#999" /><TextInput placeholder="Buscar..." style={styles.selModalSearchInput} value={search} onChangeText={setSearch} /></View>
    {cargando ? <ActivityIndicator color="#10B981" style={{margin: 20}} /> : <FlatList data={filtrados} keyExtractor={(item, index) => `${item}-${index}`} renderItem={({item}) => (<TouchableOpacity style={styles.selModalItem} onPress={() => { onSelect(item); setSearch(''); }}><Text style={styles.selModalItemText}>{item}</Text></TouchableOpacity>)} contentContainerStyle={{ paddingBottom: 60 }} />}
    </View></View></Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE'
  },
  logoBtn: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  headerTitleBtn: { backgroundColor: '#DCFCE7', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20, flex: 1, marginHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#10B981' },
  headerTitleMain: { fontSize: 16, fontWeight: '900', color: '#065F46' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerActionBtn: { padding: 4 },
  locationFilters: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: 'white' },
  locationScroll: { paddingHorizontal: 15, gap: 10, marginBottom: 12 },
  miniInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', height: 40, minWidth: 140, paddingRight: 8 },
  miniInput: { flex: 1, fontSize: 13, color: '#111827', paddingHorizontal: 8, paddingVertical: 0 },
  statusScrollInside: { paddingHorizontal: 15, gap: 10 },
  locationChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, height: 40, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  locationChipActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  locationChipText: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  locationChipTextActive: { color: 'white' },
  statusChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F3F4F6' },
  statusChipText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  listContent: { paddingHorizontal: 5, paddingBottom: 120 },
  pairRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  adRowContainer: {
    width: '100%',
    marginVertical: 6,
  },
  columnWrapper: { justifyContent: 'space-between' },
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyTxt: { color: '#9CA3AF', marginTop: 10 },
  modalMain: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeaderDetalle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  modalBodyDetalle: { flex: 1 },
  modalContentDetalle: { padding: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  modalUserLoc: { fontSize: 14, color: '#6B7280', fontWeight: '700', marginLeft: 6, flex: 1 },
  dataContainer: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10, marginBottom: 15 },
  dataLabel: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 4 },
  dataValue: { fontWeight: '500', color: '#6B7280' },
  btnChatCompactDetalle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', padding: 15, borderRadius: 12, justifyContent: 'center', marginTop: 20 },
  estadoBadgeDetalle: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 10 },
  estadoBadgeTextDetalle: { color: 'white', fontWeight: '900', fontSize: 12 },
  modalTitleDetail: { fontSize: 24, fontWeight: '900', color: '#111827', marginBottom: 5 },
  modalDescDetail: { fontSize: 16, color: '#374151', lineHeight: 24 },
  selModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  selModalContent: { backgroundColor: 'white', height: '80%', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20 },
  selModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  selModalTitle: { fontSize: 18, fontWeight: 'bold' },
  selModalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, height: 46 },
  selModalSearchInput: { flex: 1, marginLeft: 10 },
  selModalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  selModalItemText: { fontSize: 16, color: '#333' },
  menuOverlayModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start' },
  decorativePawRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15, paddingHorizontal: 40, marginVertical: 20 },
  pawLine: { flex: 1, height: 1, backgroundColor: '#F3F4F6' }
});
