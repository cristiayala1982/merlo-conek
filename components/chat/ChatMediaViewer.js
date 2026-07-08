import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, TouchableOpacity, View, Image } from 'react-native';

export default function ChatMediaViewer({ archivo, alCerrar }) {
  const player = useVideoPlayer(archivo?.fileUrl, (playerInstance) => {
    playerInstance.loop = true;
    playerInstance.play();
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeBtn} onPress={alCerrar}>
        <Ionicons name="close" size={40} color="white" />
      </TouchableOpacity>

      {archivo.tipo === 'video' ? (
        <VideoView
          player={player}
          style={styles.media}
          contentFit="contain"
          nativeControls={true}
        />
      ) : (
        <Image
          source={{ uri: archivo.fileUrl }}
          style={styles.media}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
  media: { width: '100%', height: '80%' }
});
