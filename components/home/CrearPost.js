import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, FlatList, KeyboardAvoidingView, Modal, NativeModules, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';
import { limpiarRastroSubida, mantenimientoInteligente } from '../../services/cacheService';
import { crearNotificacionModeracion, enviarReporte, obtenerPerfilUsuario, subirArchivoConRuta, subirPostAFirebase, procesarMencionesEnTexto } from '../../services/firebaseService';
import { evaluarImagenSensible } from '../../services/imageModerationService';
import { getGlobalUserProfile, setGlobalUserProfile } from '../../services/userState';
import { obtenerPartidosDeProvincia, obtenerLocalidadesDePartido } from '../../constants/geografiaArgentina';
import HeaderComunidad from '../alertas/HeaderComunidad';
import { comprimirVideoPro } from '../camara/compresor3';
import VistaPrevia from '../camara/VistaPrevia';
import SelectorFotoComunidad from '../camaraFotos/SelectorFotoComunidad';
import { HaloUserIcon } from '../icons/HaloIcons';
import SelectorMenciones from '../menciones/SelectorMenciones';
import { showToast } from '../utilidades/CustomToast';

const PROVINCIAS_ARGENTINA = ["Buenos Aires", "Catamarca", "Chaco", "Chubut", "Ciudad Autónoma de Buenos Aires", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"].sort();
export default function CrearPost({ onCaptureFlowChange, modoAlertas = false, bloquearAlertas = false, clima = null, perfil = null, childrenFiltro = null }) {
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const [miPerfil, setMiPerfil] = useState(getGlobalUserProfile()); // Carga instantánea global

  // Estados del Formulario
  const [textoPost, setTextoPost] = useState('');
  const [archivoCapturado, setArchivoCapturado] = useState(null);
  const [cerrarCamara, setCerrarCamara] = useState(0);
  const [estaSubiendo, setEstaSubiendo] = useState(false);
  const [progresoPct, setProgresoPct] = useState(0);
  const [progresoMsg, setProgresoMsg] = useState('');
  const [optimizandoVideo, setOptimizandoVideo] = useState(false);
  const [vistaPreviaAbierta, setVistaPreviaAbierta] = useState(false);
  const [textoSobreMedia, setTextoSobreMedia] = useState('');
  const [esEspontanea, setEsEspontanea] = useState(false);
  const [desafioContexto, setDesafioContexto] = useState(null);

  // Ubicación y GPS
  const [provincia, setProvincia] = useState('');
  const [partido, setPartido] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [barrioManual, setBarrioManual] = useState('');
  const [coords, setCoords] = useState(null);
  const [obteniendoGPS, setObteniendoGPS] = useState(false);
  const [tipoAlerta, setTipoAlerta] = useState(null); // 'Alerta' o 'General'

  // Modales Ubicación
  const [modalProvVisible, setModalProvVisible] = useState(false);
  const [modalPartVisible, setModalPartVisible] = useState(false);
  const [modalLocVisible, setModalLocVisible] = useState(false);
  const [partidos, setPartidos] = useState([]);
  const [localidades, setLocalidades] = useState([]);
  const [cargandoPart, setCargandoPart] = useState(false);
  const [cargandoLoc, setCargandoLoc] = useState(false);

  // Menciones
  const [queryMencion, setQueryMencion] = useState(null);
  const [cursorPos, setCursorPos] = useState(0);
  const perfilInicialCargadoRef = useRef(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      obtenerPerfilUsuario(uid, (data) => {
        setMiPerfil(data);
        setGlobalUserProfile(data); // Asegurar que la memoria global esté actualizada
        if (!perfilInicialCargadoRef.current) {
          perfilInicialCargadoRef.current = true;
          if (data?.provincia) setProvincia(data.provincia);

          if (data?.partido) {
              setPartido(data.partido);
          } else if (data?.localidad) {
              setPartido(data.localidad);
          }
        }
      });
    }
    const subCamara = DeviceEventEmitter.addListener('ABRIR_CAMARA_POST', () => setModalVisible(true));
    const subEspontanea = DeviceEventEmitter.addListener('ABRIR_CAMARA_ESPONTANEA', (data) => {
      setEsEspontanea(true);
      setDesafioContexto(data); // { desafioId, deId }
      setModalVisible(true); // Abrir modal padre para alojar la VistaPrevia de la Espontánea
      abrirCamaraKotlin(true); // Forzamos apertura de cámara con flag espontánea
    });
    return () => {
      subCamara.remove();
      subEspontanea.remove();
    };
  }, []);

  useEffect(() => {
    setPartido('');
    setLocalidad('');
    if (provincia) cargarPartidos(provincia);
  }, [provincia]);

  useEffect(() => {
    if (partido && provincia) cargarLocalidades(partido, provincia);
  }, [partido, provincia]);

  const cargarPartidos = (prov) => {
    setPartidos(obtenerPartidosDeProvincia(prov));
  };

  const cargarLocalidades = (part, prov) => {
    setLocalidades(obtenerLocalidadesDePartido(part, prov));
  };

  // --- LÓGICA DE COMPRESIÓN Y OPTIMIZACIÓN (NUEVO) ---
  const comprimirImagenPrincipal = async (fotoUri) => {
    try {
      return await ImageManipulator.manipulateAsync(
        fotoUri,
        [{ resize: { width: 1080 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
    } catch (error) { return null; }
  };

  const generarMiniaturaUltraLQ = async (fotoUri) => {
    try {
      return await ImageManipulator.manipulateAsync(
        fotoUri,
        [{ resize: { width: 150 } }],
        { compress: 0.1, format: ImageManipulator.SaveFormat.JPEG }
      );
    } catch (error) { return null; }
  };

  const handleGetGPS = async () => {
    try {
      setObteniendoGPS(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permiso denegado", "Se necesita permiso de ubicación.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    } catch (e) {
        Alert.alert("Error GPS", "No se pudo obtener la ubicación.");
    } finally { setObteniendoGPS(false); }
  };

  const handleTextChange = (text) => {
    setTextoPost(text);
    const lastAt = text.lastIndexOf('@', cursorPos);
    if (lastAt !== -1) {
      const query = text.slice(lastAt + 1, cursorPos).split(/\s/)[0];
      setQueryMencion(query);
    } else { setQueryMencion(null); }
  };

  const handleSelectUsuario = (usuario) => {
    const lastAt = textoPost.lastIndexOf('@', cursorPos);
    const antes = textoPost.slice(0, lastAt);
    const despues = textoPost.slice(cursorPos);
    setTextoPost(`${antes}@${usuario.nombre} ${despues}`);
    setQueryMencion(null);
  };

  const handleMediaEditada = async (texto, uri) => {
    const esVideo = uri.endsWith('.mp4');
    let thumbnailLocal = null;

    if (esVideo) {
      try {
        const { uri: thumb } = await VideoThumbnails.getThumbnailAsync(uri, { time: 450 });
        if (thumb) {
          const compResult = await comprimirImagenPrincipal(thumb);
          thumbnailLocal = compResult ? compResult.uri : thumb;
        }
      } catch (e) {
        console.log("Error generando miniatura local:", e);
      }
    }

    const capturado = {
      tipo: esVideo ? 'video' : 'foto',
      uri,
      thumbnailLocal,
      esEspontanea: esEspontanea, // Arrastramos el flag
      desafioId: desafioContexto?.desafioId || null
    };

    setArchivoCapturado(capturado);
    setTextoSobreMedia(texto);
    setVistaPreviaAbierta(false);
    setCerrarCamara(current => current + 1);

    if (esEspontanea || desafioContexto) {
      setModalVisible(false);
      setTimeout(() => {
        handlePublicar(capturado, texto);
      }, 100);
    } else {
      setModalVisible(true);
    }
  };

  const abrirCamaraKotlin = async (forzarEspontanea = false) => {
    const esEsp = typeof forzarEspontanea === 'boolean' ? forzarEspontanea : false;
    try {
      if (Platform.OS !== 'android') return;
      const modulo = NativeModules.HistoriasLabNative;
      if (!modulo) return;

      if (esEsp) {
        setModalVisible(true);
      }

      const rutaCruda = await modulo.abrirCamaraHistorias(false, esEsp);
      if (rutaCruda) {
        setModalVisible(true);
        const uriOriginal = `file://${rutaCruda}`;
        const esVideo = rutaCruda.endsWith('.mp4');

        if (esVideo) {
          try {
            setOptimizandoVideo(true);
            setProgresoMsg('Optimizando video...');
            await new Promise(resolve => setTimeout(resolve, 100));

            const uriComprimida = await comprimirVideoPro(uriOriginal);
            if (uriComprimida) {
              setArchivoCapturado({ tipo: 'video', uri: uriComprimida });
            } else {
              setArchivoCapturado({ tipo: 'video', uri: uriOriginal });
            }
          } catch (e) {
            console.log("Error en compresión:", e);
            setArchivoCapturado({ tipo: 'video', uri: uriOriginal });
          } finally {
            setOptimizandoVideo(false);
          }
        } else {
          setArchivoCapturado({ tipo: 'foto', uri: uriOriginal });
        }

        setVistaPreviaAbierta(true);
      } else if (forzarEspontanea) {
        // Si canceló la espontánea, limpiamos
        setEsEspontanea(false);
        setDesafioContexto(null);
        setModalVisible(false);
      }
    } catch (e) {
      console.log("Error camara kotlin:", e);
      setOptimizandoVideo(false);
    }
  };

  const handleFotoSeleccionada = (uri) => {
    setArchivoCapturado({ tipo: 'foto', uri });
    setVistaPreviaAbierta(true);
  };

  const handlePublicar = async (mediaOverride = null, textoSobreMediaOverride = null) => {
    if (estaSubiendo) return;

    // La validación de ubicación SOLO es obligatoria para Alertas Comunitarias
    if (modoAlertas && !localidad) {
        const provCheck = provincia || miPerfil?.provincia || 'Buenos Aires';
        const isBsAs = provCheck === 'Buenos Aires';
        const labelNivel3Text = isBsAs ? 'la Localidad' : 'el Municipio';
        Alert.alert("Ubicación requerida", `Por favor selecciona ${labelNivel3Text} para tu aviso comunitario.`);
        return;
    }

    try {
      setEstaSubiendo(true);
      setModalVisible(false);
      onCaptureFlowChange?.(true);

      const validMediaOverride = (mediaOverride && typeof mediaOverride === 'object' && !mediaOverride.nativeEvent && !mediaOverride.target && mediaOverride.uri) ? mediaOverride : null;
      const media = validMediaOverride || archivoCapturado;
      let uriParaSubir = media?.uri || null;
      const uriOriginalModeracion = media?.tipo === 'foto' ? media.uri : null;
      let thumbnailUri = media?.thumbnailLocal || null;
      let thumbnailLqUri = null;
      let tipo = media?.tipo || archivoCapturado?.tipo || 'texto';
      let esEsp = media?.esEspontanea || archivoCapturado?.esEspontanea || esEspontanea;
      let desafioId = media?.desafioId || archivoCapturado?.desafioId || desafioContexto?.desafioId || null;
      const textoFinalSobreMedia = (textoSobreMediaOverride !== null && textoSobreMediaOverride !== undefined && typeof textoSobreMediaOverride === 'string') ? textoSobreMediaOverride : textoSobreMedia;

      const temporalesParaLimpiar = [];
      console.log("📸 [POST] Iniciando publicación. Tipo:", tipo, "Espontánea:", esEsp);

      // --- OPTIMIZACIÓN DE IMAGEN ---
      if (tipo === 'foto' && uriParaSubir) {
          console.log("🖼️ [IMAGEN] Iniciando optimización para el Muro...");

          // Log tamaño original
          const infoOriginal = await FileSystem.getInfoAsync(uriParaSubir);
          const sizeMB = (infoOriginal.size / (1024 * 1024)).toFixed(2);
          console.log(`📏 [IMAGEN] Tamaño original: ${sizeMB} MB`);

          // 1. Crear placeholder LQ
          const lq = await generarMiniaturaUltraLQ(uriParaSubir);
          if (lq) {
              thumbnailLqUri = lq.uri;
              temporalesParaLimpiar.push(lq.uri);
          }

          // 2. Comprimir imagen principal
          const principal = await comprimirImagenPrincipal(uriParaSubir);
          if (principal) {
              uriParaSubir = principal.uri;
              temporalesParaLimpiar.push(principal.uri);

              const infoFinal = await FileSystem.getInfoAsync(uriParaSubir);
              const sizeKB = (infoFinal.size / 1024).toFixed(2);
              const ahorro = (((infoOriginal.size - infoFinal.size) / infoOriginal.size) * 100).toFixed(1);
              console.log(`✅ [IMAGEN] Optimización completa: ${sizeKB} KB (Ahorro: ${ahorro}%)`);
          }
      }

      // Emitimos el inicio para mostrar el "Ghost Post" en el muro (tanto social como alertas)
      DeviceEventEmitter.emit('ON_POST_UPLOAD_START', {
        id: 'uploading-' + Date.now(),
        userId: auth.currentUser.uid,
        userName: miPerfil?.nombre || 'Tú',
        userPhoto: miPerfil?.fotoUrl || null,
        userPhotoUrl: miPerfil?.fotoUrl || null,
        tipo: tipo,
        texto: textoPost.trim(),
        url: thumbnailUri || uriParaSubir,
        thumbnailLqUrl: thumbnailLqUri, // Placeholder para el ghost post
        status: 'uploading',
        uploadProgress: tipo === 'texto' ? 100 : 0,
        esAlerta: modoAlertas,
        tipoAlerta: tipoAlerta,
        localidad: localidad,
        barrio: barrioManual.trim()
      });

      if (modoAlertas) {
          let mediaUrl = null;
          let mediaLqUrl = null;
          let evaluacionAlerta = null;
          if (uriParaSubir) {
            evaluacionAlerta = await evaluarImagenSensible(uriOriginalModeracion || uriParaSubir);

              const storagePath = `alertas/${auth.currentUser.uid}/${Date.now()}.jpg`;
              mediaUrl = await subirArchivoConRuta(uriParaSubir, 'foto', storagePath, (trans, total) => {
                  DeviceEventEmitter.emit('ON_POST_UPLOAD_PROGRESS', { progress: Math.round((trans / total) * 100) });
              });
          }

          // Subir miniatura LQ si existe (Alertas)
          if (thumbnailLqUri) {
              mediaLqUrl = await subirArchivoConRuta(thumbnailLqUri, 'foto', `alertas/${auth.currentUser.uid}/${Date.now()}_lq.jpg`);
          }

            const statusAlerta = evaluacionAlerta && evaluacionAlerta.accion !== 'APROBADO'
            ? 'pendiente_revision'
            : 'ready';
            const userId = auth.currentUser.uid;
            const userName = miPerfil?.nombre || auth.currentUser.displayName || 'Usuario';
            const provParaGuardar = provincia || miPerfil?.provincia || 'Buenos Aires';
            const partParaGuardar = partido || miPerfil?.partido || miPerfil?.localidad || 'Merlo';
            const alertaRef = await addDoc(collection(db, 'alertas_comunitarias'), {
              userId, userName, userPhoto: miPerfil?.fotoUrl || null,
              texto: textoPost.trim(), tipo: tipoAlerta, url: mediaUrl,
              thumbnailLqUrl: mediaLqUrl,
              textoSobreMedia: (textoFinalSobreMedia || '').trim(),
              provincia: provParaGuardar, partido: partParaGuardar, localidad, barrio: barrioManual.trim(), coords,
              status: statusAlerta,
              createdAt: serverTimestamp()
          });

            // Procesar menciones (@Nombre) para notificar
            await procesarMencionesEnTexto(textoPost.trim(), alertaRef.id, 'alertas_comunitarias');

            if (statusAlerta === 'pendiente_revision') {
              const motivoRevision = evaluacionAlerta?.accion === 'ERROR'
              ? 'No se pudo completar la moderación automática; requiere revisión manual'
              : evaluacionAlerta?.accion === 'BLOQUEAR'
                ? 'Contenido explícito detectado automáticamente; requiere revisión manual antes de resolver el aviso'
                : 'Imagen dudosa/sensible detectada automáticamente por moderación en la nube';

              try {
                await enviarReporte({
                  tipo: 'alerta_moderacion_automatica',
                  idContenido: alertaRef.id,
                  idAutor: userId,
                  motivo: motivoRevision,
                  extraData: {
                    url: mediaUrl,
                    thumbnailUrl: mediaLqUrl,
                    puntajeSensibilidad: evaluacionAlerta?.puntaje || 0,
                    detalles: evaluacionAlerta?.detalles || {},
                    errorModeracion: evaluacionAlerta?.accion === 'ERROR' ? evaluacionAlerta.motivo : null,
                    userName,
                    userPhotoUrl: miPerfil?.fotoUrl || null,
                    tipo: tipoAlerta,
                    barrio: barrioManual.trim(),
                    localidad,
                    collectionName: 'alertas_comunitarias'
                  }
                });
              } catch (errReporte) {
                console.error('Error al registrar alerta para revisión:', errReporte);
              }

              try {
                await crearNotificacionModeracion({
                  paraUserId: userId,
                  tipo: 'alerta_en_revision',
                  postId: alertaRef.id,
                  collectionName: 'alertas_comunitarias',
                  texto: 'Tu publicación está en revisión por nuestro equipo de moderación.'
                });
              } catch (errNotif) {
                console.error('Error al crear notificación de revisión de alerta:', errNotif);
              }

              showToast('Tu publicación está en revisión por nuestro equipo de moderación.', 'review');
            }
      } else {
          // Para el muro social no enviamos ubicación forzada
          const resPost = await subirPostAFirebase({
            uri: uriParaSubir, tipo: tipo, thumbnailUri,
            uriModeracion: uriOriginalModeracion,
            thumbnailLqUri,
            texto: textoPost.trim(), textoSobreMedia: (textoFinalSobreMedia || '').trim(),
            esEspontanea: esEsp,
            desafioId: desafioId,
            provincia: null, partido: null, localidad: null, barrio: null, coords: null,
            onProgress: ({ progreso }) => DeviceEventEmitter.emit('ON_POST_UPLOAD_PROGRESS', { progress: progreso })
          });

          if (resPost?.bloqueado) {
            Alert.alert("Publicación no permitida 🚫", resPost.error || "Tu publicación fue rechazada por moderación.");
            await limpiarRastroSubida();
            await mantenimientoInteligente(200, 150);
            for (const t of temporalesParaLimpiar) {
                try { await FileSystem.deleteAsync(t, { idempotent: true }); } catch (e) {}
            }
            limpiarCampos();
            DeviceEventEmitter.emit('ON_POST_UPLOAD_END');
            return;
          }

          if (resPost?.status === 'pendiente_revision') {
            showToast('Tu publicación está en revisión por nuestro equipo de moderación.', 'review');
          } else {
            showToast("¡Publicado con éxito!", "success");
          }
      }

      await limpiarRastroSubida();
      await mantenimientoInteligente(200, 150);

      // Limpiar temporales
      for (const t of temporalesParaLimpiar) {
          try { await FileSystem.deleteAsync(t, { idempotent: true }); } catch (e) {}
      }
      limpiarCampos();
      DeviceEventEmitter.emit('ON_POST_UPLOAD_END');
    } catch (e) {
      DeviceEventEmitter.emit('ON_POST_UPLOAD_END');
      if (e?.message && (e.message.includes('desnudez') || e.message.includes('obsceno') || e.message.includes('rechazada'))) {
        Alert.alert("Publicación no permitida 🚫", e.message);
      } else {
        Alert.alert("Error", e?.message || "No se pudo publicar.");
      }
    } finally { setEstaSubiendo(false); }
  };

  const limpiarCampos = () => {
    setTextoPost(''); setArchivoCapturado(null); setTextoSobreMedia('');
    setEsEspontanea(false); setDesafioContexto(null); setBarrioManual(''); setCoords(null);
    setTipoAlerta(null);
  };

  const renderContenidoAlertas = (labelPartido, labelLocalidad) => {
    const paso1Completado = !!tipoAlerta && !!localidad && barrioManual.trim().length > 2;

    return (
      <View style={styles.alertFormContainer}>
        <View style={styles.alertHeaderMinimal}>
          <Text style={[styles.alertSubtitleMinimal, { flexShrink: 1, marginRight: 10 }]} numberOfLines={1}>NUEVO AVISO COMUNITARIO</Text>
          <View style={styles.lockedBadge}>
            <Ionicons name="location" size={12} color="#6B7280" />
            <Text style={styles.lockedBadgeText} numberOfLines={1} ellipsizeMode="tail">{partido}</Text>
          </View>
        </View>

        {/* PASO 1: SELECCIÓN DE TIPO Y UBICACIÓN */}
        <Text style={styles.pasoTitulo}>Paso 1: ¿Qué tipo de aviso es y dónde ocurre?</Text>
        <View style={styles.tipoSelectorRow}>
          <TouchableOpacity
            style={[styles.tipoBtn, tipoAlerta === 'Alerta' && styles.tipoBtnAlertaActive]}
            onPress={() => setTipoAlerta('Alerta')}
          >
            <Ionicons name="megaphone" size={20} color={tipoAlerta === 'Alerta' ? '#FFF' : '#EF4444'} />
            <Text style={[styles.tipoBtnText, tipoAlerta === 'Alerta' && styles.tipoBtnTextActive]}>ALERTA</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tipoBtn, tipoAlerta === 'General' && styles.tipoBtnGeneralActive]}
            onPress={() => setTipoAlerta('General')}
          >
            <Ionicons name="business" size={20} color={tipoAlerta === 'General' ? '#FFF' : '#3B82F6'} />
            <Text style={[styles.tipoBtnText, tipoAlerta === 'General' && styles.tipoBtnTextActive]}>GENERAL</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.locRowCompact}>
          <TouchableOpacity style={styles.locSelectCompact} onPress={() => setModalLocVisible(true)}>
            <Text style={styles.locLabelCompact}>{labelLocalidad}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
              <Text style={styles.locValueCompact} numberOfLines={1}>{localidad || "Seleccionar..."}</Text>
              <Ionicons name="chevron-down" size={14} color="#9CA3AF" />
            </View>
          </TouchableOpacity>

          <View style={styles.barrioInputCompact}>
            <Text style={styles.locLabelCompact}>Barrio</Text>
            <TextInput
              placeholder="Ej: Pompeya"
              style={styles.barrioTextInput}
              value={barrioManual}
              onChangeText={setBarrioManual}
            />
          </View>
        </View>

        {/* PASO 2: CONTENIDO Y FOTO (SOLO SI PASO 1 ESTÁ OK) */}
        {paso1Completado ? (
          <View style={{ marginTop: 10 }}>
            <View style={styles.dividerPaso} />
            <Text style={styles.pasoTitulo}>Paso 2: Describe lo sucedido y agrega una foto</Text>

            {queryMencion !== null && (
              <View style={{ maxHeight: 420, marginBottom: 10 }}>
                <SelectorMenciones
                  query={queryMencion}
                  onSelect={handleSelectUsuario}
                  onClose={() => setQueryMencion(null)}
                />
              </View>
            )}

            <TextInput
              style={styles.alertInputMain}
              placeholder="¿Qué está pasando? Puedes mencionar escribiendo @nombre"
              multiline
              value={textoPost}
              onChangeText={handleTextChange}
              onSelectionChange={(e) => setCursorPos(e.nativeEvent.selection.start)}
            />

            <View style={styles.alertMediaSection}>
              {archivoCapturado ? (
                <View style={styles.mediaPreviewContainer}>
                  <Image
                    source={{ uri: archivoCapturado.thumbnailLocal || archivoCapturado.uri }}
                    style={styles.mediaPreview}
                  />
                  <TouchableOpacity style={styles.removeMediaBtn} onPress={() => {setArchivoCapturado(null); setTextoSobreMedia('');}}>
                    <Ionicons name="close-circle" size={32} color="#EF4444" />
                  </TouchableOpacity>
                  {textoSobreMedia ? (
                    <View style={styles.alertOverlayTextBadge}>
                      <Text style={styles.alertOverlayTextBadgeTxt} numberOfLines={1}>{textoSobreMedia}</Text>
                    </View>
                  ) : null}
                  {archivoCapturado.tipo === 'video' && (
                    <View style={styles.videoBadge}>
                      <Ionicons name="play" size={16} color="white" />
                      <Text style={styles.videoBadgeText}>VIDEO</Text>
                    </View>
                  )}
                </View>
              ) : (
                <SelectorFotoComunidad
                  onFotoSeleccionada={handleFotoSeleccionada}
                  fotosActualesCount={0}
                  mantenerCamaraAbierta
                  cerrarCamara={cerrarCamara}
                />
              )}
            </View>

            <TouchableOpacity
              style={[styles.alertPublishBtn, (!textoPost.trim() && !archivoCapturado) && { opacity: 0.5 }]}
              onPress={handlePublicar}
              disabled={(!textoPost.trim() && !archivoCapturado) || estaSubiendo}
            >
              {estaSubiendo ? <ActivityIndicator color="white" /> : <Text style={styles.alertPublishBtnTxt}>PUBLICAR EN MI BARRIO</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.waitingContainer}>
            <Ionicons name="lock-closed" size={24} color="#D1D5DB" />
            <Text style={styles.waitingText}>Completa el Paso 1 para habilitar el contenido</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {modoAlertas && <HeaderComunidad perfil={miPerfil} clima={clima} />}
      {childrenFiltro}
      <TouchableOpacity style={styles.inputRow} onPress={() => setModalVisible(true)}>
        {miPerfil?.fotoUrl ? (
          <Image
            source={{ uri: miPerfil.fotoUrl }}
            style={styles.inputAvatar}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.inputAvatar, styles.avatarPlaceholder]}>
            <HaloUserIcon size={24} color="#FFF" />
          </View>
        )}
        <View style={styles.fakeInputPill}>
          <Text style={styles.fakeInputText}>
            {modoAlertas ? "¿Qué pasa en tu barrio?" : `¿Qué tenés en mente,\n${miPerfil?.nombre || 'vecino'}?`}
          </Text>
          <Ionicons name="camera" size={24} color="#FF6600" style={{ flexShrink: 0 }} />
        </View>
      </TouchableOpacity>

      {!modoAlertas && (
        <TouchableOpacity
          style={styles.desafioShortcut}
          onPress={() => DeviceEventEmitter.emit('OPEN_AMIGOS_DESAFIO', true)}
        >
          <View style={styles.desafioIconBg}>
            <Ionicons name="sparkles" size={18} color="#FF6600" />
          </View>
          <Text style={styles.desafioShortcutText}>Desafío espontáneo</Text>
          <Ionicons name="chevron-forward" size={18} color="#FF6600" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      )}

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={28} color="#333" /></TouchableOpacity>
            <Text style={styles.modalTitle}>{modoAlertas ? 'Alerta Vecinal' : 'Crear Publicación'}</Text>
            {!modoAlertas && <TouchableOpacity onPress={handlePublicar} style={styles.modalPublicarBtn}><Text style={styles.modalPublicarBtnText}>Publicar</Text></TouchableOpacity>}
          </View>

          {(() => {
             const isBsAs = provincia === 'Buenos Aires';
             const labelPartido = isBsAs ? 'Partido' : 'Departamento';
             const labelLocalidad = isBsAs ? 'Localidad' : 'Municipio';

             return (
               <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {modoAlertas ? renderContenidoAlertas(labelPartido, labelLocalidad) : (
                <View style={styles.generalPostForm}>
                  <View style={styles.userInfoRow}>
                      {miPerfil?.fotoUrl ? (
                        <Image
                          source={{ uri: miPerfil.fotoUrl }}
                          style={styles.userAvatar}
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
                          <HaloUserIcon size={28} color="#FFF" />
                        </View>
                      )}
                      <Text style={styles.userNameText}>{miPerfil?.nombre || 'Usuario'}</Text>
                  </View>

                  {queryMencion !== null && <View style={{ maxHeight: 420, marginBottom: 10 }}><SelectorMenciones query={queryMencion} onSelect={handleSelectUsuario} onClose={() => setQueryMencion(null)} /></View>}

                  <View style={styles.inputAndCameraRow}>
                      <TextInput
                          style={styles.modalInputGeneral}
                          placeholder="¿Qué quieres publicar?"
                          placeholderTextColor="#9CA3AF"
                          multiline
                          value={textoPost}
                          onChangeText={handleTextChange}
                          onSelectionChange={(e) => setCursorPos(e.nativeEvent.selection.start)}
                      />
                      <TouchableOpacity style={styles.softOrangeBtn} onPress={() => abrirCamaraKotlin(false)}>
                          <Ionicons name="images" size={30} color="#FF6600" />
                      </TouchableOpacity>
                  </View>

                  {archivoCapturado && (
                      <View style={styles.mediaPreviewContainer}>
                          <Image
                              source={{ uri: archivoCapturado.thumbnailLocal || archivoCapturado.uri }}
                              style={styles.mediaPreview}
                          />
                          <TouchableOpacity style={styles.removeMediaBtn} onPress={() => {setArchivoCapturado(null); setTextoSobreMedia('');}}>
                              <Ionicons name="close-circle" size={32} color="#EF4444" />
                          </TouchableOpacity>
                          {textoSobreMedia ? (
                              <View style={styles.alertOverlayTextBadge}>
                                  <Text style={styles.alertOverlayTextBadgeTxt} numberOfLines={1}>{textoSobreMedia}</Text>
                              </View>
                          ) : null}
                          {archivoCapturado.tipo === 'video' && (
                              <View style={styles.videoBadge}>
                                  <Ionicons name="play" size={16} color="white" />
                                  <Text style={styles.videoBadgeText}>VIDEO</Text>
                              </View>
                          )}
                      </View>
                  )}
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
             );
          })()}
        </View>

        <SelectorModal visible={modalProvVisible} onClose={() => setModalProvVisible(false)} data={PROVINCIAS_ARGENTINA} onSelect={(item) => {setProvincia(item); setPartido(''); setLocalidad(''); setModalProvVisible(false);}} titulo="Provincia" />
        <SelectorModal visible={modalPartVisible} onClose={() => setModalPartVisible(false)} data={partidos} onSelect={(item) => {setPartido(item); setLocalidad(''); setModalPartVisible(false);}} titulo={provincia === 'Buenos Aires' ? "Partido" : "Departamento"} cargando={cargandoPart} />
        <SelectorModal visible={modalLocVisible} onClose={() => setModalLocVisible(false)} data={localidades} onSelect={(item) => {setLocalidad(item); setModalLocVisible(false);}} titulo={provincia === 'Buenos Aires' ? `Localidades de ${partido}` : `Municipios de ${partido}`} cargando={cargandoLoc} />

        {optimizandoVideo && (
          <View style={styles.optimizandoOverlay}>
            <ActivityIndicator size="large" color="#FF6600" />
            <Text style={styles.optimizandoTxt}>{progresoMsg}</Text>
          </View>
        )}
      </Modal>

      <Modal visible={vistaPreviaAbierta} animationType="slide">
        {archivoCapturado && (
          <VistaPrevia
            archivo={archivoCapturado}
            onDescartar={() => {
              setVistaPreviaAbierta(false);
              setArchivoCapturado(null);
              if (esEspontanea) {
                setTimeout(() => {
                  abrirCamaraKotlin(true);
                }, 300);
              }
            }}
            onPublicar={handleMediaEditada}
          />
        )}
      </Modal>

    </View>
  );
}

function SelectorItem({ label, value, onPress, disabled }) {
    return (
        <TouchableOpacity style={[styles.selectorItem, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}>
            <Text style={styles.selectorLabel}>{label}:</Text>
            <Text style={styles.selectorValue}>{value || "Seleccionar..."}</Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
        </TouchableOpacity>
    );
}

function SelectorModal({ visible, onClose, data, onSelect, titulo, cargando }) {
    const [search, setSearch] = useState('');
    const listaSegura = Array.isArray(data) ? data : [];
    const filtrados = listaSegura.filter(i => i && i.toLowerCase().includes(search.toLowerCase()));

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeaderInner}>
                        <Text style={styles.modalTitleInner}>{titulo}</Text>
                        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#333" /></TouchableOpacity>
                    </View>

                    <View style={styles.modalSearchBox}>
                        <Ionicons name="search" size={18} color="#999" />
                        <TextInput
                            placeholder="Buscar..."
                            style={styles.modalSearchInput}
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>

                    {cargando ? (
                        <ActivityIndicator color="#FF6600" style={{ margin: 20 }} />
                    ) : (
                        <FlatList
                            data={filtrados}
                            keyExtractor={(item, index) => `${item}-${index}`}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.modalListItem}
                                    onPress={() => { onSelect(item); setSearch(''); }}
                                >
                                    <Text style={styles.modalListItemText}>{item}</Text>
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={{ paddingBottom: 60 }}
                            removeClippedSubviews={true}
                            initialNumToRender={15}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFF', padding: 12, marginHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#EEE' },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 42 },
  inputAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  avatarPlaceholder: { backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  fakeInputPill: { flex: 1, minHeight: 45, backgroundColor: '#F0F2F5', borderRadius: 22, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 6 },
  fakeInputText: { flex: 1, flexShrink: 1, color: '#65676B', fontSize: 15, marginRight: 8 },
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalPublicarBtn: { backgroundColor: '#FF6600', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  modalPublicarBtnText: { color: '#FFF', fontWeight: 'bold' },
  modalBody: { flex: 1, padding: 15 },
  userInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  userAvatar: { width: 45, height: 45, borderRadius: 22, marginRight: 12 },
  userNameText: { fontSize: 24, fontWeight: 'bold' },
  locBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5F0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: '#FFE0CC' },
  locText: { fontSize: 12, color: '#FF6600', marginLeft: 4, fontWeight: 'bold' },
  modalInput: { fontSize: 18, minHeight: 120, textAlignVertical: 'top' },
  mediaPreviewContainer: { marginTop: 15, position: 'relative' },
  mediaPreview: { width: '100%', height: 350, borderRadius: 12, backgroundColor: '#EEE' },
  removeMediaBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'white', borderRadius: 20 },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#FF6600', marginVertical: 15 },
  gpsBtnActive: { backgroundColor: '#FF6600' },
  gpsBtnTxt: { marginLeft: 10, color: '#FF6600', fontWeight: 'bold' },
  locationSelectors: { marginTop: 15, backgroundColor: '#F9FAFB', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#EEE' },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#9CA3AF', marginBottom: 15, textTransform: 'uppercase' },
  selectorItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  selectorLabel: { fontSize: 14, color: '#6B7280', width: 90 },
  selectorValue: { flex: 1, fontSize: 14, fontWeight: 'bold', color: '#111827' },
  barrioInput: { backgroundColor: '#FFF', padding: 12, borderRadius: 10, marginTop: 15, borderWidth: 1, borderColor: '#EEE', fontSize: 14 },
  footerActions: { padding: 15, borderTopWidth: 1, borderTopColor: '#EEE' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5F0', padding: 15, borderRadius: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#FFE0CC' },
  actionBtnText: { marginLeft: 10, color: '#FF6600', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', height: '65%', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20 },
  modalHeaderInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitleInner: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  modalSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, height: 45 },
  modalSearchInput: { flex: 1, marginLeft: 10, fontSize: 15 },
  modalListItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalListItemText: { fontSize: 16, color: '#333' },
  // Estilos Alertas Unificada
  alertFormContainer: { paddingVertical: 5 },
  alertHeaderMinimal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  alertSubtitleMinimal: { fontSize: 12, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1 },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4, flexShrink: 1, maxWidth: '50%' },
  lockedBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#6B7280' },
  tipoSelectorRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  tipoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#F3F4F6', gap: 8, backgroundColor: '#F9FAFB' },
  tipoBtnAlertaActive: { borderColor: '#EF4444', backgroundColor: '#EF4444' },
  tipoBtnGeneralActive: { borderColor: '#3B82F6', backgroundColor: '#3B82F6' },
  tipoBtnText: { fontSize: 13, fontWeight: '900', color: '#6B7280' },
  tipoBtnTextActive: { color: '#FFF' },
  locRowCompact: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  locSelectCompact: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 55,
    justifyContent: 'center'
  },
  locLabelCompact: { fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', textTransform: 'uppercase' },
  locValueCompact: { fontSize: 13, fontWeight: 'bold', color: '#111827', marginTop: 2 },
  barrioInputCompact: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 55,
    justifyContent: 'center'
  },
  barrioTextInput: { fontSize: 13, fontWeight: 'bold', color: '#111827', padding: 0, marginTop: 2 },
  alertInputMain: { fontSize: 16, backgroundColor: '#F9FAFB', padding: 15, borderRadius: 15, minHeight: 100, textAlignVertical: 'top', marginBottom: 15, borderWidth: 1, borderColor: '#F3F4F6' },
  alertMediaSection: { marginBottom: 20 },
  alertPublishBtn: { backgroundColor: '#059669', padding: 16, borderRadius: 15, alignItems: 'center', elevation: 3 },
  alertPublishBtnTxt: { color: 'white', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  alertOverlayTextBadge: { position: 'absolute', bottom: 10, left: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 5, borderRadius: 5 },
  alertOverlayTextBadgeTxt: { color: 'white', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  pasoTitulo: { fontSize: 12, fontWeight: 'bold', color: '#374151', marginBottom: 10, textTransform: 'uppercase' },
  dividerPaso: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 15 },
  waitingContainer: { alignItems: 'center', padding: 30, backgroundColor: '#F9FAFB', borderRadius: 15, borderDashOffset: 5, borderStyle: 'dashed', borderWidth: 1, borderColor: '#D1D5DB', marginTop: 10 },
  waitingText: { fontSize: 13, color: '#9CA3AF', fontWeight: '600', marginTop: 10, textAlign: 'center' },
  // Estilos Muro Social Refinado
  generalPostForm: { paddingVertical: 5 },
  locMinimalRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
  locMinimalText: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  inputAndCameraRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginVertical: 15 },
  modalInputGeneral: { flex: 1, fontSize: 20, color: '#111827', minHeight: 120, textAlignVertical: 'top', paddingTop: 12, fontWeight: '600' },
  softOrangeBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFE0CC',
    elevation: 2,
    shadowColor: '#FF6600',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginTop: 0
  },
  optimizandoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999
  },
  optimizandoTxt: {
    marginTop: 10,
    color: '#FF6600',
    fontWeight: 'bold',
    fontSize: 14
  },
  videoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4
  },
  videoBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold'
  },
  desafioShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    padding: 10,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  desafioIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFEDD5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  desafioShortcutText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FF6600',
  }
});
