import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ReaccionesMensaje from './ReaccionesMensaje';
import { HaloUserIcon } from '../icons/HaloIcons';

const AUDIO_CACHE_DIR = `${FileSystem.cacheDirectory}chat-audios/`;
const WAVE_HEIGHTS = [
  12, 18, 14, 22, 16, 26, 20, 16, 24, 18, 14, 22, 16, 26, 20, 14, 22, 18, 26, 20, 16,
  24, 18, 14, 22, 16, 26, 20
];
const BARRAS_COUNT = WAVE_HEIGHTS.length;

export default function AudioMensaje({
  uri, id, isPlaying, onPlay, onEnded, esMio, hora, replyTo, onLongPress, onReplyPress, leido, userPhoto, isHighlighted, reacciones, enviando
}) {
  const [isReady, setIsReady] = useState(false);
  const [localUri, setLocalUri] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const player = useAudioPlayer(localUri);
  const status = useAudioPlayerStatus(player);
  const isMounted = useRef(true);
  const [waveformWidth, setWaveformWidth] = useState(0);

  const handleSeek = (event) => {
    if (!status.duration || !player || !waveformWidth) return;
    const touchX = event.nativeEvent.locationX;
    const porcentaje = Math.max(0, Math.min(1, touchX / waveformWidth));
    player.seekTo(porcentaje * status.duration);
  };

  const togglePlaybackSpeed = () => {
    let nextSpeed = 1;
    if (playbackSpeed === 1) nextSpeed = 1.5;
    else if (playbackSpeed === 1.5) nextSpeed = 2;
    else nextSpeed = 1;

    setPlaybackSpeed(nextSpeed);
    if (player) {
      player.setPlaybackRate(nextSpeed);
    }
  };

  useEffect(() => {
    const downloadAndCache = async () => {
      try {
        if (uri.startsWith('file://')) {
          setLocalUri(uri);
          setIsReady(true);
          return;
        }

        const path = `${AUDIO_CACHE_DIR}${id}.m4a`;
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists) {
          await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
          await FileSystem.downloadAsync(uri, path);
        }
        if (isMounted.current) {
          setLocalUri(path);
          setIsReady(true);
        }
      } catch (e) { console.error(e); }
    };
    downloadAndCache();
    return () => { isMounted.current = false; };
  }, [uri, id]);

  useEffect(() => {
    if (!isReady || !player) return;
    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying, isReady, player]);

  useEffect(() => {
    if (status.didJustFinish && isPlaying) {
      player.pause();
      player.seekTo(0);
      onEnded?.(id);
    }
  }, [status.didJustFinish, isPlaying]);

  const progreso = (status.duration > 0 && !status.didJustFinish) ? status.currentTime / status.duration : 0;

  const formatDuracion = (segundos) => {
    if (!segundos) return "0:00";
    const mins = Math.floor(segundos / 60);
    const secs = Math.floor(segundos % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onLongPress={onLongPress}
      style={[
        styles.cajaBurbuja,
        esMio ? styles.msgPropio : styles.msgAjeno,
        isHighlighted && styles.msgHighlighted,
        { marginBottom: reacciones && Object.keys(reacciones).length > 0 ? 25 : 6 }
      ]}
    >
      {replyTo && (
        <TouchableOpacity
          style={styles.replyContainer}
          onPress={() => onReplyPress?.(replyTo.id)}
          activeOpacity={0.7}
        >
          <View style={styles.replyBarCitada} />
          <View style={styles.replyContent}>
            <View style={{ flex: 1 }}>
              <Text style={styles.replyUser} numberOfLines={1}>{replyTo.user}</Text>
              <Text style={styles.replyText} numberOfLines={3}>{replyTo.text}</Text>
            </View>
            {replyTo.previewUrl && (
              <Image source={{ uri: replyTo.previewUrl }} style={styles.replyImageMini} />
            )}
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.mainContainer}>
        {esMio && (
          <View style={styles.avatarLeft}>
            <View style={styles.avatarWrapper}>
              {userPhoto ? (
                <Image source={{ uri: userPhoto }} style={styles.miniAvatar} />
              ) : (
                <View style={[styles.miniAvatar, { backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' }]}>
                  <HaloUserIcon size={14} color="#FFF" />
                </View>
              )}
              <View style={styles.micBadge}>
                <Ionicons name="mic" size={10} color={leido ? "#34B7F1" : "#8696A0"} />
              </View>
            </View>
          </View>
        )}

        <View style={[styles.audioContent, esMio ? styles.audioContentPropio : styles.audioContentAjeno]}>
          {enviando && (
            <View style={styles.overlayEnviando}>
              <ActivityIndicator size="small" color="#FF6600" />
              <Text style={styles.txtEnviando}>Enviando...</Text>
            </View>
          )}
          <View style={[styles.playAndWaves, enviando && { opacity: 0.3 }]}>
            <TouchableOpacity
              onPress={() => isReady && (isPlaying ? onPlay(null) : onPlay(id))}
              style={styles.playButton}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={30}
                color={isPlaying ? "#FF6600" : "#777"}
              />
            </TouchableOpacity>

            <Pressable
              style={styles.waveformRow}
              onLayout={(e) => setWaveformWidth(e.nativeEvent.layout.width)}
              onPress={handleSeek}
            >
              {WAVE_HEIGHTS.map((height, i) => {
                const estaActiva = (i / BARRAS_COUNT) < progreso;
                const colorActiva = '#F97316'; // Naranja para el progreso
                const colorInactiva = '#6B7280'; // Gris aún más fuerte (Grafito)
                return (
                  <View
                    key={i}
                    pointerEvents="none"
                    style={[
                      styles.waveBar,
                      {
                        height: height,
                        backgroundColor: estaActiva ? colorActiva : colorInactiva,
                        opacity: estaActiva ? 1 : 0.9
                      }
                    ]}
                  />
                );
              })}
            </Pressable>

            <TouchableOpacity onPress={togglePlaybackSpeed} style={styles.speedButton}>
              <Text style={styles.speedText}>{playbackSpeed}x</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.durationText}>
              {isPlaying ? formatDuracion(status.currentTime) : formatDuracion(status.duration)}
            </Text>
            <View style={styles.metaRight}>
              <Text style={styles.horaTexto}>{hora}</Text>
              {esMio && (
                <Ionicons
                  name={leido ? "checkmark-done" : "checkmark"}
                  size={16}
                  color={leido ? "#34B7F1" : "#8696A0"}
                  style={styles.checkIcon}
                />
              )}
            </View>
          </View>
        </View>

        {!esMio && (
          <View style={styles.avatarRight}>
            <View style={styles.avatarWrapper}>
              {userPhoto ? (
                <Image source={{ uri: userPhoto }} style={styles.miniAvatar} />
              ) : (
                <View style={[styles.miniAvatar, { backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' }]}>
                  <HaloUserIcon size={14} color="#FFF" />
                </View>
              )}
              <View style={styles.micBadge}>
                <Ionicons name="mic" size={10} color={leido ? "#34B7F1" : "#8696A0"} />
              </View>
            </View>
          </View>
        )}
      </View>

      {!isReady && <Text style={styles.loadingText}>...</Text>}
      <ReaccionesMensaje reacciones={reacciones} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cajaBurbuja: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 22,
    width: '88%',
    minWidth: 280,
    borderWidth: 1.2,
    backgroundColor: '#FFFFFF',
  },
  msgPropio: {
    borderColor: '#FF6600',
    backgroundColor: '#FFF5ED',
    borderBottomRightRadius: 4,
  },
  msgAjeno: {
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    borderBottomLeftRadius: 4,
  },
  msgHighlighted: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF', borderWidth: 1.5 },
  mainContainer: { flexDirection: 'row', alignItems: 'center' },
  audioContent: { flex: 1, minWidth: 0, justifyContent: 'center' },
  audioContentPropio: { marginRight: 0 },
  audioContentAjeno: { marginRight: 0 },
  playAndWaves: { flexDirection: 'row', alignItems: 'center', height: 40, flex: 1 },
  avatarLeft: { marginRight: 12, marginTop: -18 },
  avatarRight: { marginLeft: 12, marginRight: 0, marginTop: -18 },
  playButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    flex: 1,
    justifyContent: 'space-between',
    paddingRight: 8
  },
  waveBar: { width: 1.2, borderRadius: 2 },
  speedButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 42,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginLeft: 10,
    marginRight: 2,
  },
  speedText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1F2937',
  },
  metaRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaRight: { flexDirection: 'row', alignItems: 'center' },
  durationText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  avatarWrapper: { width: 36, height: 36, position: 'relative' },
  miniAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEE' },
  micBadge: { position: 'absolute', bottom: -1, right: -1, backgroundColor: 'white', borderRadius: 10, padding: 1.5, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1 },
  horaTexto: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  checkIcon: { marginLeft: 3 },
  loadingText: { fontSize: 8, color: '#999', position: 'absolute', top: 5, left: 15 },
  overlayEnviando: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  txtEnviando: {
    marginLeft: 8,
    fontSize: 12,
    color: '#FF6600',
    fontWeight: 'bold',
  },
  replyContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 10, marginBottom: 8, overflow: 'hidden', maxHeight: 100 },
  replyBarCitada: { width: 4, backgroundColor: '#FF6600' },
  replyContent: { padding: 6, flex: 1, flexDirection: 'row', alignItems: 'center' },
  replyUser: { fontSize: 11, fontWeight: 'bold', color: '#FF6600' },
  replyText: { fontSize: 11, color: '#666' },
  replyImageMini: { width: 35, height: 35, borderRadius: 4, marginLeft: 8 }
});
