import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export default function ChatMediaViewer({ archivo, alCerrar }) {
  const player = archivo?.tipo === 'video' ? useVideoPlayer(archivo.fileUrl, (player) => {
    player.loop = true;
    player.play();
  }) : null;

  return (
    <View style={styles.container}>
      {archivo?.tipo === 'video' ? (
        <VideoView
          player={player}
          style={styles.fullMedia}
          contentFit="contain"
        />
      ) : null}

      <TouchableOpacity style={styles.closeBtn} onPress={alCerrar}>
        <Ionicons name="close" size={40} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  fullMedia: { width: '100%', height: '100%' },
  closeBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10 }
});
