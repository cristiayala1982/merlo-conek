import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  useAudioRecorderState
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useRef, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';

export default function GrabadorAudio({ onEnviar, onIniciarGrabacion, onFinalizarGrabacion }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const estaGrabando = recorderState.isRecording;
  const isPreparing = useRef(false);

  // Intentar preparar el recorder al montar, pero no depender solo de esto
  useEffect(() => {
    const prepare = async () => {
      try {
        if (!recorder.canRecord) {
          await recorder.prepareToRecordAsync();
        }
      } catch (e) {
        // Falló o ya estaba listo, no logueamos nada para mantener limpia la terminal
      }
    };
    prepare();
  }, []);

  const empezarGrabacion = async () => {
    if (isPreparing.current || estaGrabando) return;

    try {
      isPreparing.current = true;
      const { status } = await getRecordingPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await requestRecordingPermissionsAsync();
        if (newStatus !== 'granted') {
          Alert.alert('Permiso denegado', 'Se necesita permiso de micrófono.');
          return;
        }
      }

      // Si ya está grabando por alguna razón, no hacemos nada
      if (recorder.isRecording) return;

      // REVISIÓN CLAVE: Antes de grabar o preparar, nos aseguramos de que no haya
      // una sesión previa colgada.
      try {
        if (recorder.isRecording) await recorder.stop();
      } catch (e) {}

      if (!recorder.canRecord) {
        try {
          await recorder.prepareToRecordAsync();
        } catch (prepError) {
          // Si dice que ya está preparado, simplemente ignoramos el error y seguimos
          if (!prepError.message.includes("already been prepared")) {
             console.log("Aviso: Falló prepare:", prepError.message);
          }
        }
      }

      onIniciarGrabacion?.();
      await recorder.record();
    } catch (error) {
      console.error("Error al empezar a grabar:", error);
    } finally {
      isPreparing.current = false;
    }
  };

  const cancelarGrabacion = async () => {
    try {
      if (!estaGrabando) return;
      onFinalizarGrabacion?.();
      await recorder.stop();
    } catch (e) {
      console.error("Error al cancelar:", e);
    }
  };

  const enviarGrabacion = async () => {
    if (!estaGrabando) return;
    try {
      onFinalizarGrabacion?.();
      await recorder.stop();

      const uri = recorder.uri;
      if (uri) {
        const carpetaAudios = `${FileSystem.documentDirectory}audios_grabados/`;
        const infoCarpeta = await FileSystem.getInfoAsync(carpetaAudios);
        if (!infoCarpeta.exists) {
          await FileSystem.makeDirectoryAsync(carpetaAudios, { intermediates: true });
        }
        const nombreArchivo = `grabacion_${Date.now()}.m4a`;
        const destinoPermanente = `${carpetaAudios}${nombreArchivo}`;
        await FileSystem.copyAsync({ from: uri, to: destinoPermanente });
        onEnviar(destinoPermanente);
      }
    } catch (error) {
      console.error("Error al enviar grabación:", error);
    }
  };

  return (
    <View style={styles.contenedor}>
      {estaGrabando && (
        <View style={styles.areaGrabacion}>
          <TouchableOpacity
            style={styles.btnCancelar}
            onPress={cancelarGrabacion}
          >
            <Ionicons name="trash-outline" size={20} color="#ff4444" />
            <Text style={styles.textCancelar}>Cancelar</Text>
          </TouchableOpacity>

          <View style={styles.indicadorFlotante}>
            <View style={styles.puntoRojo} />
            <Text style={styles.textoGrabando}>
              {Math.floor(recorderState.durationMillis / 1000)}s
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        onPressIn={empezarGrabacion}
        onPressOut={enviarGrabacion}
        style={[styles.boton, estaGrabando && styles.botonActivo]}
        activeOpacity={0.7}
      >
        <Ionicons
          name={estaGrabando ? "stop" : "mic"}
          size={estaGrabando ? 22 : 24}
          color={estaGrabando ? "white" : "#FF6600"}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  areaGrabacion: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    right: 50,
    backgroundColor: 'white',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    minWidth: 160,
    justifyContent: 'space-between'
  },
  boton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  botonActivo: {
    backgroundColor: '#FF6600',
    borderColor: '#FF6600',
    transform: [{ scale: 1.1 }]
  },
  indicadorFlotante: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  puntoRojo: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4444',
    marginRight: 5,
  },
  textoGrabando: {
    color: '#333',
    fontSize: 14,
    fontWeight: 'bold'
  },
  btnCancelar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#EEE'
  },
  textCancelar: {
    color: '#ff4444',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600'
  }
});
