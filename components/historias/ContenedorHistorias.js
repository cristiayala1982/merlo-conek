import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useRouter, usePathname, useGlobalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, FlatList, Modal, NativeModules, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { getVideoMetaData } from 'react-native-compressor';
import { auth, db } from '../../firebaseConfig';
import { eliminarHistoriaAFirebase, escucharHistoriasCirculos, obtenerHistoriasGrupales, obtenerPerfilUsuario, subirHistoriaAFirebase } from '../../services/firebaseService';
import { setStoriesCache } from '../../services/storiesState';
import { comprimirVideoPro } from '../camara/compresor3';
import VistaPrevia from '../camara/VistaPrevia';

export default function ContenedorHistorias() {
  const router = useRouter();
  const [historias, setHistorias] = useState([]);
  const [archivoCapturado, setArchivoCapturado] = useState(null);
  const [estaSubiendo, setEstaSubiendo] = useState(false);
  const [optimizandoVideo, setOptimizandoVideo] = useState(false);
  const [progresoMsg, setProgresoMsg] = useState('');
  const [progresoPct, setProgresoPct] = useState(0);
  const [eliminandoHistoriaId, setEliminandoHistoriaId] = useState(null);
  const [gestorVisible, setGestorVisible] = useState(false);
  const [cargandoMisHistorias, setCargandoMisHistorias] = useState(false);
  const [misHistoriasDetalle, setMisHistoriasDetalle] = useState([]);
  const [miPerfil, setMiPerfil] = useState(null);

  const miUid = auth.currentUser?.uid || null;

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = obtenerPerfilUsuario(uid, (data) => setMiPerfil(data));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = escucharHistoriasCirculos(
      async (items) => {
        setHistorias(items);
        items.forEach(h => {
          const uri = h.thumbnailUrl || h.url;
          if (uri) Image.prefetch(uri);
        });
        if (items.length > 0 && miUid) {
          const uidsEnHistorias = items.map(h => h.userId).filter(Boolean);
          // Ponemos miUid al principio de la lista de IDs
          const uids = Array.from(new Set([miUid, ...uidsEnHistorias]));
          let dataCompleta = await obtenerHistoriasGrupales(uids, miUid);

          // ORDEN CRÍTICO: Forzamos que mi historia sea SIEMPRE la primera (índice 0)
          dataCompleta.sort((a, b) => {
            if (a.userId === miUid) return -1;
            if (b.userId === miUid) return 1;
            return 0;
          });

          setStoriesCache(dataCompleta);
        }
      },
      (error) => {}
    );

    const deleteSub = DeviceEventEmitter.addListener('onDeleteStory', async (data) => {
      if (data.storyId) {
        try { await eliminarHistoriaAFirebase({ id: data.storyId }); } catch (e) { console.log(e); }
      }
    });

    return () => {
      unsub();
      deleteSub.remove();
    };
  }, []);

  const miHistoria = useMemo(() => historias.find((h) => h?.userId === miUid) || null, [historias, miUid]);
  const otrasHistorias = useMemo(() => historias.filter((h) => h?.userId && h.userId !== miUid), [historias, miUid]);

  const abrirCamaraHistoria = async () => {
    if (!miUid) return;
    try {
      if (Platform.OS !== 'android') return;
      const modulo = NativeModules.HistoriasLabNative;
      if (!modulo) return;
      const ruta = await modulo.abrirCamaraHistorias(false, false);
      if (!ruta) return;

      const esVideo = String(ruta).endsWith('.mp4');
      const uriOriginal = `file://${ruta}`;
      let capturaTemp = { tipo: esVideo ? 'video' : 'foto', uri: uriOriginal, optimizado: false };

      if (esVideo) {
        try {
          setOptimizandoVideo(true);
          DeviceEventEmitter.emit('SET_STORY_BUSY', true); // BLOQUEAMOS NAVBAR
          setProgresoMsg('Optimizando video...');
          const uriComprimida = await comprimirVideoPro(uriOriginal);
          if (uriComprimida) {
            capturaTemp.uri = uriComprimida;
            capturaTemp.optimizado = true;
          }
        } catch (e) {
          console.log("Error optimizando historia:", e);
        } finally {
          setOptimizandoVideo(false);
          DeviceEventEmitter.emit('SET_STORY_BUSY', false); // DESBLOQUEAMOS NAVBAR
          setProgresoMsg('');
        }
      }

      setArchivoCapturado(capturaTemp);
    } catch (error) {
      console.log(error);
      setOptimizandoVideo(false);
    }
  };

  const pathname = usePathname();
  const globalParams = useGlobalSearchParams();

  const verHistorias = (userId) => {
    if (!userId) return;
    const h = historias.find(item => item.userId === userId);
    const thumbRapido = h?.thumbnailLqUrl || h?.thumbnailUrl || h?.url || "";

    // Cerramos el modal de la Navbar antes de irnos para limpiar la UI
    DeviceEventEmitter.emit('CLOSE_NAV_PANELS');

    // Construimos la ruta de retorno incluyendo el userId si estamos en un perfil ajeno
    let rutaConParams = pathname;
    if (pathname.includes('perfilAjeno') && globalParams.userId) {
      rutaConParams = `${pathname}?userId=${globalParams.userId}`;
    }

    router.push({
      pathname: '/historias-viewer',
      params: {
        userId,
        thumbRapido,
        retornoRuta: rutaConParams // Guardamos dónde estábamos con sus parámetros
      }
    });
  };

  const generarMiniatura = async (videoUri) => {
    const tiempos = [120, 450, 900, 1400];
    for (const time of tiempos) {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time });
        if (uri) return uri;
      } catch (error) {}
    }
    return null;
  };

  const generarMiniaturaFoto = async (fotoUri) => {
    try {
      const result = await ImageManipulator.manipulateAsync(fotoUri, [{ resize: { width: 540 } }], { compress: 0.35, format: ImageManipulator.SaveFormat.JPEG });
      return result?.uri || null;
    } catch (error) { return null; }
  };

  const generarMiniaturaUltraLQ = async (fotoUri) => {
    try {
      const result = await ImageManipulator.manipulateAsync(fotoUri, [{ resize: { width: 150 } }], { compress: 0.1, format: ImageManipulator.SaveFormat.JPEG });
      return result?.uri || null;
    } catch (error) { return null; }
  };

  const comprimirImagenPrincipal = async (fotoUri) => {
    try {
      const result = await ImageManipulator.manipulateAsync(fotoUri, [{ resize: { width: 1080 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
      return result?.uri || null;
    } catch (error) { return null; }
  };

  const renderItem = useCallback(({ item }) => {
    if (item.isMe) {
      let miHistoriaVista = true;
      if (miHistoria?.createdAt && miPerfil?.lastStoriesCheck) {
        const lastStoryTime = miHistoria.createdAt.seconds ? miHistoria.createdAt.seconds * 1000 : miHistoria.createdAt;
        const myCheckTime = miPerfil.lastStoriesCheck.seconds ? miPerfil.lastStoriesCheck.seconds * 1000 : miPerfil.lastStoriesCheck;
        if (lastStoryTime > myCheckTime) miHistoriaVista = false;
      } else if (miHistoria && !miPerfil?.lastStoriesCheck) {
        miHistoriaVista = false;
      }

      return (
        <View style={styles.item}>
          <Pressable style={styles.avatarWrap} onPress={() => miHistoria && verHistorias(miUid)} onLongPress={() => setGestorVisible(true)}>
            <View style={[styles.avatar, miHistoria ? (miHistoriaVista ? styles.avatarVisto : styles.avatarConHistoria) : styles.avatarPropiaSinHistoria]}>
              {miPerfil?.fotoUrl ? (
                <Image
                    source={{ uri: miPerfil.fotoUrl }}
                    style={styles.innerMedia}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.innerCircle, styles.innerCirclePropia]}>
                  <Text style={styles.inicialTxt}>{String(miPerfil?.nombre || 'T').slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.plusBadge} onPress={() => abrirCamaraHistoria()}>
              <Ionicons name="add" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </Pressable>
          <Text style={[styles.nombre, miHistoria && miHistoriaVista && styles.nombreVisto]}>Tu historia</Text>
        </View>
      );
    }

    let historiaVista = true;
    const checkPersonal = miPerfil?.vistasHistorias?.[item.userId];
    if (item.createdAt) {
      const lastStoryTime = item.createdAt.seconds ? item.createdAt.seconds * 1000 : item.createdAt;
      if (checkPersonal) {
        const personalTime = checkPersonal.seconds ? checkPersonal.seconds * 1000 : checkPersonal;
        if (lastStoryTime > personalTime) historiaVista = false;
      } else {
        if (miPerfil?.lastStoriesCheck) {
          const globalTime = miPerfil.lastStoriesCheck.seconds ? miPerfil.lastStoriesCheck.seconds * 1000 : miPerfil.lastStoriesCheck;
          if (lastStoryTime > globalTime) historiaVista = false;
        } else {
          historiaVista = false;
        }
      }
    }

    return (
      <TouchableOpacity style={styles.item} onPress={() => verHistorias(item.userId)}>
        <View style={[styles.avatar, styles.avatarOtro, historiaVista && styles.avatarVisto]}>
          {item?.userPhotoUrl ? (
            <Image
                source={{ uri: item.userPhotoUrl }}
                style={styles.innerMedia}
                contentFit="cover"
                cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.innerCircle}>
              <Text style={styles.inicialTxt}>{String(item?.userName || 'U').slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.nombre, historiaVista && styles.nombreVisto]} numberOfLines={1}>{item.userName || 'Usuario'}</Text>
      </TouchableOpacity>
    );
  }, [miHistoria, miPerfil, miUid, historias]);

  const handlePublicarHistoria = async (texto = '', uriEditada = null) => {
    if (estaSubiendo || !archivoCapturado) return;
    const captura = { ...archivoCapturado };
    if (uriEditada) captura.uri = uriEditada;

    try {
      setArchivoCapturado(null);
      setEstaSubiendo(true);
      DeviceEventEmitter.emit('SET_STORY_BUSY', true); // BLOQUEAMOS NAVBAR
      setProgresoMsg('Preparando historia...');
      setProgresoPct(0);
      await new Promise((resolve) => setTimeout(resolve, 120));
      let uriParaSubir = captura.uri; let thumbnailUri = null; let thumbnailLqUri = null; let duracionMs = null; let width = null; let height = null;
      const temporalesParaLimpiar = [];

      // LOG INICIAL
      console.log("📸 [HISTORIAS] Iniciando proceso de publicación. Tipo:", captura.tipo);

      if (captura.tipo === 'video') {
        setProgresoMsg('Generando miniatura...'); thumbnailUri = await generarMiniatura(captura.uri); if (thumbnailUri) temporalesParaLimpiar.push(thumbnailUri);

        if (!captura.optimizado) {
          console.log("🎥 [VIDEO] Iniciando compresión de video...");
          setProgresoMsg('Comprimiendo video...'); uriParaSubir = await comprimirVideoPro(captura.uri); if (uriParaSubir && uriParaSubir !== captura.uri) temporalesParaLimpiar.push(uriParaSubir);
        } else {
          temporalesParaLimpiar.push(uriParaSubir);
        }

        if (!thumbnailUri && uriParaSubir) { setProgresoMsg('Regenerando miniatura...'); thumbnailUri = await generarMiniatura(uriParaSubir); if (thumbnailUri) temporalesParaLimpiar.push(thumbnailUri); }
        const meta = await getVideoMetaData(uriParaSubir); duracionMs = meta?.duration ? Math.round(Number(meta.duration) * 1000) : null; width = meta?.width ? Number(meta.width) : null; height = meta?.height ? Number(meta.height) : null;
      } else {
        console.log("🖼️ [IMAGEN] Iniciando optimización de foto...");
        setProgresoMsg('Optimizando imagen...');

        // Tamaño original para log
        const infoOriginal = await FileSystem.getInfoAsync(captura.uri);
        const sizeOriginalMB = (infoOriginal.size / (1024 * 1024)).toFixed(2);
        console.log(`📏 [IMAGEN] Tamaño original: ${sizeOriginalMB} MB`);

        // 1. Comprimir para el círculo de la lista
        thumbnailUri = await generarMiniaturaFoto(captura.uri);
        if (thumbnailUri) temporalesParaLimpiar.push(thumbnailUri);

        // 2. Crear Placeholder instantáneo
        thumbnailLqUri = await generarMiniaturaUltraLQ(captura.uri);
        if (thumbnailLqUri) temporalesParaLimpiar.push(thumbnailLqUri);

        // 3. Comprimir imagen principal
        const principalComprimida = await comprimirImagenPrincipal(captura.uri);
        if (principalComprimida) {
            uriParaSubir = principalComprimida;
            temporalesParaLimpiar.push(principalComprimida);

            const infoComprimida = await FileSystem.getInfoAsync(principalComprimida);
            const sizeComprimidaKB = (infoComprimida.size / 1024).toFixed(2);
            const ahorro = (((infoOriginal.size - infoComprimida.size) / infoOriginal.size) * 100).toFixed(1);
            console.log(`✅ [IMAGEN] Optimización completa: ${sizeComprimidaKB} KB (Ahorro: ${ahorro}%)`);
        }
      }

      const infoArchivo = await FileSystem.getInfoAsync(uriParaSubir, { size: true });
      const fileSizeBytes = infoArchivo?.exists ? infoArchivo.size ?? null : null;
      setProgresoMsg('Subiendo historia...');

      await subirHistoriaAFirebase({
        uri: uriParaSubir, tipo: captura.tipo, thumbnailUri, thumbnailLqUri, texto: typeof texto === 'string' ? texto.trim() : '', fileSizeBytes, duracionMs, width, height,
        onProgress: ({ fase, progreso }) => {
          const pct = Math.round(Math.max(1, Math.min(100, Number(progreso) || 0))); setProgresoPct(pct);
          if (fase === 'subiendo-media' || fase === 'subiendo-thumbnail') setProgresoMsg(`Subiendo historia...`);
          else if (fase === 'completado') setProgresoMsg('Historia publicada');
        },
      });
      for (const ruta of temporalesParaLimpiar) { try { await FileSystem.deleteAsync(ruta, { idempotent: true }); } catch (error) {} }
    } catch (error) { Alert.alert('Error', error?.message || 'No se pudo subir la historia.'); } finally {
      setEstaSubiendo(false);
      DeviceEventEmitter.emit('SET_STORY_BUSY', false); // DESBLOQUEAMOS NAVBAR
      setProgresoMsg('');
      setProgresoPct(0);
    }
  };

  return (
    <View style={styles.wrapper}>
      <FlatList
        data={[{ isMe: true }, ...otrasHistorias]}
        renderItem={renderItem}
        keyExtractor={(item, index) => item.userId || item.id || `h-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.lista}
        decelerationRate="fast"
        snapToInterval={114}
        snapToAlignment="start"
      />
      {estaSubiendo && (
        <View style={styles.progresoWrap}>
          <ActivityIndicator size="small" color="#F97316" />
          <View style={styles.progresoTextWrap}>
            <Text style={styles.progresoText}>{progresoMsg}</Text>
            <Text style={styles.progresoPct}>{progresoPct}%</Text>
          </View>
        </View>
      )}

      {optimizandoVideo && (
        <View style={styles.optimizandoOverlay}>
           <ActivityIndicator size="large" color="#F97316" />
           <Text style={styles.optimizandoTxt}>Optimizando video...</Text>
        </View>
      )}

      <Modal visible={!!archivoCapturado} animationType="slide">
        {archivoCapturado && <VistaPrevia archivo={archivoCapturado} onDescartar={() => setArchivoCapturado(null)} onPublicar={handlePublicarHistoria} />}
      </Modal>
      <Modal visible={gestorVisible} transparent animationType="fade" onRequestClose={() => setGestorVisible(false)}>
        <Pressable style={styles.gestorOverlay} onPress={() => setGestorVisible(false)}>
          <View style={styles.gestorCard}>
             <Text style={styles.gestorTitulo}>Gestor de historias</Text>
             <TouchableOpacity style={{marginTop: 20, padding: 10, backgroundColor: '#F97316', borderRadius: 8}} onPress={() => setGestorVisible(false)}>
                <Text style={{color: 'white', textAlign: 'center'}}>Cerrar</Text>
             </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', backgroundColor: '#FFFFFF', paddingVertical: 14 },
  lista: { paddingHorizontal: 16 },
  item: { alignItems: 'center', width: 104, marginRight: 10 },
  avatarWrap: { position: 'relative', width: 104, height: 104, marginBottom: 8 },
  avatar: { width: 104, height: 104, borderRadius: 52, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  avatarConHistoria: { borderColor: '#E5E7EB' },
  avatarPropiaSinHistoria: { borderColor: '#E5E7EB' },
  avatarOtro: { borderColor: '#FF914D', marginBottom: 8 },
  avatarVisto: { borderColor: '#D1D5DB' },
  innerMedia: { width: 92, height: 92, borderRadius: 46 },
  innerCircle: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  innerCirclePropia: { backgroundColor: '#374151' },
  plusBadge: { position: 'absolute', right: 2, bottom: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: '#374151', borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  nombre: { fontSize: 13, color: '#374151', fontWeight: '700', textAlign: 'center' },
  nombreVisto: { color: '#9CA3AF' },
  inicialTxt: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  progresoWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, backgroundColor: 'rgba(0,0,0,0.05)', padding: 10, borderRadius: 10 },
  progresoTextWrap: { marginLeft: 8, flexDirection: 'row', alignItems: 'center' },
  progresoText: { fontSize: 12, color: '#F97316', fontWeight: '600' },
  progresoPct: { marginLeft: 5, fontSize: 12, color: '#F97316', fontWeight: '800' },
  gestorOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  gestorCard: { backgroundColor: 'white', width: '80%', padding: 20, borderRadius: 16 },
  gestorTitulo: { fontSize: 18, fontWeight: 'bold' },
  optimizandoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  optimizandoTxt: { marginTop: 10, color: '#F97316', fontWeight: 'bold', fontSize: 14 }
});
