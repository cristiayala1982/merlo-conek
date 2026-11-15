import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter, FlatList, Platform, RefreshControl, StyleSheet, View, Text, TouchableOpacity, TextInput, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CardAlerta from '../../components/alertas/CardAlerta';
import { Navbar } from '../../components/barraNavegacion/Navbar';
import CardNativeAd from '../../components/home/CardNativeAd';
import ComentariosModal from '../../components/home/ComentariosModal';
import CrearPost from '../../components/home/CrearPost';
import { UI_CONSTANTS } from '../../constants/uiConstants';
import { obtenerLocalidadesDePartido } from '../../constants/geografiaArgentina';
import { auth, db } from '../../firebaseConfig';
import { getSectionCache, getSectionScrollOffset, setSectionCache, setSectionScrollOffset } from '../../services/feedState';
import { obtenerPerfilUsuario, borrarArchivoPorUrl, borrarPostConComentarios } from '../../services/firebaseService';
import { getWeatherCache, setWeatherCache } from '../../services/weatherService';

export default function AlertasIndex() {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);
  const isRestoringScroll = useRef(false);
  const [alertas, setAlertas] = useState(getSectionCache('alertas'));
  const [ghostAlertas, setGhostAlertas] = useState([]); // Alertas en proceso de subida
  const [miPerfil, setMiPerfil] = useState(null);
  const [cargandoAlertas, setCargandoAlertas] = useState(alertas.length === 0);
  const [clima, setClima] = useState(() => {
    // Iniciamos con el cache si existe para que sea instantáneo
    return getWeatherCache() || { temp: '--', icon: 'sunny', ciudad: '' };
  });
  const [filtro, setFiltro] = useState('todo'); // 'todo', 'alertas', 'general'
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [postSeleccionado, setPostSeleccionado] = useState(null);
  const [refreshing, setRefreshing] = useState(false); // Iniciar en false para no parpadear al entrar
  const [refreshKey, setRefreshKey] = useState(0);

  // Estados para el buscador geográfico
  const [localidadFiltro, setLocalidadFiltro] = useState('');
  const [barrioFiltro, setBarrioFiltro] = useState('');
  const [modalLocVisible, setModalLocVisible] = useState(false);
  const [localidades, setLocalidades] = useState([]);
  const [cargandoLoc, setCargandoLoc] = useState(false);

  const cargarLocalidades = (part, prov) => {
    setLocalidades(obtenerLocalidadesDePartido(part, prov));
  };

  useEffect(() => {
    if (miPerfil?.provincia && (miPerfil?.partido || miPerfil?.localidad)) {
       cargarLocalidades(miPerfil.partido || miPerfil.localidad, miPerfil.provincia);
    }
  }, [miPerfil?.provincia, miPerfil?.partido, miPerfil?.localidad]);

  const handleManualRefresh = useCallback((resetScroll = true) => {
    setRefreshing(true);
    setRefreshKey(p => p + 1);
    if (resetScroll) {
        setSectionScrollOffset('alertas', 0);
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, UI_CONSTANTS.SCROLL_DELAY);
    }
    // Usar la constante global para el tiempo visual
    setTimeout(() => setRefreshing(false), UI_CONSTANTS.REFRESH_DURATION);
  }, []);

  const refreshColor = filtro === 'alertas' ? '#EF4444' : filtro === 'general' ? '#3B82F6' : '#FF6600';

  useFocusEffect(
    useCallback(() => {
        // Al entrar a Alertas, ya NO forzamos el refresh automático.
        // Esto permite que el usuario mantenga su lugar al navegar.

        if (alertas.length === 0) {
            handleManualRefresh(false);
        } else {
            const timer = setTimeout(() => setRefreshing(false), 300);
            return () => clearTimeout(timer);
        }
    }, [handleManualRefresh, alertas.length])
  );

  useEffect(() => {
    // --- ESCUCHA DE SUBIDAS (GHOST ALERTAS) ---
    const subStart = DeviceEventEmitter.addListener('ON_POST_UPLOAD_START', (data) => {
      if (data.esAlerta) setGhostAlertas(prev => [{ ...data, startTime: Date.now() }, ...prev]);
    });

    const subProgress = DeviceEventEmitter.addListener('ON_POST_UPLOAD_PROGRESS', ({ progress }) => {
      setGhostAlertas(prev => prev.map(p => ({ ...p, uploadProgress: progress })));
    });

    const subEnd = DeviceEventEmitter.addListener('ON_POST_UPLOAD_END', () => {
      setGhostAlertas(prev => prev.map(p => ({ ...p, status: 'ready', uploadProgress: 100 })));
      setTimeout(() => {
        setGhostAlertas(prev => prev.filter(p => (Date.now() - (p.startTime || 0)) < 15000));
      }, 15000);
    });

    const uid = auth.currentUser?.uid;
    if (uid) {
      obtenerPerfilUsuario(uid, setMiPerfil);
    }

    // Responder a la Navbar cuando pregunta en qué modo estamos
    const subQuery = DeviceEventEmitter.addListener('QUERY_NAVBAR_MODE', () => {
      DeviceEventEmitter.emit('SET_NAVBAR_MODE', 'alertas');
    });

    // Escuchar filtros desde la Navbar
    const subFilter = DeviceEventEmitter.addListener('SET_COMMUNITY_FILTER', (type) => {
      setFiltro(type);
      // Solo refrescamos manualmente si estamos cambiando de pestaña/filtro
      handleManualRefresh(true);
    });

    const subReload = DeviceEventEmitter.addListener('RELOAD_COMMUNITY', () => {
      handleManualRefresh();
    });

    // NO avisar a la Navbar automáticamente con SET_COMMUNITY_FILTER al entrar,
    // para evitar el reload innecesario.
    DeviceEventEmitter.emit('SET_NAVBAR_MODE', 'alertas');

    return () => {
      subStart.remove();
      subProgress.remove();
      subEnd.remove();
      subFilter.remove();
      subQuery.remove();
      subReload.remove();
    };
  }, [handleManualRefresh]);

  useEffect(() => {
    if (!miPerfil) return;

    // Determinamos el partido para filtrar (compatibilidad con campo 'localidad' del perfil)
    const partidoFiltro = miPerfil.partido || miPerfil.localidad;
    if (!partidoFiltro) return;

    let q = query(
      collection(db, 'alertas_comunitarias'),
      where('provincia', '==', miPerfil.provincia),
      where('partido', '==', partidoFiltro),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    // Aplicar filtros si no es 'todo'
    if (filtro === 'alertas') {
      q = query(q, where('tipo', '==', 'Alerta'));
    } else if (filtro === 'general') {
      q = query(q, where('tipo', '==', 'General'));
    }

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // --- LÓGICA DE AUTO-BORRADO (7 DÍAS PARA PRUEBA APK) ---
      const ahora = Date.now();
      const tiempoExpiracionMs = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos para prueba APK

      data.forEach(async (alerta) => {
        const creadoEn = alerta.createdAt?.toMillis ? alerta.createdAt.toMillis() : alerta.createdAt;
        if (creadoEn && (ahora - creadoEn > tiempoExpiracionMs)) {
          // Si es mas vieja de 5 minutos, la borramos en silencio limpia
          try {
            if (alerta.url) await borrarArchivoPorUrl(alerta.url).catch(() => {});
            if (alerta.thumbnailUrl) await borrarArchivoPorUrl(alerta.thumbnailUrl).catch(() => {});
            if (alerta.thumbnailLqUrl) await borrarArchivoPorUrl(alerta.thumbnailLqUrl).catch(() => {});
            await borrarPostConComentarios(alerta.id, 'alertas_comunitarias');
            console.log(`[ALERTAS AUTO-BORRADO] Alerta ${alerta.id} expirada a los 5 min, borrada de R2 y comentarios limpios.`);
          } catch (e) { console.log("Error borrando alerta vieja:", e); }
        }
      });

      const alertasPublicas = data.filter(alerta => !['pendiente_revision', 'rechazado', 'rechazado_visto'].includes(alerta.status));
      setAlertas(alertasPublicas.filter(alerta => {
        const creadoEn = alerta.createdAt?.toMillis ? alerta.createdAt.toMillis() : alerta.createdAt;
        return !creadoEn || (ahora - creadoEn <= tiempoExpiracionMs);
      }));
      setSectionCache('alertas', alertasPublicas);
      setCargandoAlertas(false);
    });

    return () => unsub();
  }, [miPerfil, filtro]);

  // Restaurar scroll al montar
  useEffect(() => {
    const offset = getSectionScrollOffset('alertas');
    if (offset > 0 && !cargandoAlertas) {
      isRestoringScroll.current = true;
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset, animated: false });
        setTimeout(() => { isRestoringScroll.current = false; }, 100);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [cargandoAlertas]);

  useEffect(() => {
    const fetchClima = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        // 1. Intentamos obtener la última posición conocida (es instantáneo)
        let loc = await Location.getLastKnownPositionAsync({});

        // Si no hay última conocida, recién ahí pedimos la actual (pero con baja precisión para que sea rápido)
        if (!loc) {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }

        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.coords.latitude}&longitude=${loc.coords.longitude}&current_weather=true`);
        const data = await res.json();

        if (data.current_weather) {
          const geo = await Location.reverseGeocodeAsync(loc.coords);
          const ciudadActual = geo[0]?.city || geo[0]?.subregion || "";

          const nuevoClima = {
            temp: Math.round(data.current_weather.temperature),
            icon: 'partly-sunny',
            ciudad: ciudadActual
          };

          setClima(nuevoClima);
          setWeatherCache(nuevoClima); // Guardamos en memoria para que la próxima entrada sea instantánea
        }
      } catch (e) { console.log("Error Clima:", e); }
    };
    fetchClima();
  }, []);

  const combinedAlertas = useMemo(() => {
    // FILTRO ANTI-DUPLICADOS: Ocultar ghost alerta si ya llegó la alerta real de Firestore (por ID, texto o tiempo)
    const filteredGhosts = ghostAlertas.filter(ghost => {
      return !alertas.some(a => {
        if (a.userId !== ghost.userId) return false;
        if (a.id === ghost.id) return true;
        if (ghost.texto && a.texto && a.texto === ghost.texto) return true;
        if (ghost.url && a.url && a.url === ghost.url) return true;
        const alertTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Date.now());
        return (ghost.startTime && alertTime >= (ghost.startTime - 2000));
      });
    });

    const base = [...filteredGhosts, ...alertas];
    const conAds = [];
    let contador = 0;

    base.forEach((item, index) => {
      conAds.push(item);
      contador++;

      // Inyectar publicidad cada 3 elementos reales
      if (contador % 3 === 0 && index < base.length - 1) {
        conAds.push({
          id: `ad-alertas-${index}`,
          type: 'ad'
        });
      }
    });

    return conAds.filter(item => {
      if (item.type === 'ad') return true;
      if (localidadFiltro && item.localidad !== localidadFiltro) return false;
      if (barrioFiltro && !item.barrio?.toLowerCase().includes(barrioFiltro.toLowerCase())) return false;
      return true;
    });
  }, [ghostAlertas, alertas, localidadFiltro, barrioFiltro]);

  const handleScroll = (event) => {
    if (isRestoringScroll.current) return;
    const offset = event.nativeEvent.contentOffset.y;
    if (offset >= 0) {
      setSectionScrollOffset('alertas', offset);
    }
  };

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'ad') {
      return <CardNativeAd />;
    }

    return (
      <CardAlerta
        item={item}
        onComentarOverride={() => {
          setPostSeleccionado(item);
          setMostrarComentarios(true);
        }}
      />
    );
  }, []);

  const renderFiltros = () => {
    if (!miPerfil) return null;
    const partidoFijo = miPerfil.partido || miPerfil.localidad || '';
    if (!partidoFijo) return null;

    const isBsAs = miPerfil.provincia === 'Buenos Aires';
    const labelLocalidad = isBsAs ? 'Localidad' : 'Municipio';

    return (
      <View style={styles.filtrosContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.locationScroll}>
          <View style={[styles.chip, styles.chipFijo]}>
            <Text style={styles.chipTxtFijo}>📍 {partidoFijo.toUpperCase()}</Text>
          </View>

          <TouchableOpacity
            style={[styles.chip, localidadFiltro ? styles.chipActive : null]}
            onPress={() => setModalLocVisible(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.chipTxt, localidadFiltro ? styles.chipTxtActive : null]}>
              {localidadFiltro || labelLocalidad}
            </Text>
            {localidadFiltro ? (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  setLocalidadFiltro('');
                  setBarrioFiltro('');
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ marginLeft: 6, padding: 2 }}
              >
                <Ionicons name="close-circle" size={16} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-down" size={14} color="#9CA3AF" style={{ marginLeft: 6 }} />
            )}
          </TouchableOpacity>

          <View style={styles.barrioSearchBox}>
            <Ionicons name="business-outline" size={14} color={barrioFiltro ? "#059669" : "#9CA3AF"} />
            <TextInput
              placeholder="Barrio..."
              style={styles.barrioSearchInput}
              value={barrioFiltro}
              onChangeText={setBarrioFiltro}
              placeholderTextColor="#9CA3AF"
            />
            {barrioFiltro ? (
              <TouchableOpacity onPress={() => setBarrioFiltro('')}>
                 <Ionicons name="close-circle" size={16} color="#9CA3AF" style={{marginLeft: 5}}/>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Navbar />
      <FlatList
        ref={flatListRef}
        data={combinedAlertas}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(item, index) => String(item.id || item.postId || `gh-${index}`)}
        renderItem={renderItem}
        ListHeaderComponent={
          <CrearPost
            modoAlertas={true}
            bloquearAlertas={!miPerfil?.localidad}
            clima={clima}
            perfil={miPerfil}
            childrenFiltro={renderFiltros()}
          />
        }
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={21}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleManualRefresh}
            colors={[refreshColor]}
            tintColor={refreshColor}
            size="large"
            progressViewOffset={56}
          />
        }
      />

      <ComentariosModal
        visible={mostrarComentarios}
        onClose={() => setMostrarComentarios(false)}
        post={alertas.find((p) => p.id === postSeleccionado?.id) || postSeleccionado}
        collectionName="alertas_comunitarias"
      />

      <SelectorModal
        visible={modalLocVisible}
        onClose={() => setModalLocVisible(false)}
        data={localidades}
        onSelect={(item) => { setLocalidadFiltro(item); setModalLocVisible(false); }}
        titulo={miPerfil?.provincia === 'Buenos Aires' ? "Selecciona Localidad" : "Selecciona Municipio"}
        cargando={cargandoLoc}
      />
    </View>
  );
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
  scrollContent: { paddingTop: 12 },
  filtrosContainer: { paddingHorizontal: 15, marginBottom: 15 },
  locationScroll: { gap: 8, paddingRight: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, height: 38, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  chipFijo: { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' },
  chipTxtFijo: { fontSize: 13, fontWeight: '800', color: '#059669' },
  chipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  chipTxt: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  chipTxtActive: { color: 'white' },
  barrioSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 10, height: 38, borderWidth: 1, borderColor: '#E5E7EB', minWidth: 120 },
  barrioSearchInput: { fontSize: 13, marginLeft: 6, width: 90, fontWeight: '700', color: '#111827' },

  modalOverlaySel: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContentSel: { backgroundColor: 'white', height: '80%', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20 },
  modalHeaderInner: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitleInner: { fontSize: 18, fontWeight: 'bold' },
  modalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, height: 46 },
  modalSearchInput: { flex: 1, marginLeft: 10 },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalItemText: { fontSize: 16, color: '#333' }
});
