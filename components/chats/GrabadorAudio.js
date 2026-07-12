import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, AudioModule, RecordingOptionsPresets } from 'expo-audio';
import { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';

export default function GrabadorAudio({ onEnviar }) {
  const [permissionResponse, requestPermission] = AudioModule.useAudioPermissions();
  const recorder = useAudioRecorder(RecordingOptionsPresets.HIGH_QUALITY);
  const [estaGrabando, setEstaGrabando] = useState(false);

  useEffect(() => {
    setEstaGrabando(recorder.isRecording);
  }, [recorder.isRecording]);

  const empezarGrabacion = async () => {
    try {
      if (permissionResponse.status !== 'granted') {
        const res = await requestPermission();
        if (res.status !== 'granted') {
          Alert.alert('Permiso denegado', 'Se necesita permiso de micrófono para grabar audios.');
          return;
        }
      }

      // AudioModule.setAudioModeAsync({ ... }) is not needed if using expo-audio's recorder usually,
      // but let's check if we need to set mode.

      recorder.record();
    } catch (error) {
      console.error("Error al empezar a grabar:", error);
    }
  };

  const detenerGrabacion = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        onEnviar(uri);
      }
    } catch (error) {
      console.error("Error al detener grabación:", error);
    }
  };

  return (
    <View style={styles.contenedor}>
      {estaGrabando && (
        <View style={styles.indicadorFlotante}>
          <View style={styles.puntoRojo} />
          <Text style={styles.textoGrabando}>GRABANDO...</Text>
        </View>
      )}

      <TouchableOpacity
        onPressIn={empezarGrabacion}
        onPressOut={detenerGrabacion}
        style={styles.boton}
        activeOpacity={0.7}
      >
        <Ionicons name="mic" size={24} color={estaGrabando ? "#ff4444" : "#FF6600"} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
  },
  boton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicadorFlotante: {
    position: 'absolute',
    bottom: 60,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120,
    zIndex: 1000,
  },
  puntoRojo: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
    marginRight: 8,
  },
  textoGrabando: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold'
  }
});
