import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';
import { marcarHistoriasComoVistas, marcarSeccionComunidadVista, obtenerPerfilUsuario } from '../../services/firebaseService';
import { getShouldOpenStories, isLocalSeen, resetShouldOpenStories } from '../../services/storiesState';
import { getGlobalUserProfile, setGlobalUserProfile } from '../../services/userState';
import ContenedorHistorias from '../historias/ContenedorHistorias';
import {
    HaloBellIcon,
    HaloBrandIcon,
    HaloCameraIcon,
    HaloCloseIcon,
    HaloMarketIcon,
    HaloMessageIcon,
    HaloOptionsIcon,
    HaloUserIcon
} from '../icons/HaloIcons';
import MenuOpciones from './MenuOpciones';

export function Navbar({ closeSignal = 0 }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // MODO COMUNIDAD: Activado si estamos en la ruta de alertas
  const modoComunidad = pathname.includes('/alertas');

  const [mostrarHistorias, setMostrarHistorias] = useState(false);
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const [perfil, setPerfil] = useState(getGlobalUserProfile()); // Carga instantánea desde la memoria global
  const [chatsConPendientes, setChatsConPendientes] = useState(0);
  const [notificacionesSinLeer, setNotificacionesSinLeer] = useState(0);
  const [nuevasHistoriasCount, setNuevasHistoriasCount] = useState(0);
  const [rawStories, setRawStories] = useState([]);
  const [lastCheckLocal, setLastCheckLocal] = useState(0);
  const [estaOcupado, setEstaOcupado] = useState(false); // Bloqueo de cierre

  const [filtroComunidad, setFiltroComunidad] = useState('todo');

  const [novedadesComunidad, setNovedadesComunidad] = useState({
    alertas: false,
    general: false,
    clasificados: false
  });

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !perfil) return;

    // CONSULTA PROFESIONAL: Filtramos por tipo y ordenamos por fecha directamente en el servidor
    const qA = query(collection(db, 'alertas_comunitarias'), where('tipo', '==', 'Alerta'), orderBy('createdAt', 'desc'), limit(20));
    const unsubA = onSnapshot(qA, (snap) => {
      const checkTime = perfil.lastCheck_alertas?.toMillis ? perfil.lastCheck_alertas.toMillis() : 0;
      const latestPublicAlert = snap.docs.map(doc => doc.data()).find(item => !['pendiente_revision', 'rechazado', 'rechazado_visto'].includes(item.status));
      let hayNuevo = false;
      if (latestPublicAlert) {
        const time = latestPublicAlert.createdAt?.toMillis ? latestPublicAlert.createdAt.toMillis() : 0;
        hayNuevo = time > checkTime && !(pathname === '/alertas' && (filtroComunidad === 'todo' || filtroComunidad === 'alertas'));
      }
      setNovedadesComunidad(prev => ({ ...prev, alertas: hayNuevo }));
    });

    const qG = query(collection(db, 'alertas_comunitarias'), where('tipo', '==', 'General'), orderBy('createdAt', 'desc'), limit(20));
    const unsubG = onSnapshot(qG, (snap) => {
      const checkTime = perfil.lastCheck_general?.toMillis ? perfil.lastCheck_general.toMillis() : 0;
      const latestPublicGeneral = snap.docs.map(doc => doc.data()).find(item => !['pendiente_revision', 'rechazado', 'rechazado_visto'].includes(item.status));
      let hayNuevo = false;
      if (latestPublicGeneral) {
        const time = latestPublicGeneral.createdAt?.toMillis ? latestPublicGeneral.createdAt.toMillis() : 0;
        hayNuevo = time > checkTime && !(pathname === '/alertas' && (filtroComunidad === 'todo' || filtroComunidad === 'general'));
      }
      setNovedadesComunidad(prev => ({ ...prev, general: hayNuevo }));
    });

    const qC = query(collection(db, 'clasificados'), orderBy('createdAt', 'desc'), limit(1));
    const unsubC = onSnapshot(qC, (snap) => {
      const checkTime = perfil.lastCheck_clasificados?.toMillis ? perfil.lastCheck_clasificados.toMillis() : 0;
      let hayNuevo = false;
      if (!snap.empty) {
        const time = snap.docs[0].data().createdAt?.toMillis ? snap.docs[0].data().createdAt.toMillis() : 0;
        hayNuevo = time > checkTime && !pathname.includes('/clasificados');
      }
      setNovedadesComunidad(prev => ({ ...prev, clasificados: hayNuevo }));
    });

    return () => { unsubA(); unsubG(); unsubC(); };
  }, [perfil?.lastCheck_alertas, perfil?.lastCheck_general, perfil?.lastCheck_clasificados]);

  useEffect(() => {
    if (modoComunidad) {
        // Al entrar a la sección o cambiar de filtro, marcamos como visto
        if (pathname === '/alertas') {
            if (filtroComunidad === 'todo' || filtroComunidad === 'alertas') marcarSeccionComunidadVista('alertas');
            if (filtroComunidad === 'todo' || filtroComunidad === 'general') marcarSeccionComunidadVista('general');
        } else if (pathname.includes('/clasificados')) {
            marcarSeccionComunidadVista('clasificados');
        }
    }
  }, [pathname, filtroComunidad, modoComunidad]);

  const currentPathRef = useRef(pathname);
  useEffect(() => {
    currentPathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubPerfil = obtenerPerfilUsuario(uid, (data) => {
      setPerfil(data);
      setGlobalUserProfile(data); // Guardar en la memoria global para el resto de la app
    });
    const subClose = DeviceEventEmitter.addListener('CLOSE_NAV_PANELS', () => {
      setMostrarHistorias(false);
      setMostrarMenu(false);
    });
    const subOpen = DeviceEventEmitter.addListener('FORCE_OPEN_STORIES', () => {
      // Solo si esta es la instancia de la pantalla activa
      if (currentPathRef.current === pathname) {
        setMostrarHistorias(true);
      }
    });
    const subFilter = DeviceEventEmitter.addListener('SET_COMMUNITY_FILTER', (f) => {
      setFiltroComunidad(f);
    });
    const subBusy = DeviceEventEmitter.addListener('SET_STORY_BUSY', (val) => {
      setEstaOcupado(val);
    });
    return () => {
      unsubPerfil(); // Firestore unsub es una función, no tiene .remove()
      subClose.remove();
      subOpen.remove();
      subFilter.remove();
      subBusy.remove();
    };
  }, [pathname]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const qChats = query(collection(db, 'chats'), where('participantes', 'array-contains', uid));
    const unsubChats = onSnapshot(qChats, (snap) => {
      const total = snap.docs.filter(d => {
        const data = d.data();
        if (data.tipo === 'soporte') return false; // Excluir únicamente soporte de la barra inferior
        return data[uid]?.unreadCount > 0;
      }).length;
      setChatsConPendientes(total);
    });

    const qNotifs = query(collection(db, 'usuarios', uid, 'notificaciones'), where('leido', '==', false));
    const unsubNotifs = onSnapshot(qNotifs, (snap) => setNotificacionesSinLeer(snap.size));

    return () => { unsubChats(); unsubNotifs(); };
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !perfil) return;

    // Solo escuchamos historias de gente que seguimos
    const siguiendo = perfil.siguiendo || [];
    const filterIds = [uid, ...siguiendo].filter(id => id).slice(0, 30);

    if (filterIds.length === 0) return;

    const qHistorias = query(
      collection(db, 'historias'),
      where('userId', 'in', filterIds),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubStories = onSnapshot(qHistorias, (snap) => {
      setRawStories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      if (error.code === 'permission-denied') return;
    });
    return () => unsubStories();
  }, [perfil?.siguiendo]); // Reacciona si agregamos/sacamos amigos

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !perfil || rawStories.length === 0 || mostrarHistorias) {
      if (mostrarHistorias) setNuevasHistoriasCount(0);
      return;
    }
    const siguiendo = perfil.siguiendo || [];
    let lastCheck = 0;
    if (perfil.lastStoriesCheck) {
      if (perfil.lastStoriesCheck.toDate) lastCheck = perfil.lastStoriesCheck.toDate().getTime();
      else if (perfil.lastStoriesCheck.seconds) lastCheck = perfil.lastStoriesCheck.seconds * 1000;
    }

    // Solo nos interesa saber SI HAY al menos una nueva
    const hayNuevas = rawStories.some(h => {
      if (h.userId === uid || h.status !== 'ready' || !siguiendo.includes(h.userId)) return false;

      const storyTime = h.createdAt?.toDate ? h.createdAt.toDate().getTime() : (h.createdAt?.seconds ? h.createdAt.seconds * 1000 : 0);
      if (!storyTime) return false;

      // Filtro local y filtro de última revisión
      if (isLocalSeen(h.userId, storyTime)) return false;

      const checkTimeEfectivo = Math.max(lastCheck, lastCheckLocal);
      return storyTime > checkTimeEfectivo;
    });

    setNuevasHistoriasCount(hayNuevas ? 1 : 0); // 1 significa "mostrar punto", 0 "ocultar"
  }, [rawStories, perfil, mostrarHistorias]);

  useEffect(() => {
    if (getShouldOpenStories()) {
      setMostrarHistorias(true);
      resetShouldOpenStories();
    }
    setMostrarMenu(false);
  }, [closeSignal, pathname]);

  const cerrarOverlay = () => {
    // BLOQUEO: Si se está procesando una historia, no dejamos cerrar el modal
    if (estaOcupado) return;

    // Si estábamos viendo las historias, al cerrar marcamos todo como visto (Limpieza del punto)
    if (mostrarHistorias) {
      marcarHistoriasComoVistas();
      setLastCheckLocal(Date.now()); // Bloqueamos el parpadeo localmente
    }
    setMostrarHistorias(false);
    setMostrarMenu(false);
  };

  const navegar = (ruta) => {
    cerrarOverlay();
    setTimeout(() => {
      router.push(ruta);
    }, 10);
  };

  const handleComunidadPress = (filtro) => {
    if (filtro === 'clasificados') {
      if (!pathname.includes('/clasificados')) {
        // Estamos en otro lado: Solo navegamos (Persistencia)
        router.push('/alertas/clasificados');
      } else {
        // Si ya estamos en clasificados, emitimos evento de reload (Actualizar)
        DeviceEventEmitter.emit('RELOAD_CLASIFICADOS');
      }
      return;
    }

    if (pathname !== '/alertas') {
      // Venimos de afuera (ej: del Home): Navegamos puramente (Persistencia)
      router.push('/alertas');
      // NO emitimos SET_COMMUNITY_FILTER ni RELOAD_COMMUNITY al entrar de nuevas
      // para que el usuario siga donde estaba.
    } else {
      // Ya estamos en Alertas: Si es el mismo filtro, refrescamos. Si es distinto, cambiamos filtro.
      if (filtroComunidad === filtro) {
        DeviceEventEmitter.emit('RELOAD_COMMUNITY');
      } else {
        DeviceEventEmitter.emit('SET_COMMUNITY_FILTER', filtro);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.logoWrap} onPress={() => {
          cerrarOverlay();

          if (pathname.includes('/home')) {
            // Ya estamos en casa: Disparamos el reload voluntario
            DeviceEventEmitter.emit('RELOAD_HOME_FEED');
          } else {
            // Estamos en otro lado: Solo navegamos de vuelta a casa (Persistencia)
            router.push('/(tabs)/home');
          }
        }}>
          <HaloBrandIcon size={46} />
        </TouchableOpacity>

        <View style={[styles.rightIcons, !modoComunidad && { justifyContent: 'space-around' }]}>
          {modoComunidad && (
            <View style={styles.communityTools}>
              <TouchableOpacity style={styles.iconButtonCol} onPress={() => handleComunidadPress('todo')}>
                <Ionicons name={filtroComunidad === 'todo' && pathname === '/alertas' ? "apps" : "apps-outline"} size={24} color={filtroComunidad === 'todo' && pathname === '/alertas' ? "#FF6600" : "#9CA3AF"} />
                <Text style={[styles.navLabel, { color: filtroComunidad === 'todo' && pathname === '/alertas' ? "#FF6600" : "#9CA3AF" }]}>Todo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconButtonCol} onPress={() => handleComunidadPress('alertas')}>
                <View>
                  <Ionicons name={filtroComunidad === 'alertas' && pathname === '/alertas' ? "megaphone" : "megaphone-outline"} size={24} color={filtroComunidad === 'alertas' && pathname === '/alertas' ? "#EF4444" : "#9CA3AF"} />
                  {novedadesComunidad.alertas && filtroComunidad !== 'alertas' && <View style={styles.radarDot} />}
                </View>
                <Text style={[styles.navLabel, { color: filtroComunidad === 'alertas' && pathname === '/alertas' ? "#EF4444" : "#9CA3AF" }]}>Alertas</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconButtonCol} onPress={() => handleComunidadPress('general')}>
                <View>
                  <Ionicons name={filtroComunidad === 'general' && pathname === '/alertas' ? "business" : "business-outline"} size={25} color={filtroComunidad === 'general' && pathname === '/alertas' ? "#3B82F6" : "#9CA3AF"} />
                  {novedadesComunidad.general && filtroComunidad !== 'general' && <View style={[styles.radarDot, { backgroundColor: '#3B82F6' }]} />}
                </View>
                <Text style={[styles.navLabel, { color: filtroComunidad === 'general' && pathname === '/alertas' ? "#3B82F6" : "#9CA3AF" }]}>General</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconButtonCol} onPress={() => handleComunidadPress('clasificados')}>
                <View>
                  <Ionicons name={pathname.includes('/clasificados') ? "newspaper" : "newspaper-outline"} size={24} color={pathname.includes('/clasificados') ? "#059669" : "#9CA3AF"} />
                  {novedadesComunidad.clasificados && !pathname.includes('/clasificados') && <View style={[styles.radarDot, { backgroundColor: '#059669' }]} />}
                </View>
                <Text style={[styles.navLabel, { color: pathname.includes('/clasificados') ? "#059669" : "#9CA3AF" }]}>Clasificados</Text>
              </TouchableOpacity>
            </View>
          )}

          {!modoComunidad && (
            <>
              <TouchableOpacity style={styles.iconButton} onPress={() => navegar('/(tabs)/notificaciones')}>
                <HaloBellIcon size={26} color={pathname.includes('notificaciones') ? "#FF6600" : "#333"} />
                {notificacionesSinLeer > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{notificacionesSinLeer}</Text></View>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconButton} onPress={() => navegar('/chats')}>
                <HaloMessageIcon size={26} color={pathname.includes('chats') ? "#FF6600" : "#333"} />
                {chatsConPendientes > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{chatsConPendientes}</Text></View>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.profileCircle} onPress={() => navegar('/(tabs)/perfil')}>
                {perfil?.fotoUrl ? <Image source={{ uri: perfil.fotoUrl }} style={styles.profileImage} /> : <HaloUserIcon size={28} color={pathname.includes('perfil') ? "#FF6600" : "#FFF"} />}
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconButton} onPress={() => {
                cerrarOverlay();

                if (pathname.includes('/marketplace')) {
                  // Ya estamos en Marketplace: Disparamos el reload voluntario
                  DeviceEventEmitter.emit('RELOAD_MARKET');
                } else {
                  // Estamos en otro lado: Solo navegamos de vuelta al Market (Persistencia)
                  router.push('/(marketplace)');
                }
              }}>
                <HaloMarketIcon size={26} color={pathname.includes('marketplace') ? "#FF6600" : "#333"} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconButton} onPress={() => {
                const seraVisible = !mostrarHistorias;
                if (mostrarHistorias) {
                  marcarHistoriasComoVistas(); // Limpiar al cerrar tocando el mismo icono
                  setLastCheckLocal(Date.now()); // Bloqueamos el parpadeo localmente
                }
                setMostrarHistorias(seraVisible);
                setMostrarMenu(false);
              }}>
                <View>
                  <HaloCameraIcon size={30} color={mostrarHistorias ? "#FF6600" : "#333"} />
                  {(nuevasHistoriasCount > 0 && !mostrarHistorias) && (
                    <View style={styles.simpleDotBadge} />
                  )}
                </View>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.iconButton} onPress={() => { setMostrarMenu(!mostrarMenu); setMostrarHistorias(false); }}>
            {mostrarMenu ? <HaloCloseIcon size={26} color="#FF6600" /> : <HaloOptionsIcon size={30} color={mostrarMenu ? "#FF6600" : "#333"} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL PARA EVITAR BLOQUEO DE GESTOS EN ANDROID */}
      <Modal visible={mostrarHistorias || mostrarMenu} transparent animationType="fade" onRequestClose={cerrarOverlay}>
        <View style={{ flex: 1, paddingTop: 54 + insets.top }}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.2)' }]} onPress={cerrarOverlay} />

          <View style={styles.dropdownPanel}>
            {mostrarHistorias && (
              <View>
                <View style={styles.historiasWrapper}>
                  <ContenedorHistorias />
                </View>
                {/* Botón X abajo de la línea blanca del contenedor */}
                <TouchableOpacity style={styles.btnCerrarDerecha} onPress={cerrarOverlay}>
                  <HaloCloseIcon size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}

            {mostrarMenu && (
              <MenuOpciones
                onClose={cerrarOverlay}
                onOpenAmigos={(esDesafio = false) => {
                   setMostrarMenu(false);
                   // Emitimos para que el Layout Raíz lo abra
                   DeviceEventEmitter.emit('OPEN_AMIGOS_DESAFIO', esDesafio);
                }}
                perfil={perfil}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', zIndex: 2000 },
  navbar: {
    height: 56,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE'
  },
  dropdownPanel: { width: '100%', elevation: 10 },
  historiasWrapper: { backgroundColor: '#FFFFFF', width: '100%', elevation: 4, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  btnCerrarDerecha: {
    alignSelf: 'flex-end',
    backgroundColor: '#000000',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 8,
    elevation: 5
  },
  logoWrap: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  rightIcons: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'flex-start', // Alineamos todo hacia la izquierda (hacia el logo)
    alignItems: 'center',
    paddingLeft: 4, // Un pequeño respiro del logo
  },
  profileCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: '#FF6600', backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  profileImage: { width: '100%', height: '100%', borderRadius: 22 },
  iconButton: { padding: 4 },
  iconButtonCol: {
    paddingHorizontal: 7, // Más espacio interno entre iconos
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 58
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 0,
    textTransform: 'uppercase',
    letterSpacing: 0.2
  },
  communityTools: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Cambiamos a space-between para que usen todo el espacio disponible
    flex: 1,
    marginRight: 10, // Bajamos el margen para que aproveche más el ancho
  },
  badge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#FF6600', minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'white' },
  badgeText: { color: 'white', fontSize: 9, fontWeight: 'bold' },
  simpleDotBadge: { position: 'absolute', top: 1, right: 1, backgroundColor: '#FF6600', width: 13, height: 13, borderRadius: 6.5, borderWidth: 2, borderColor: 'white' },
  radarDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: 'white'
  }
});
