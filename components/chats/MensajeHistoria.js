import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { auth } from '../../firebaseConfig';

import ReaccionesMensaje from './ReaccionesMensaje';

const COLOR_NARANJA = '#FF6600';

export default function MensajeHistoria({ item, esMio, hora, leido, onLongPress, isHighlighted }) {
  const router = useRouter();
  const ctx = item.storyContext;
  const miUid = auth.currentUser?.uid;
  const reacciones = item.reacciones;

  if (!ctx) return null;

  const verHistoria = () => {
    // Determinamos quién es el dueño de la historia:
    // Si yo envié el mensaje (esMio), la historia es del otro.
    // Si yo recibí el mensaje (!esMio), la historia es MÍA.
    let ownerId;
    if (esMio) {
      ownerId = item.chatId.split('_').find(id => id !== miUid);
    } else {
      ownerId = miUid;
    }

    router.push({
      pathname: '/historias-viewer',
      params: {
        userId: ownerId,
        storyId: ctx.storyId
      }
    });
  };

  const esLike = !item.text && !item.texto;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={verHistoria}
      onLongPress={onLongPress}
      style={[
        styles.cajaMensaje,
        esMio ? styles.msgPropio : styles.msgAjeno,
        isHighlighted && styles.msgHighlighted,
        { marginBottom: reacciones && Object.keys(reacciones).length > 0 ? 22 : 4 }
      ]}
    >
      <View style={styles.imageCard}>
        <Image source={{ uri: ctx.storyThumbnail }} style={styles.thumbnail} />
      </View>

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
          <Text style={styles.horaTexto}>{hora}</Text>
          {esMio && (
            <Ionicons
              name={leido ? 'checkmark-done' : 'checkmark'}
              size={20}
              color={leido ? '#34B7F1' : '#8696A0'}
              style={styles.checkIcon}
            />
          )}
        </View>
      </View>
      <ReaccionesMensaje reacciones={reacciones} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cajaMensaje: {
    width: 200,
    borderRadius: 18,
    borderWidth: 1.2,
    position: 'relative', // Para posicionar las reacciones
  },
  msgPropio: {
    borderColor: '#FF6600',
    backgroundColor: '#FFF5ED',
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  msgAjeno: {
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
  },
  msgHighlighted: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
  },
  imageCard: {
    width: '100%',
    height: 250,
    backgroundColor: '#000',
    borderTopLeftRadius: 16, // Ligeramente menor que el borde exterior
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    opacity: 0.85
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center'
  },
  playIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10
  },
  content: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  text: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 20,
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center'
  },
  likeText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    fontStyle: 'italic'
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  horaTexto: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500'
  },
  checkIcon: {
    marginLeft: 3
  }
});
