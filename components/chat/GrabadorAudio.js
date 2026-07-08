import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';

export default function GrabadorAudio({ onIniciarGrabacion, onEnviar }) {
  const [recording, setRecording] = useState(null);
  const [estaGrabando, setEstaGrabando] = useState(false);

  async function iniciarGrabacion() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      onIniciarGrabacion?.();
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setEstaGrabando(true);
    } catch (err) {
      console.error('Fallo al iniciar grabacion', err);
    }
  }

  async function detenerGrabacion() {
    setEstaGrabando(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    if (uri) {
      onEnviar(uri);
    }
  }

  return (
    <TouchableOpacity
      onPressIn={iniciarGrabacion}
      onPressOut={detenerGrabacion}
      style={[styles.btnAudio, estaGrabando && styles.btnAudioGrabando]}
    >
      <Ionicons name={estaGrabando ? "mic" : "mic-outline"} size={26} color={estaGrabando ? "white" : "#FF6600"} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btnAudio: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginLeft: 8,
  },
  btnAudioGrabando: {
    backgroundColor: '#FF6600',
    transform: [{ scale: 1.2 }],
  },
});
