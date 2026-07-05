import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

export default function ReproductorPost({ videoUri, isActive = false }) {
  const source = videoUri || null;
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (!player) return;
    if (!videoUri) {
      player.pause();
      return;
    }

    // Un solo video del feed debe sonar/reproducirse a la vez.
    if (!isActive) {
      player.pause();
      player.currentTime = 0;
      return;
    }

    try {
      player.play();
    } catch (error) {
      console.log('Error reproduciendo video del post:', error?.message || error);
    }
  }, [isActive, videoUri, player]);

  return (
    <View style={styles.wrap}>
      {isActive && ( // Solo renderizamos el VideoView si es activo
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
          surfaceType="textureView"
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  video: { width: '100%', height: '100%' },
});