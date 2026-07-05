import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, NativeModules, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getVideoMetaData } from 'react-native-compressor';
import { auth } from '../../firebaseConfig';
import { escucharHistoriasCirculos, subirHistoriaAFirebase } from '../../services/firebaseService';
import { comprimirVideoPro } from '../camara/compresor3';
import VistaPrevia from '../camara/VistaPrevia';

const nombreUsuario = (uid) => {
  if (!uid) return 'Usuario';
  return `@${String(uid).slice(0, 6)}`;
};

export default function ContenedorHistorias() {
  const [historias, setHistorias] = useState([]);
  const [archivoCapturado, setArchivoCapturado] = useState(null);
  const [estaSubiendo, setEstaSubiendo] = useState(false);
  const [progresoMsg, setProgresoMsg] = useState('');
  const [progresoPct, setProgresoPct] = useState(0);

  const miUid = auth.currentUser?.uid || null;

  useEffect(() => {
    const unsub = escucharHistoriasCirculos(
      (items) => setHistorias(items),
      (error) => console.log('Error escuchando historias:', error?.message || error)
    );
    return () => unsub();
  }, []);

  const miHistoria = useMemo(
    () => historias.find((historia) => historia?.userId === miUid) || null,
    [historias, miUid]
  );

  const otrasHistorias = useMemo(
    () => historias.filter((historia) => historia?.userId && historia.userId !== miUid),
    [historias, miUid]
  );

  const abrirCamaraHistoria = async () => {
    if (!miUid) {
      Alert.alert('Inicia sesion', 'Debes iniciar sesion para publicar tu historia.');
      return;
    }

    try {
      if (Platform.OS !== 'android') {
        Alert.alert('Camara nativa', 'La camara Kotlin esta disponible por ahora solo en Android.');
        return;
      }

      const modulo = NativeModules.HistoriasLabNative;
      if (!modulo || typeof modulo.abrirCamaraHistorias !== 'function') {
        Alert.alert('Camara no disponible', 'No se encontro el modulo nativo HistoriasLabNative.');
        return;
      }

      const rutaCrudaAndroid = await modulo.abrirCamaraHistorias(false);
      if (!rutaCrudaAndroid) return;

      const esVideo = String(rutaCrudaAndroid).endsWith('.mp4');
      setArchivoCapturado({
        tipo: esVideo ? 'video' : 'foto',
        uri: `file://${rutaCrudaAndroid}`,
      });
    } catch (error) {
      console.log('Camara nativa cancelada o fallo:', error?.message || error);
    }
  };

  const generarMiniatura = async (videoUri) => {
    const tiempos = [120, 450, 900, 1400];
    for (const time of tiempos) {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time });
        if (uri) return uri;
      } catch (error) {
        console.log('Fallo miniatura historia:', error?.message || error);
      }
    }
    return null;
  };

  const handlePublicarHistoria = async () => {
    if (estaSubiendo || !archivoCapturado) return;

    const captura = archivoCapturado;

    try {
      setArchivoCapturado(null);
      setEstaSubiendo(true);
      setProgresoMsg('Preparando historia...');
      setProgresoPct(0);

      await new Promise((resolve) => setTimeout(resolve, 120));

      let uriParaSubir = captura.uri;
      let thumbnailUri = null;
      let duracionMs = null;
      let width = null;
      let height = null;
      const temporalesParaLimpiar = [];

      if (captura.tipo === 'video') {
        setProgresoMsg('Generando miniatura...');
        thumbnailUri = await generarMiniatura(captura.uri);
        if (thumbnailUri) temporalesParaLimpiar.push(thumbnailUri);

        setProgresoMsg('Comprimiendo video...');
        uriParaSubir = await comprimirVideoPro(captura.uri);
        if (uriParaSubir && uriParaSubir !== captura.uri) {
          temporalesParaLimpiar.push(uriParaSubir);
        }

        if (!thumbnailUri && uriParaSubir) {
          setProgresoMsg('Regenerando miniatura...');
          thumbnailUri = await generarMiniatura(uriParaSubir);
          if (thumbnailUri) temporalesParaLimpiar.push(thumbnailUri);
        }

        const meta = await getVideoMetaData(uriParaSubir);
        duracionMs = meta?.duration ? Math.round(Number(meta.duration) * 1000) : null;
        width = meta?.width ? Number(meta.width) : null;
        height = meta?.height ? Number(meta.height) : null;
      }

      const infoArchivo = await FileSystem.getInfoAsync(uriParaSubir, { size: true });
      const fileSizeBytes = infoArchivo?.exists ? infoArchivo.size ?? null : null;

      setProgresoMsg('Subiendo historia...');
      await subirHistoriaAFirebase({
        uri: uriParaSubir,
        tipo: captura.tipo,
        thumbnailUri,
        fileSizeBytes,
        duracionMs,
        width,
        height,
        onProgress: ({ fase, progreso }) => {
          const pct = Math.max(1, Math.min(100, Number(progreso) || 0));
          setProgresoPct(pct);
          if (fase === 'subiendo-media') {
            setProgresoMsg(`Subiendo archivo... ${pct}%`);
          } else if (fase === 'subiendo-thumbnail') {
            setProgresoMsg(`Subiendo miniatura... ${pct}%`);
          } else if (fase === 'completado') {
            setProgresoMsg('Historia publicada 100%');
          }
        },
      });

      for (const ruta of temporalesParaLimpiar) {
        try {
          await FileSystem.deleteAsync(ruta, { idempotent: true });
        } catch (error) {
          console.log('No se pudo limpiar temporal historia:', error?.message || error);
        }
      }
    } catch (error) {
      Alert.alert('Error', error?.message || 'No se pudo subir la historia.');
    } finally {
      setEstaSubiendo(false);
      setProgresoMsg('');
      setProgresoPct(0);
    }
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.lista}
      >
        <View style={styles.item}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, miHistoria ? styles.avatarConHistoria : styles.avatarPropiaSinHistoria]}>
              {miHistoria?.thumbnailUrl || miHistoria?.url ? (
                <Image
                  source={{ uri: miHistoria.thumbnailUrl || miHistoria.url }}
                  style={styles.innerMedia}
                />
              ) : (
                <View style={[styles.innerCircle, styles.innerCirclePropia]} />
              )}
            </View>

            <Pressable style={styles.plusBadge} onPress={abrirCamaraHistoria}>
              <Ionicons name="add" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
          <Text style={styles.nombre}>Tu historia</Text>
        </View>

        {otrasHistorias.map((historia) => (
          <View key={historia.id || historia.historiaId || historia.userId} style={styles.item}>
            <View style={[styles.avatar, styles.avatarOtro]}>
              {historia?.thumbnailUrl || historia?.url ? (
                <Image
                  source={{ uri: historia.thumbnailUrl || historia.url }}
                  style={styles.innerMedia}
                />
              ) : (
                <View style={styles.innerCircle}>
                  <Text style={styles.inicialTxt}>{String(nombreUsuario(historia?.userId || '')).slice(1, 2).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Text style={styles.nombre}>{nombreUsuario(historia.userId)}</Text>
          </View>
        ))}
      </ScrollView>

      {estaSubiendo && (
        <View style={styles.progresoWrap}>
          <ActivityIndicator size="small" color="#F97316" />
          <View style={styles.progresoTextWrap}>
            <Text style={styles.progresoText}>{progresoMsg || 'Subiendo historia...'}</Text>
            <Text style={styles.progresoPct}>{progresoPct}%</Text>
          </View>
        </View>
      )}

      <Modal visible={!!archivoCapturado} animationType="slide">
        {archivoCapturado ? (
          <VistaPrevia
            archivo={archivoCapturado}
            onDescartar={() => setArchivoCapturado(null)}
            onPublicar={handlePublicarHistoria}
          />
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  lista: {
    gap: 8,
    paddingRight: 6,
  },
  item: {
    alignItems: 'center',
    width: 94,
  },
  avatarWrap: {
    position: 'relative',
    width: 88,
    height: 88,
    marginBottom: 6,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#FB923C',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarConHistoria: {
    borderColor: '#F97316',
  },
  avatarPropiaSinHistoria: {
    borderColor: '#9CA3AF',
  },
  avatarOtro: {
    marginBottom: 6,
    borderColor: '#A855F7',
  },
  innerCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCirclePropia: {
    backgroundColor: '#F97316',
  },
  innerMedia: {
    width: '100%',
    height: '100%',
  },
  plusBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F97316',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombre: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
    marginTop: 2,
  },
  inicialTxt: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  progresoWrap: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderColor: '#374151',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  progresoTextWrap: {
    marginLeft: 8,
  },
  progresoText: {
    color: '#F9FAFB',
    fontSize: 12,
    fontWeight: '600',
  },
  progresoPct: {
    color: '#F97316',
    fontSize: 11,
    fontWeight: '700',
  },
});
