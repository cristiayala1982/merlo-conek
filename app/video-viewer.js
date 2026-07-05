import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearVideoViewerPayload, getVideoViewerPayload } from '../services/videoViewerState';

export default function VideoViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const payload = getVideoViewerPayload() || {};
  const videoUriFromPayload = typeof payload?.videoUri === 'string' ? payload.videoUri : '';
  const videoUriFromParams = typeof params?.videoUri === 'string' ? params.videoUri : '';
  const videoUri = videoUriFromPayload || videoUriFromParams;

  const [cargando, setCargando] = useState(true);

  const player = useVideoPlayer(videoUri || null, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  const cerrarViewer = () => {
    clearVideoViewerPayload();
    router.back();
  };

  useEffect(() => {
    if (!player || !videoUri) return;
    setCargando(true);
    player.play();
  }, [player, videoUri]);

  useEffect(() => {
    if (!player) return;

    const subPlaying = player.addListener('playingChange', (e) => {
      if (e?.isPlaying) setCargando(false);
    });
    const subTime = player.addListener('timeUpdate', (e) => {
      if (Number(e?.currentTime) > 0.04) setCargando(false);
    });
    const subStatus = player.addListener('statusChange', (e) => {
      if (String(e?.status || '').toLowerCase() === 'readytoplay') {
        setCargando(false);
      }
    });

    return () => {
      subPlaying.remove();
      subTime.remove();
      subStatus.remove();
    };
  }, [player]);

  useEffect(() => {
    return () => {
      clearVideoViewerPayload();
    };
  }, []);

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={[styles.video, { marginBottom: Math.max(0, insets.bottom - 20) }]}
        contentFit="contain"
        nativeControls={!cargando}
      />

      {cargando && (
        <View style={styles.loadingWrap} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      <Pressable
        style={[styles.closeBtn, { top: Math.max(14, insets.top + 6) }]}
        onPress={cerrarViewer}
      >
        <Ionicons name="close" size={26} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  video: { flex: 1 },
  loadingWrap: { 
    ...StyleSheet.absoluteFillObject, 
    alignItems: 'center', 
    justifyContent: 'center',
    zIndex: 80,
    elevation: 12,
    backgroundColor: 'rgba(0,0,0,0.28)'
  },
  closeBtn: { 
    position: 'absolute', 
    right: 16, 
    zIndex: 120, 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  }
});