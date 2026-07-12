import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { setVideoViewerPayload } from '../../services/videoViewerState';

export default function MediaMensaje({ item, esMio, hora, onLongPress, leido }) {
  const router = useRouter();
  const [modalImagen, setModalImagen] = useState(false);

  const esVideo = item.tipo === 'video';
  const url = item.url;
  const thumbnail = item.thumbnailUrl || item.thumbnailURL;

  const abrirMedia = () => {
    if (esVideo) {
      setVideoViewerPayload({ videoUri: url });
      router.push({
        pathname: '/video-viewer',
        params: { t: String(Date.now()) },
      });
    } else {
      setModalImagen(true);
    }
  };

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={onLongPress}
        onPress={abrirMedia}
        style={[
          styles.cajaMedia,
          esMio ? styles.msgPropio : styles.msgAjeno
        ]}
      >
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: esVideo ? (thumbnail || url) : url }}
            style={styles.mediaContent}
            resizeMode="cover"
          />
          {esVideo && (
            <View style={styles.playIconOverlay}>
              <Ionicons name="play-circle" size={50} color="rgba(255,255,255,0.8)" />
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.horaTexto}>{hora}</Text>
          {esMio && (
            <Ionicons
              name={leido ? "checkmark-done" : "checkmark"}
              size={18}
              color={leido ? "#34B7F1" : "#8696A0"}
              style={styles.checkIcon}
            />
          )}
        </View>
      </TouchableOpacity>

      <Modal visible={modalImagen} transparent animationType="fade" onRequestClose={() => setModalImagen(false)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setModalImagen(false)}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setModalImagen(false)}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          <Image source={{ uri: url }} style={styles.fullImage} resizeMode="contain" />
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cajaMedia: {
    padding: 3,
    borderRadius: 15,
    borderWidth: 1.2,
    maxWidth: 240,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden'
  },
  msgPropio: { borderColor: '#FF6600', backgroundColor: '#FFF5ED', borderBottomRightRadius: 4 },
  msgAjeno: { borderColor: '#D1D5DB', backgroundColor: '#F9FAFB', borderBottomLeftRadius: 4 },
  imageWrapper: {
    width: 230,
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000'
  },
  mediaContent: { width: '100%', height: '100%' },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)'
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
    position: 'absolute',
    bottom: 5,
    right: 5,
    borderRadius: 10
  },
  horaTexto: { fontSize: 10, color: '#333', fontWeight: '600' },
  checkIcon: { marginLeft: 4 },
  viewerBackdrop: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  fullImage: { width: '100%', height: '100%' }
});
