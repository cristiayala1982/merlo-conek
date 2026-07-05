import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, NativeModules, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getVideoMetaData } from 'react-native-compressor';
import { auth } from '../../firebaseConfig';
import { obtenerPerfilUsuario, subirPostAFirebase, subirPostTextoAFirebase } from '../../services/firebaseService';
import VistaPrevia from '../camara/VistaPrevia';
import { comprimirVideoPro } from '../camara/compresor3';

const LOG_TAG = '[CAMERA_FLOW]';
const debugLog = (...args) => {
  if (__DEV__) {
    console.log(LOG_TAG, ...args);
  }
};

export default function CrearPost({ onCaptureFlowChange }) {
  const [archivoCapturado, setArchivoCapturado] = useState(null);
  const [textoPost, setTextoPost] = useState('');
  const [estaSubiendo, setEstaSubiendo] = useState(false);
  const [progresoMsg, setProgresoMsg] = useState("");
  const [progresoPct, setProgresoPct] = useState(0);
  const [estadoVisual, setEstadoVisual] = useState(null);
  const [nombreUsuario, setNombreUsuario] = useState('Cristian');

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = obtenerPerfilUsuario(uid, (data) => {
      if (data?.nombre) setNombreUsuario(data.nombre);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    debugLog('CrearPost mounted');
    return () => {
      debugLog('CrearPost unmounted, liberando estado de captura');
      onCaptureFlowChange?.(false);
    };
  }, [onCaptureFlowChange]);

  const mostrarEstado = (mensaje, tipo = 'info') => {
    setEstadoVisual({ mensaje, tipo });
    setTimeout(() => {
      setEstadoVisual((prev) => (prev?.mensaje === mensaje ? null : prev));
    }, 2400);
  };

  const abrirCamara = async () => {
    try {
      debugLog('abrirCamara: inicio');
      onCaptureFlowChange?.(true);

      if (Platform.OS !== 'android') {
        debugLog('abrirCamara: plataforma no soportada', Platform.OS);
        onCaptureFlowChange?.(false);
        Alert.alert('Camara nativa', 'Esta camara Kotlin esta disponible solo en Android.');
        return;
      }

      const modulo = NativeModules.HistoriasLabNative;
      if (!modulo || typeof modulo.abrirCamaraHistorias !== 'function') {
        onCaptureFlowChange?.(false);
        Alert.alert('Camara no disponible', 'No se encontro el modulo nativo HistoriasLabNative.');
        return;
      }

      const rutaCrudaAndroid = await modulo.abrirCamaraHistorias(false);
      if (!rutaCrudaAndroid) {
        onCaptureFlowChange?.(false);
        return;
      }

      const esVideo = rutaCrudaAndroid.endsWith('.mp4');
      setArchivoCapturado({
        tipo: esVideo ? 'video' : 'foto',
        uri: `file://${rutaCrudaAndroid}`,
      });
    } catch (error) {
      onCaptureFlowChange?.(false);
      console.log('Camara nativa cancelada o fallo:', error?.message || error);
    }
  };

  const generarMiniatura = async (videoUri) => {
    const tiempos = [120, 450, 900, 1400];
    for (const time of tiempos) {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time });
        if (uri) return uri;
      } catch (e) {
        debugLog('generarMiniatura fallo', e);
      }
    }
    return null;
  };

  const handlePublicar = async () => {
    if (estaSubiendo || !archivoCapturado) return;

    const captura = archivoCapturado;

    try {
      setArchivoCapturado(null);
      setEstaSubiendo(true);
      setProgresoMsg("Preparando archivo...");
      setProgresoPct(0);

      await new Promise((resolve) => setTimeout(resolve, 120));

      let uriParaSubir = captura.uri;
      let thumbnailUri = null;
      let duracionMs = null;
      let width = null;
      let height = null;
      const temporalesParaLimpiar = [];

      if (captura.tipo === 'video') {
        setProgresoMsg("Generando miniatura...");
        thumbnailUri = await generarMiniatura(captura.uri);
        if (thumbnailUri) temporalesParaLimpiar.push(thumbnailUri);

        setProgresoMsg("Comprimiendo video...");
        uriParaSubir = await comprimirVideoPro(captura.uri);
        if (uriParaSubir && uriParaSubir !== captura.uri) {
          temporalesParaLimpiar.push(uriParaSubir);
        }

        if (!thumbnailUri && uriParaSubir) {
          setProgresoMsg("Regenerando miniatura...");
          thumbnailUri = await generarMiniatura(uriParaSubir);
          if (thumbnailUri) temporalesParaLimpiar.push(thumbnailUri);
        }

        const meta = await getVideoMetaData(uriParaSubir);
        duracionMs = meta?.duration ? Math.round(Number(meta.duration) * 1000) : null;
        width = meta?.width ? Number(meta.width) : null;
        height = meta?.height ? Number(meta.height) : null;
      } else {
        temporalesParaLimpiar.push(uriParaSubir);
      }

      const infoArchivo = await FileSystem.getInfoAsync(uriParaSubir, { size: true });
      const fileSizeBytes = infoArchivo?.exists ? infoArchivo.size ?? null : null;

      setProgresoMsg("Subiendo a Firebase...");
      await subirPostAFirebase({
        uri: uriParaSubir,
        tipo: captura.tipo,
        thumbnailUri,
        texto: textoPost.trim(),
        fileSizeBytes,
        duracionMs,
        width,
        height,
        onProgress: ({ fase, progreso }) => {
          const pct = Math.max(1, Math.min(100, Number(progreso) || 0));
          setProgresoPct(pct);
          if (fase === 'subiendo-media') setProgresoMsg(`Subiendo archivo... ${pct}%`);
          else if (fase === 'subiendo-thumbnail') setProgresoMsg(`Subiendo miniatura... ${pct}%`);
          else if (fase === 'completado') setProgresoMsg('Publicación lista 100%');
        },
      });

      for (const ruta of temporalesParaLimpiar) {
        try { await FileSystem.deleteAsync(ruta, { idempotent: true }); } catch {}
      }

      setTextoPost('');
      mostrarEstado('Publicación lista en el muro', 'ok');
    } catch (error) {
      mostrarEstado('No se pudo publicar', 'error');
    } finally {
      setEstaSubiendo(false);
      setProgresoMsg("");
      setProgresoPct(0);
      onCaptureFlowChange?.(false);
    }
  };

  const handlePublicarTexto = async () => {
    if (estaSubiendo) return;
    try {
      setEstaSubiendo(true);
      setProgresoMsg('Publicando texto...');
      setProgresoPct(100);
      await subirPostTextoAFirebase({ texto: textoPost });
      setTextoPost('');
      mostrarEstado('Texto publicado', 'ok');
    } catch (error) {
      mostrarEstado('No se pudo publicar el texto', 'error');
    } finally {
      setEstaSubiendo(false);
      setProgresoMsg('');
      setProgresoPct(0);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput 
          style={styles.input} 
          placeholder={`¿Qué tenés en mente, ${nombreUsuario}?`}
          placeholderTextColor="#A0A0A0"
          value={textoPost}
          onChangeText={setTextoPost}
        />
        <TouchableOpacity style={styles.galleryIcon} onPress={abrirCamara}>
          <Ionicons name="images-outline" size={24} color="#FF6600" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.publicarTextoBtn, textoPost.trim().length === 0 && styles.publicarTextoBtnDisabled]}
          disabled={textoPost.trim().length === 0 || estaSubiendo}
          onPress={handlePublicarTexto}>
          <Text style={styles.publicarTextoBtnTxt}>Publicar</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.challengeBtn} onPress={abrirCamara}>
        <Ionicons name="camera-reverse-outline" size={18} color="#FF6600" />
        <Text style={styles.challengeText}>Desafiar a un amigo a una espontánea</Text>
      </TouchableOpacity>

      <Modal visible={!!archivoCapturado} animationType="slide" transparent={false}>
        {archivoCapturado ? (
          <VistaPrevia
            archivo={archivoCapturado}
            onDescartar={() => {
              setArchivoCapturado(null);
              onCaptureFlowChange?.(false);
            }}
            onPublicar={handlePublicar}
          />
        ) : null}

        {estaSubiendo && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#FF6600" />
              <Text style={styles.loadingText}>{progresoMsg}</Text>
              <Text style={styles.loadingPct}>{progresoPct}%</Text>
            </View>
          </View>
        )}
      </Modal>

      {estaSubiendo && !archivoCapturado && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#FF6600" />
            <View style={styles.loadingTextWrap}>
              <Text style={styles.loadingText}>{progresoMsg}</Text>
              <Text style={styles.loadingPct}>{progresoPct}%</Text>
            </View>
          </View>
        </View>
      )}

      {!!estadoVisual && (
        <View style={styles.estadoWrap} pointerEvents="none">
          <View style={[
            styles.estadoChip,
            estadoVisual.tipo === 'ok' ? styles.estadoChipOk : styles.estadoChipError,
          ]}>
            <Ionicons
              name={estadoVisual.tipo === 'ok' ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={estadoVisual.tipo === 'ok' ? '#14532D' : '#7F1D1D'}
            />
            <Text style={styles.estadoText}>{estadoVisual.mensaje}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFF', padding: 15, margin: 10, borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  input: { flex: 1, backgroundColor: '#F8F8F8', padding: 12, borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: '#EFEFEF', fontSize: 14 },
  galleryIcon: { padding: 5 },
  publicarTextoBtn: { marginLeft: 8, backgroundColor: '#FF6600', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  publicarTextoBtnDisabled: { opacity: 0.4 },
  publicarTextoBtnTxt: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  challengeBtn: { backgroundColor: '#F9F9F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#EFEFEF' },
  challengeText: { color: '#333', fontWeight: '500', marginLeft: 8, fontSize: 13 },
  loadingOverlay: { position: 'absolute', left: 12, right: 12, bottom: 14, zIndex: 1000, alignItems: 'center' },
  loadingCard: { minWidth: 220, maxWidth: '96%', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', elevation: 2 },
  loadingTextWrap: { marginLeft: 10, flex: 1 },
  loadingText: { color: '#333', fontSize: 13, fontWeight: '600' },
  loadingPct: { marginTop: 2, color: '#6B7280', fontSize: 12, fontWeight: '700' },
  estadoWrap: { position: 'absolute', left: 12, right: 12, top: 12, zIndex: 1001, alignItems: 'center' },
  estadoChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1 },
  estadoChipOk: { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' },
  estadoChipError: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  estadoText: { marginLeft: 8, fontSize: 12, color: '#111827', fontWeight: '600' },
});
