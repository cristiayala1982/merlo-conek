import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter, FlatList, Image, Platform, RefreshControl, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CardNativeAd from '../../../components/home/CardNativeAd';
import ComentariosModal from '../../../components/home/ComentariosModal';
import CrearPost from '../../../components/home/CrearPost';
import Post from '../../../components/home/Post';
import { UI_CONSTANTS } from '../../../constants/uiConstants';
import { auth, db } from '../../../firebaseConfig';
import { getCachedPosts, getHomeScrollOffset, setHomeScrollOffset, startGlobalPostListener } from '../../../services/feedState';
import { escucharDesafiosPendientes, escucharNotificaciones, escucharPostsMuro, marcarNotificacionLeida, obtenerPerfilUsuario, responderDesafio } from '../../../services/firebaseService';

export default function App() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [posts, setPosts] = useState(getCachedPosts());
  const [ghostPosts, setGhostPosts] = useState([]);
  const [cargandoPosts, setCargandoPosts] = useState(posts.length === 0);
  const [refreshing, setRefreshing] = useState(true); // Iniciamos en true para inmediatez visual
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [postSeleccionado, setPostSeleccionado] = useState(null);

  const flatListRef = useRef(null);
  const isRestoringScroll = useRef(false);
  const isDetailInteraction = useRef(false);
  const navPanelsClosed = useRef(false);

  // Estados del desafío espontáneo
  const [desafioActivo, setDesafioActivo] = useState(null);
  const [perfilDesafiador, setPerfilDesafiador] = useState(null);
  const [respuestaDesafio, setRespuestaDesafio] = useState(null);
  const [hayNovedadesComunidad, setHayNovedadesComunidad] = useState(false);

  // EFECTO VISUAL AL ENTRAR (Persistencia activada)
  useFocusEffect(
    useCallback(() => {
        // Al entrar al Home, ya NO forzamos el refresh automático.
        // Esto permite que si vas a otra pestaña y vuelves, sigas en el mismo post.
        // El refresh solo ocurrirá si:
        // 1. Tocas el Logo (RELOAD_HOME_FEED)
        // 2. Haces Pull-to-refresh
        // 3. Vuelves a la app después de 5 minutos (AppStateManager)

        const timer = setTimeout(() => setRefreshing(false), 300);
        return () => clearTimeout(timer);
    }, [])
  );

  // 1. Guardar scroll cada vez que el usuario se mueve
  const handleScroll = (event) => {
    if (isRestoringScroll.current) return;
    const offset = event.nativeEvent.contentOffset.y;
    if (offset >= 0) {
      setHomeScrollOffset(offset);
    }
    if (!navPanelsClosed.current) {
      navPanelsClosed.current = true;
      DeviceEventEmitter.emit('CLOSE_NAV_PANELS');
    }
  };

  const handleScrollEnd = () => {
    navPanelsClosed.current = false;
  };

  const handleManualRefresh = useCallback(() => {
    // Si ya estamos refrescando, no hacemos nada extra
    // (excepto asegurar que el estado sea true)
    setRefreshing(true);
    setHomeScrollOffset(0);

    // Pequeño desplazamiento visual inicial
    flatListRef.current?.scrollToOffset({ offset: -100, animated: true });

    setTimeout(() => {
      setRefreshing(false);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, UI_CONSTANTS.REFRESH_DURATION);
  }, []);

  useEffect(() => {
    let ghostTimer = null; // Guardamos la referencia del temporizador

    // Escuchar cuando el usuario entra a ver fotos/videos
    const subMedia = DeviceEventEmitter.addListener('MEDIA_VIEWER_OPENED', () => {
      isDetailInteraction.current = true;
    });

    const subStart = DeviceEventEmitter.addListener('ON_POST_UPLOAD_START', (data) => {
      if (!data.esAlerta) setGhostPosts(prev => [{ ...data, startTime: Date.now() }, ...prev]);
    });
    const subProgress = DeviceEventEmitter.addListener('ON_POST_UPLOAD_PROGRESS', ({ progress }) => {
      setGhostPosts(prev => prev.map(p => ({ ...p, uploadProgress: progress })));
    });
    const subEnd = DeviceEventEmitter.addListener('ON_POST_UPLOAD_END', () => {
      setGhostPosts(prev => prev.map(p => ({ ...p, status: 'ready', uploadProgress: 100 })));

      // Limpiamos el anterior si existe
      if (ghostTimer) clearTimeout(ghostTimer);

      ghostTimer = setTimeout(() => {
        setGhostPosts(prev => prev.filter(p => (Date.now() - (p.startTime || 0)) < 15000));
        console.log('⏱️ [Home] Limpieza de Ghost Posts ejecutada tras 15 segundos.');
      }, 15000);
    });

    // RE-CONEXIÓN DEL CABLE DE DESAFÍOS
    const unsubDesafios = escucharDesafiosPendientes((desafio) => {
      console.log("🔥 [DESAFIO] Señal recibida:", desafio ? "HAY DESAFIO" : "VACIO");
      if (desafio) {
        setDesafioActivo(desafio);
        obtenerPerfilUsuario(desafio.deId, setPerfilDesafiador);
      } else {
        setDesafioActivo(null);
        setPerfilDesafiador(null);
      }
    });

    const cleanupGlobal = startGlobalPostListener(escucharPostsMuro, (items) => {
      setPosts(items);
      setCargandoPosts(false);
    });

    const unsubNotifs = escucharNotificaciones(auth.currentUser?.uid, (lista) => {
      const topNotif = lista.find(n => (n.tipo === 'desafio_completado' || n.tipo === 'desafio_respuesta') && !n.leido);
      setRespuestaDesafio(topNotif || null);
    });

    const subReload = DeviceEventEmitter.addListener('RELOAD_HOME_FEED', handleManualRefresh);

    return () => {
      // CANCELAR EL RELOJ FANTASMA SI EL USUARIO SE VA DE LA PANTALLA
      if (ghostTimer) {
        clearTimeout(ghostTimer);
        console.log('🧹 [Home] Temporizador fantasma cancelado al salir de la pantalla.');
      }

      if (typeof cleanupGlobal === 'function') cleanupGlobal();
      subMedia.remove();
      subStart.remove();
      subProgress.remove();
      subEnd.remove();
      unsubDesafios();
      unsubNotifs();
      subReload.remove();
    };
  }, [handleManualRefresh]);

  // Novedades Comunidad (Escucha aparte para no interferir)
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubMe = onSnapshot(doc(db, 'usuarios', uid), (uSnap) => {
      const uData = uSnap.data() || {};
      const checkA = uData.lastCheck_alertas?.toMillis ? uData.lastCheck_alertas.toMillis() : 0;
      const qA = query(collection(db, 'alertas_comunitarias'), orderBy('createdAt', 'desc'), limit(1));
      onSnapshot(qA, (aSnap) => {
        if (!aSnap.empty) {
          const lastA = aSnap.docs[0].data();
          const timeA = lastA.createdAt?.toMillis ? lastA.createdAt.toMillis() : 0;
          setHayNovedadesComunidad(timeA > checkA);
        }
      });
    });
    return () => unsubMe();
  }, []);

  // Restauración Ultra-Rápida con getItemLayout
  useEffect(() => {
    const offset = getHomeScrollOffset();
    if (offset > 0 && !cargandoPosts && flatListRef.current) {
      isRestoringScroll.current = true;
      flatListRef.current.scrollToOffset({ offset, animated: false });
      const t = requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({ offset, animated: false });
        isRestoringScroll.current = false;
      });
      return () => cancelAnimationFrame(t);
    }
  }, [cargandoPosts]);

  const combinedPosts = useMemo(() => {
    // FILTRO ANTI-DUPLICADOS: Ocultar ghost post si llegó el post real de Firestore (por ID, texto o tiempo)
    const filteredGhosts = ghostPosts.filter(ghost => {
      return !posts.some(p => {
        if (p.userId !== ghost.userId) return false;
        if (p.id === ghost.id) return true;
        if (ghost.texto && p.texto && p.texto === ghost.texto) return true;
        if (ghost.url && p.url && p.url === ghost.url) return true;
        const postTime = p.createdAt?.toMillis ? p.createdAt.toMillis() : (p.createdAt?.seconds ? p.createdAt.seconds * 1000 : Date.now());
        return ghost.startTime && postTime >= (ghost.startTime - 2000);
      });
    });

    const result = [...filteredGhosts, ...posts];

    // INYECCIÓN PROFESIONAL: 1 Anuncio cada 3 Posts (El anuncio es el 4to, 8vo, etc.)
    const finalData = [];
    result.forEach((item, index) => {
      finalData.push(item);
      if ((index + 1) % 3 === 0) {
        finalData.push({ id: `ad-${index}`, type: 'ad' });
      }
    });
    return finalData;
  }, [ghostPosts, posts]);

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'ad') {
      return <CardNativeAd />;
    }

    return (
      <Post
        post={item}
        onComentar={(post) => {
          setPostSeleccionado(post);
          setMostrarComentarios(true);
        }}
      />
    );
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        ref={flatListRef}
        data={combinedPosts}
        keyExtractor={(item) => String(item.postId || item.id)}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <CrearPost />
          </View>
        }
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(100, insets.bottom + 86) }]}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={12}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleManualRefresh}
            colors={["#FF6600"]}
            tintColor="#FF6600"
            size="large"
            progressViewOffset={42}
          />
        }
      />

      <TouchableOpacity
        style={[styles.btnSirena, { top: 5 }]}
        onPress={() => router.push('/alertas')}
        accessibilityLabel="Abrir alertas de la comunidad"
      >
        <Ionicons name="megaphone" size={24} color="#EF4444" />
        {hayNovedadesComunidad && <View style={styles.sirenaDot} />}
      </TouchableOpacity>

      <ComentariosModal
        visible={mostrarComentarios}
        onClose={() => setMostrarComentarios(false)}
        post={posts.find((p) => (p.id || p.postId) === (postSeleccionado?.id || postSeleccionado?.postId)) || postSeleccionado}
      />

      {/* CARTEL RESPUESTA / CUMPLIMIENTO DESAFIO */}
      {respuestaDesafio && (
        <View style={[styles.desafioOverlay, { top: insets.top + 60 }]}>
          <TouchableOpacity
            style={[
              styles.desafioCard,
              {
                borderColor: respuestaDesafio.tipo === 'desafio_completado' ? '#10B981' : (respuestaDesafio.texto.includes('aceptó') ? '#34C759' : '#EF4444'),
                borderWidth: 1.5
              }
            ]}
            onPress={async () => {
              await marcarNotificacionLeida(respuestaDesafio.id);
              if (respuestaDesafio.tipo === 'desafio_completado' && respuestaDesafio.postId) {
                 router.push({ pathname: '/postDetalle', params: { postId: respuestaDesafio.postId } });
              }
              setRespuestaDesafio(null);
            }}
          >
            <View style={styles.desafioHeader}>
              <Ionicons
                name={respuestaDesafio.tipo === 'desafio_completado' ? "checkmark-done-circle" : (respuestaDesafio.texto.includes('aceptó') ? "checkmark-circle" : "close-circle")}
                size={20}
                color={respuestaDesafio.tipo === 'desafio_completado' ? "#10B981" : (respuestaDesafio.texto.includes('aceptó') ? "#34C759" : "#EF4444")}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.desafioTitle}>
                  {respuestaDesafio.tipo === 'desafio_completado' ? '¡DESAFÍO CUMPLIDO!' : 'RESPUESTA AL DESAFÍO'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeDesafioBtn}
                onPress={async (e) => {
                  e.stopPropagation();
                  await marcarNotificacionLeida(respuestaDesafio.id);
                  setRespuestaDesafio(null);
                }}
              >
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <View style={styles.desafioBody}>
              <Image source={{ uri: respuestaDesafio.deFoto }} style={styles.desafioAvatar} />
              <Text style={styles.desafioTxt}><Text style={{ fontWeight: 'bold' }}>{respuestaDesafio.deNombre}</Text> {respuestaDesafio.texto}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* CARTEL DESAFIO RECIBIDO (EL CABLE CORTADO) */}
      {desafioActivo && (
        <View style={[styles.desafioOverlay, { top: insets.top + 60 }]}>
          <View style={styles.desafioCard}>
            <View style={styles.desafioHeader}>
              <Ionicons name="sparkles" size={20} color="#FF6600" />
              <Text style={styles.desafioTitle}>¡DESAFÍO ESPONTÁNEO!</Text>
            </View>
            <View style={styles.desafioBody}>
              <Image source={{ uri: perfilDesafiador?.fotoUrl }} style={styles.desafioAvatar} />
              <Text style={styles.desafioTxt}><Text style={{ fontWeight: 'bold' }}>{perfilDesafiador?.nombre}</Text> te desafió.</Text>
            </View>
            <View style={styles.desafioActions}>
              <TouchableOpacity
                style={[styles.btnDesafio, styles.btnRechazar]}
                onPress={() => responderDesafio(desafioActivo.id, 'rejected')}
              >
                <Text style={styles.btnDesafioText}>RECHAZAR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnDesafio, styles.btnAceptar]}
                onPress={() => {
                  responderDesafio(desafioActivo.id, 'accepted');
                  DeviceEventEmitter.emit('ABRIR_CAMARA_ESPONTANEA', {
                    desafioId: desafioActivo.id,
                    deId: desafioActivo.deId
                  });
                }}
              >
                <Text style={styles.btnDesafioText}>ACEPTAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingTop: 42, paddingBottom: 20 },
  btnSirena: { position: 'absolute', right: 15, zIndex: 100, width: 36, height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
  sirenaDot: { position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF6600', borderWidth: 2, borderColor: 'white' },
  desafioOverlay: { position: 'absolute', left: 15, right: 15, zIndex: 5000 },
  desafioCard: { backgroundColor: '#111827', borderRadius: 16, padding: 15 },
  desafioHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  desafioTitle: { color: 'white', fontWeight: '900', fontSize: 14, marginLeft: 8 },
  closeDesafioBtn: { padding: 4 },
  desafioBody: { flexDirection: 'row', alignItems: 'center' },
  desafioAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  desafioTxt: { color: '#D1D5DB', fontSize: 14, flex: 1 },
  desafioActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 15 },
  btnDesafio: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  btnRechazar: { backgroundColor: '#374151' },
  btnAceptar: { backgroundColor: '#FF6600' },
  btnDesafioText: { color: 'white', fontWeight: '900', fontSize: 12 }
});
