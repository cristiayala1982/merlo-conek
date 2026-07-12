import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export default function AudioMensaje({ uri }) {
  // Por ahora, como pidió el usuario, no hace nada al apretar play
  return (
    <View style={styles.contenedor}>
      <TouchableOpacity style={styles.playBtn} activeOpacity={0.8}>
        <Ionicons name="play" size={24} color="#FF6600" />
      </TouchableOpacity>
      <View style={styles.waveformContainer}>
        {/* Placeholder para la onda de audio */}
        <View style={styles.bar} />
        <View style={[styles.bar, { height: 15 }]} />
        <View style={[styles.bar, { height: 20 }]} />
        <View style={[styles.bar, { height: 12 }]} />
        <View style={[styles.bar, { height: 18 }]} />
        <View style={styles.bar} />
      </View>
      <Text style={styles.audioText}>Audio</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 15,
    minWidth: 150,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
    marginRight: 10,
  },
  bar: {
    width: 3,
    height: 10,
    backgroundColor: '#FF6600',
    borderRadius: 1.5,
  },
  audioText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  }
});
