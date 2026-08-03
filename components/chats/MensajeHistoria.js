import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const COLOR_NARANJA = '#FF6600';

export default function MensajeHistoria({ item, esMio, hora, leido }) {
  const router = useRouter();
  const ctx = item.storyContext;

  if (!ctx) return null;

  const verHistoria = () => {
    router.push({
      pathname: '/historias-viewer',
      params: {
        userId: esMio ? item.chatId.split('_').find(id => id !== item.userId) : item.userId,
        storyId: ctx.storyId
      }
    });
  };

  const esLike = !item.text && !item.texto;

  return (
    <View style={[styles.container, esMio ? styles.mio : styles.ajeno]}>
      <TouchableOpacity activeOpacity={0.9} onPress={verHistoria} style={styles.card}>
        <View style={styles.imageWrapper}>
          <Image source={{ uri: ctx.storyThumbnail }} style={styles.thumbnail} />
          <View style={styles.overlay}>
             <Ionicons name="play-circle" size={24} color="white" style={{ opacity: 0.8 }} />
          </View>
        </View>
        <View style={styles.info}>
          <Text style={styles.label}>Historia</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.content}>
        {esLike ? (
          <View style={styles.likeRow}>
            <Ionicons name="heart" size={20} color={COLOR_NARANJA} />
            <Text style={styles.likeText}>Reaccionó a tu historia</Text>
          </View>
        ) : (
          <Text style={styles.text}>{item.text || item.texto}</Text>
        )}

        <View style={styles.footer}>
          <Text style={styles.hora}>{hora}</Text>
          {esMio && (
            <Ionicons
              name={leido ? 'checkmark-done' : 'checkmark'}
              size={16}
              color={leido ? '#34B7F1' : '#9CA3AF'}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: 240,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mio: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FFEDD5',
  },
  ajeno: {
    backgroundColor: '#F9FAFB',
  },
  card: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center'
  },
  imageWrapper: {
    width: 50,
    height: 70,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    opacity: 0.8
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center'
  },
  info: {
    marginLeft: 10,
    flex: 1
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6B7280',
    textTransform: 'uppercase'
  },
  content: {
    padding: 10,
  },
  text: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 20
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  likeText: {
    fontSize: 14,
    color: '#4B5563',
    fontStyle: 'italic'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4
  },
  hora: {
    fontSize: 10,
    color: '#9CA3AF'
  }
});
