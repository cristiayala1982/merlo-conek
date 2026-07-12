import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';

const BARRAS = 5;
const AUDIO_CACHE_DIR = `${FileSystem.cacheDirectory}chat-audios/`;

function OnditasEcualizador({ reproduciendo }) {
  const animaciones = useRef(Array.from({ length: BARRAS }, () => new Animated.Value(0.3))).current;
  const loopsRef = useRef([]);

  useEffect(() => {
    loopsRef.current.forEach(l => l?.stop());
    loopsRef.current = [];

    if (reproduciendo) {
      animaciones.forEach((anim, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 200 + i * 80, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.25, duration: 200 + i * 80, useNativeDriver: true }),
          ])
        );
        loop.start();
        loopsRef.current.push(loop);
      });
    } else {
      animaciones.forEach(anim => Animated.timing(anim, { toValue: 0.3, duration: 150, useNativeDriver: true }).start());
    }

    return () => loopsRef.current.forEach(l => l?.stop());
  }, [reproduciendo]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 24, marginHorizontal: 8 }}>
      {animaciones.map((anim, i) => (
        <Animated.View
          key={i}
          style={{
            width: 3,
            height: 20,
            borderRadius: 2,
            backgroundColor: '#FF6600',
            transform: [{ scaleY: anim }],
          }}
        />
      ))}
    </View>
  );
}

export default function AudioMensaje({ uri, id, isPlaying, onPlay, onEnded }) {
  const [sound, setSound] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const isMounted = useRef(true);

  const localUri = `${AUDIO_CACHE_DIR}${id}.m4a`;

  useEffect(() => {
    const downloadAndCache = async () => {
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists) {
        try {
          await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
          await FileSystem.downloadAsync(uri, localUri);
        } catch (e) { console.error("Error al guardar en disco:", e); }
      }
      if (isMounted.current) setIsReady(true);
    };
    downloadAndCache();
    return () => { isMounted.current = false; };
  }, [uri, id]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  useEffect(() => {
    const managePlayback = async () => {
      if (isPlaying) {
        if (!sound) {
          try {
            const { sound: newSound } = await Audio.Sound.createAsync(
              { uri: localUri },
              { shouldPlay: true }
            );

            newSound.setOnPlaybackStatusUpdate((status) => {
              if (status.isLoaded) {
                if (status.durationMillis > 0) {
                  setProgreso(status.positionMillis / status.durationMillis);
                }
                if (status.didJustFinish) {
                  setProgreso(0);
                  onEnded?.(id);
                }
              }
            });
            setSound(newSound);
          } catch (e) { console.error(e); }
        } else {
          await sound.playAsync();
        }
      } else {
        if (sound) await sound.pauseAsync();
      }
    };

    if (isReady) managePlayback();
  }, [isPlaying, isReady]);

  return (
    <TouchableOpacity
      onPress={() => isReady && (isPlaying ? onPlay(null) : onPlay(id))}
      style={{
        flexDirection: 'row', alignItems: 'center', padding: 10,
        backgroundColor: '#F3F4F6', borderRadius: 20, minWidth: 200,
      }}
    >
      <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="#FF6600" />
      <OnditasEcualizador reproduciendo={isPlaying} />
      <View style={{ flex: 1, height: 3, backgroundColor: '#DDD', borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ width: `${progreso * 100}%`, height: '100%', backgroundColor: '#FF6600' }} />
      </View>
    </TouchableOpacity>
  );
}
