import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Dimensions, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import AnimatedReanimated, { Extrapolate, interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';
import { tiempoRelativo } from '../../services/dateUtils';
import { eliminarHistoriaAFirebase, enviarMensajeChat, enviarReporte, reaccionarHistoria, registrarVistaHistoria } from '../../services/firebaseService';
import SelectorOpcionesModal from '../reportes/SelectorOpcionesModal';
import SelectorReporteModal from '../reportes/SelectorReporteModal';
import { showToast } from '../utilidades/CustomToast';
import BarraProgreso from './BarraProgreso';
import DetalleVistas from './DetalleVistas';
import styles from './estilosReproductorHistorias';

const { width } = Dimensions.get('window');

const EMOJIS_REACCIONES = [
  '😊', '😂', '❤️', '👍', '🙏', '🔥', '😮', '😢', '🙌', '✨', '😎', '✅',
  '🤩', '🤔', '💪', '🎉', '😡', '😴', '💬', '📍', '⭐', '🎈', '🎨', '🚀',
  '😍', '😭', '😱', '🤫', '🤝', '🍕', '🍻', '🌈', '☀', '💯', '💥', '🏃',
];

export default function ReproductorHistorias({
  usuario,
  estaActivo,
  irSiguienteUsuario,
  irAnteriorUsuario,
  alCerrar,
  initialStoryId
}) {
  const router = useRouter();
  const [idxHistoria, setIdxHistoria] = useState(0);
  const [pausadoManual, setPausadoManual] = useState(false);

  useEffect(() => {
    if (initialStoryId && usuario?.stories) {
      const foundIdx = usuario.stories.findIndex(s => s.id === initialStoryId);
      if (foundIdx !== -1) {
        setIdxHistoria(foundIdx);
      }
    }
  }, [initialStoryId, usuario]);
  const [videoCargado, setVideoCargado] = useState(false);
  const [videoAndando, setVideoAndando] = useState(false);
  const [duracionVideo, setDuracionVideo] = useState(5000);
  const [texto, setTexto] = useState('');
  const [estaEnviando, setEstaEnviando] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [verVistas, setVerVistas] = useState(false);
  const [historiaRealtime, setHistoriaRealtime] = useState(null);
  const [mostrarOpcionesModal, setMostrarOpcionesModal] = useState(false);
  const [mostrarReporteModal, setMostrarReporteModal] = useState(false);

  const insets = useSafeAreaInsets() || { top: 0, bottom: 0 };
  const keyboardHeight = useSharedValue(0);
  const inputRef = useRef(null);

  useKeyboardHandler({
    onStart: (e) => {
      'worklet';
      keyboardHeight.value = e.height;
    },
    onMove: (e) => {
      'worklet';
      keyboardHeight.value = e.height;
    },
    onEnd: (e) => {
      'worklet';
      keyboardHeight.value = e.height;
    },
  });

  const animatedFooterStyle = useAnimatedStyle(() => {
    // Cuando el teclado está cerrado (height = 0), usamos un padding moderado (insets.bottom + 10)
    // Cuando el teclado está abierto, pegamos el input al teclado (padding 0)
    const dynamicPadding = interpolate(
      keyboardHeight.value,
      [0, 100],
      [Math.max(insets.bottom, 15), 0],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ translateY: -keyboardHeight.value }],
      paddingBottom: showEmojiPicker ? 0 : dynamicPadding,
    };
  });

  const historias = usuario?.stories || [];
  const actual = historias[idxHistoria];
  const siguiente = historias[idxHistoria + 1];

  const miId = auth.currentUser?.uid;
  const esMia = usuario?.userId === miId;
  const esFoto = actual?.type === 'foto';

  // --- LISTENER DE DATOS EN TIEMPO REAL (Para el dueño) ---
  useEffect(() => {
    if (estaActivo && actual?.id && esMia) {
      const unsub = onSnapshot(doc(db, 'historias', actual.id), (snap) => {
        if (snap.exists()) {
          setHistoriaRealtime({ id: snap.id, ...snap.data() });
        }
      });
      return () => unsub();
    } else {
      setHistoriaRealtime(null);
    }
  }, [estaActivo, actual?.id, esMia]);

  // --- REGISTRO DE VISTA ---
  useEffect(() => {
    if (estaActivo && actual && !esMia) {
      registrarVistaHistoria(actual.id);
    }
  }, [estaActivo, actual, esMia]);

  const [reaccionesLocales, setReaccionesLocales] = useState({});

  useEffect(() => {
    if (actual) {
      setReaccionesLocales(actual.reacciones || {});
    }
  }, [actual]);

  const loLikee = reaccionesLocales[miId] === 'like';

  const videoUrl = esFoto ? null : (actual?.url || null);
  const player = useVideoPlayer(videoUrl);

  const liberarPlayer = (p) => {
    if (!p) return;
    try {
      p.pause();
      p.muted = true;
    } catch (e) {}
  };

  useEffect(() => {
    return () => {
      liberarPlayer(player);
    };
  }, [player]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState !== 'active') {
        liberarPlayer(player);
      }
    });
    return () => sub.remove();
  }, [player]);

  // Silenciar, pausar o reanudar según estaActivo y pausadoManual
  useEffect(() => {
    if (!estaActivo) {
      if (player) {
        try {
          player.pause();
          player.muted = true;
        } catch (e) {}
      }
      setVideoAndando(false);
      return;
    }

    if (player && !esFoto) {
      try {
        player.muted = false;
        if (pausadoManual) {
          player.pause();
        } else {
          player.play();
        }
      } catch (e) {}
    }
  }, [estaActivo, player, esFoto, pausadoManual]);

  // Cargar video cuando cambia la historia actual o el usuario
  useEffect(() => {
    setVideoCargado(false);
    setVideoAndando(false);
    setTexto('');
    setShowEmojiPicker(false);

    if (esFoto) {
      setDuracionVideo(5000);
      setVideoAndando(true);
    } else if (player && videoUrl) {
      try {
        const forzarArranqueRápido = () => {
          if (!pausadoManual && estaActivo) {
            player.play();
          }
        };

        if (typeof player.replaceAsync === 'function') {
          player.replaceAsync(videoUrl).then(forzarArranqueRápido).catch(() => {});
        } else if (typeof player.replace === 'function') {
          player.replace(videoUrl);
          forzarArranqueRápido();
        }
      } catch (e) {}
    }
  }, [actual?.id, videoUrl, player, esFoto, estaActivo, pausadoManual]);

  // Oyentes de reproducción ÚNICAMENTE cuando la pantalla está activa
  useEffect(() => {
    if (!estaActivo || esFoto || !player) return;

    const verificarYArrancar = () => {
      if (player.status === 'readyToPlay') {
        setVideoCargado(true);
        if (!pausadoManual && estaActivo) {
          player.play();
        }
        if (player.duration > 0) {
          setDuracionVideo(player.duration * 1000);
        }
      }
    };

    const subStatus = player.addListener('statusChange', verificarYArrancar);
    const subPlaying = player.addListener('playingChange', (event) => {
      if (estaActivo) {
        setVideoAndando(event.isPlaying);
        // Seguro extra: si el video ya está reproduciéndose, forzamos la variable para quitar cualquier "pausa" visual
        if (event.isPlaying) {
            setVideoCargado(true);
        }
      }
    });
    const subEnd = player.addListener('playToEnd', () => {
      if (estaActivo) {
        irSiguiente();
      }
    });

    verificarYArrancar();

    return () => {
      subStatus.remove();
      subPlaying.remove();
      subEnd.remove();
    };
  }, [actual?.id, estaActivo, esFoto, player, pausadoManual]);

  const accionLock = useRef(false);

  const irSiguiente = () => {
    if (!estaActivo || !historias || historias.length === 0) return;
    if (accionLock.current) return;

    accionLock.current = true;
    setTimeout(() => { accionLock.current = false; }, 500);

    setIdxHistoria((prev) => {
      if (prev < historias.length - 1) {
        return prev + 1;
      } else {
        setTimeout(() => {
          if (estaActivo) irSiguienteUsuario();
        }, 0);
        return prev;
      }
    });
  };

  const irAnterior = () => {
    if (!historias || historias.length === 0) return;
    if (accionLock.current) return;

    accionLock.current = true;
    setTimeout(() => { accionLock.current = false; }, 500);

    setIdxHistoria((prev) => {
      if (prev > 0) {
        return prev - 1;
      } else {
        setTimeout(() => {
          irAnteriorUsuario();
        }, 0);
        return prev;
      }
    });
  };

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setPausadoManual(true);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      // Si el teclado baja, pero el selector de emojis está abierto, seguimos pausados.
      // Si ambos están cerrados, reanudamos.
      if (!showEmojiPicker) {
        setPausadoManual(false);
      }
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [showEmojiPicker]);

  // Nuevo useEffect para manejar la pausa cuando se abre/cierra el selector de emojis manualmente
  useEffect(() => {
    if (showEmojiPicker) {
      setPausadoManual(true);
    } else {
      // Solo reanudamos si el teclado tampoco está visible
      // (keyboardHeight es un shared value, pero podemos chequear el estado del teclado)
      const isKeyboardVisible = Keyboard.isVisible();
      if (!isKeyboardVisible) {
        setPausadoManual(false);
      }
    }
  }, [showEmojiPicker]);

  const enviarMensaje = async () => {
    if (!texto.trim() || estaEnviando) return;
    setEstaEnviando(true);
    try {
      await enviarMensajeChat({
        paraUserId: usuario.userId,
        texto: texto.trim(),
        storyContext: actual // Enviamos la historia actual como contexto
      });
      setTexto('');
      setShowEmojiPicker(false);
      setPausadoManual(false);
      Keyboard.dismiss();
      showToast('¡Respuesta enviada!', 'success');
    } catch (e) {
      Alert.alert('Error', 'No se pudo enviar la respuesta.');
    } finally {
      setEstaEnviando(false);
    }
  };

  const handleLike = async () => {
    if (!actual?.id || estaEnviando) return;
    try {
      const nuevoEstado = !loLikee;

      // Actualización optimista para que el corazón cambie al instante
      setReaccionesLocales(prev => ({
        ...prev,
        [miId]: nuevoEstado ? 'like' : null
      }));

      await reaccionarHistoria(actual.id, nuevoEstado ? 'like' : null);

      if (nuevoEstado) {
        // Enviar mensaje al chat con la reacción
        await enviarMensajeChat({
          paraUserId: usuario.userId,
          texto: '',
          storyContext: { ...actual, tipo_accion: 'like' }
        });
      }
    } catch (e) {
      // Revertimos en caso de error
      setReaccionesLocales(actual?.reacciones || {});
      console.log("Error al reaccionar:", e);
    }
  };

  const handleOpcionesHistoria = () => {
    setPausadoManual(true);
    setMostrarOpcionesModal(true);
  };

  const ejecutarReportar = async (motivo) => {
    setMostrarReporteModal(false);
    setMostrarOpcionesModal(false);
    try {
      await enviarReporte({
        tipo: 'historia',
        idContenido: actual.id,
        idAutor: usuario.userId,
        motivo,
        textoOpcional: actual.texto,
        extraData: {
          texto: actual.texto,
          type: actual.type,
          userName: usuario.userName
        }
      });
      Alert.alert('Gracias', 'Recibimos tu reporte.');
      irSiguiente();
    } catch (e) {
      Alert.alert('Error', 'No se pudo enviar el reporte.');
      setPausadoManual(false);
    }
  };

  const obtenerOpcionesHistoria = () => {
    return [
      {
        label: 'Ocultar historia',
        icon: 'eye-off-outline',
        color: '#374151',
        onPress: () => {
          setMostrarOpcionesModal(false);
          irSiguiente();
        }
      },
      {
        label: 'Reportar historia',
        icon: 'flag-outline',
        color: '#EF4444',
        onPress: () => setMostrarReporteModal(true)
      }
    ];
  };

  const irAlPerfil = () => {
    if (!usuario?.userId) return;
    if (usuario.userId === auth.currentUser?.uid) {
      router.push('/(tabs)/perfil');
    } else {
      router.push({
        pathname: '/(tabs)/perfilAjeno',
        params: { userId: usuario.userId }
      });
    }
  };

  if (!usuario || !actual) return null;

  return (
    <View style={styles.container}>
      {/* MARCO ESPECIAL PARA ESPONTÁNEAS */}
      {actual?.esEspontanea && (
        <View style={styles.marcoEspontanea} pointerEvents="none" />
      )}

      {/* FONDO DE SEGURIDAD (Miniatura Ultra-LQ para carga instantánea en < 0.01s) */}
      {(actual?.thumbnailLqUrl || actual?.thumbnailUrl || actual?.url) && (
        <Image
          source={{ uri: actual.thumbnailLqUrl || actual.thumbnailUrl || actual.url }}
          style={StyleSheet.absoluteFill}
          blurRadius={1}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
        />
      )}

      <View style={StyleSheet.absoluteFill}>
        {esFoto ? (
          <Image
            key={`img-${actual.id}`}
            source={{ uri: actual.url }}
            placeholder={{ uri: actual.thumbnailLqUrl || actual.thumbnailUrl }}
            placeholderContentFit="cover"
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={100}
            onLoad={() => setVideoCargado(true)}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={StyleSheet.absoluteFill}>
            {estaActivo && (
              <VideoView
                key={`vid-${actual.id}`}
                player={player}
                style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: videoCargado ? 1 : 0 }]}
                contentFit="cover"
                nativeControls={false}
              />
            )}
            {/* Miniatura nítida/LQ sobre el fondo mientras arranca el video o si no está activo */}
            {(!videoCargado || !estaActivo) && (actual.thumbnailLqUrl || actual.thumbnailUrl) && (
              <Image
                source={{ uri: actual.thumbnailLqUrl || actual.thumbnailUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={100}
                cachePolicy="memory-disk"
                priority="high"
              />
            )}
          </View>
        )}
      </View>

      {/* TEXTO FLOTANTE DE LA HISTORIA (Estilo Instagram) */}
      {actual?.texto ? (
        <View style={styles.textoHistoriaFlotante}>
          <Text style={styles.textoHistoriaContenido}>
            {actual.texto}
          </Text>
        </View>
      ) : null}

      <BarraProgreso
        historias={historias}
        idxHistoria={idxHistoria}
        estaActivo={estaActivo}
        pausadoManual={pausadoManual || (!esFoto && !videoAndando)}
        videoCargado={videoCargado}
        duracionVideo={duracionVideo}
        onTiempoCompleto={irSiguiente}
      />

      {/* Banda inferior para que sea pareja con la de arriba */}
      <View style={styles.fondoInferior} />

      <Pressable
        style={[StyleSheet.absoluteFill, { zIndex: 50 }]}
        onPress={(evt) => {
          const touchX = evt.nativeEvent.locationX;
          touchX < width / 3 ? irAnterior() : irSiguiente();
        }}
        onLongPress={() => setPausadoManual(true)}
        onPressOut={() => setPausadoManual(false)}
      />

      <View style={[styles.headerBand, { paddingTop: Math.max((insets.top || 0) + 12, 58) }]}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={irAlPerfil}>
          <Image
              source={{ uri: usuario.userPhotoUrl || 'https://picsum.photos/100' }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
          />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.username} numberOfLines={1}>{usuario.userName}</Text>
              {!esFoto && (
                <View style={styles.badgeVideoHeader}>
                  <Ionicons name="videocam" size={10} color="white" />
                  <Text style={styles.badgeVideoHeaderTxt}>VIDEO</Text>
                </View>
              )}
              {actual?.esEspontanea && (
                <View style={styles.badgeEspontaneaHeader}>
                  <Ionicons name="sparkles" size={12} color="white" />
                  <Text style={styles.badgeEspontaneaHeaderTxt}>ESPONTÁNEA</Text>
                </View>
              )}
            </View>
            <Text style={styles.timeTextHeader}>{tiempoRelativo(actual?.createdAt)}</Text>
          </View>
        </TouchableOpacity>
        {esMia ? (
          <TouchableOpacity style={styles.trashBtn} onPress={() => {
            Alert.alert('Borrar', '¿Borrar historia?', [
              { text: 'No', style: 'cancel' },
              { text: 'Sí', onPress: async () => { await eliminarHistoriaAFirebase(actual); irSiguiente(); }}
            ]);
          }}>
            <Ionicons name="trash-outline" size={24} color="white" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.trashBtn} onPress={handleOpcionesHistoria}>
            <Ionicons name="ellipsis-horizontal" size={24} color="white" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.closeBtn} onPress={alCerrar}>
          <Ionicons name="close" size={32} color="white" />
        </TouchableOpacity>
      </View>

      {estaActivo && !esMia && (
        <AnimatedReanimated.View style={[
          styles.footer,
          animatedFooterStyle,
          { backgroundColor: 'rgba(0,0,0,0.85)' } // Fondo que se mueve con el input
        ]}>
          <View style={styles.inputArea}>
            <View style={styles.inputBox}>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setTimeout(() => setShowEmojiPicker((p) => !p), 100);
                  setPausadoManual(true);
                }}
                style={{ marginRight: 8 }}
              >
                <Ionicons name={showEmojiPicker ? 'keypad' : 'happy-outline'} size={26} color="white" />
              </TouchableOpacity>

              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Responder..."
                placeholderTextColor="rgba(255,255,255,0.8)"
                value={texto}
                onChangeText={setTexto}
                multiline
                onFocus={() => {
                  setPausadoManual(true);
                  setShowEmojiPicker(false);
                }}
                onBlur={() => {
                  if (!showEmojiPicker) setPausadoManual(false);
                }}
              />
            </View>

            {texto.trim().length > 0 ? (
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={enviarMensaje}
                disabled={estaEnviando}
              >
                {estaEnviando ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Ionicons name="send" size={22} color="white" />
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.likeBtn} onPress={handleLike}>
                <Ionicons
                  name={loLikee ? "heart" : "heart-outline"}
                  size={32}
                  color={loLikee ? "#FF6600" : "white"}
                />
              </TouchableOpacity>
            )}
          </View>

          {showEmojiPicker && (
            <View style={[styles.emojiContainer, { paddingBottom: Math.max(10, insets.bottom + 6) }]}>
              <FlatList
                data={EMOJIS_REACCIONES}
                numColumns={7}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => setTexto(prev => prev + item)}
                    style={styles.emojiItem}
                  >
                    <Text style={{ fontSize: 28 }}>{item}</Text>
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingVertical: 10 }}
              />
            </View>
          )}
        </AnimatedReanimated.View>
      )}

      {/* --- BOTÓN DE VISTAS PARA EL DUEÑO --- */}
      {esMia && (
        <TouchableOpacity
          style={[styles.btnVistas, { bottom: Math.max(30, insets.bottom + 15) }]}
          onPress={() => {
            setPausadoManual(true);
            setVerVistas(true);
          }}
        >
          <Ionicons name="eye-outline" size={20} color="#FFFFFF" />
          <Text style={styles.vistasTexto}>
            {(historiaRealtime?.vistas || actual?.vistas) ? Object.keys(historiaRealtime?.vistas || actual?.vistas).length : 0} vistos
          </Text>
        </TouchableOpacity>
      )}

      <DetalleVistas
        visible={verVistas}
        onClose={() => {
          setVerVistas(false);
          setPausadoManual(false);
        }}
        story={historiaRealtime || actual}
      />

      {/* MODAL GLOBAL DE OPCIONES */}
      <SelectorOpcionesModal
        visible={mostrarOpcionesModal}
        onClose={() => {
          setMostrarOpcionesModal(false);
          setPausadoManual(false);
        }}
        titulo="Opciones de historia"
        opciones={obtenerOpcionesHistoria()}
      />

      {/* MODAL GLOBAL DE REPORTE */}
      <SelectorReporteModal
        visible={mostrarReporteModal}
        onClose={() => {
          setMostrarReporteModal(false);
          setPausadoManual(false);
        }}
        onReportar={ejecutarReportar}
      />

    </View>
  );
}