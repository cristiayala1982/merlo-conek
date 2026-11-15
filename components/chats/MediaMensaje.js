import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { setVideoViewerPayload } from '../../services/videoViewerState';
import ReaccionesMensaje from './ReaccionesMensaje';

export default function MediaMensaje({ item, esMio, hora, onLongPress, leido, replyTo, onReplyPress, isHighlighted, showUserPhoto }) {
  const router = useRouter();
  const [modalImagen, setModalImagen] = useState(false);
  const [cargandoImagen, setCargandoImagen] = useState(true);

  const esVideo = item.tipo === 'video';
  const url = item.url;
  const thumbnail = item.thumbnailUrl || item.thumbnailURL;
  const reacciones = item.reacciones;

  const formatDuracion = (ms) => {
    if (!ms) return "0:00";
    const segundos = Math.floor(ms / 1000);
    const mins = Math.floor(segundos / 60);
    const secs = Math.floor(segundos % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const abrirMedia = () => {
    if (cargandoImagen && !esVideo) return; // Evitar abrir si no cargó la previa
    if (esVideo) {
      setVideoViewerPayload({
        videoUri: url,
        post: {
          ...item,
          userName: item.user, // Mapeamos para que el viewer lo entienda
          userPhotoUrl: item.userPhoto,
          isChat: true // Marca para que el viewer sepa que es de un chat
        }
      });
      router.push({
        pathname: '/video-viewer',
        params: { t: String(Date.now()) },
      });
    } else {
      setModalImagen(true);
    }
  };

  return (
    <View style={{ marginBottom: reacciones && Object.keys(reacciones).length > 0 ? 20 : 0 }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={onLongPress}
        onPress={abrirMedia}
        style={[
          styles.cajaMedia,
          esMio ? styles.msgPropio : styles.msgAjeno,
          isHighlighted && styles.msgHighlighted,
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
                <Text style={styles.replyText} numberOfLines={2}>{replyTo.text}</Text>
              </View>
              {replyTo.previewUrl && (
                <Image
                    source={{ uri: replyTo.previewUrl }}
                    style={styles.replyImageMini}
                    contentFit="cover"
                />
              )}
            </View>
          </TouchableOpacity>
        )}

        {showUserPhoto && !esMio && (
          <View style={styles.senderInfo}>
            {item.userPhoto ? (
              <Image source={{ uri: item.userPhoto }} style={styles.senderAvatar} />
            ) : (
              <View style={[styles.senderAvatar, { backgroundColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="person" size={10} color="#FFF" />
              </View>
            )}
            <Text style={styles.senderName}>{item.user}</Text>
          </View>
        )}

        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: esVideo ? (thumbnail || url) : url }}
            placeholder={{ uri: thumbnail }}
            placeholderContentFit="cover"
            style={styles.mediaContent}
            contentFit="cover"
            transition={300}
            onLoadStart={() => setCargandoImagen(true)}
            onLoadEnd={() => setCargandoImagen(false)}
            cachePolicy="memory-disk"
          />

          {cargandoImagen || item.enviando ? (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator size="small" color="#FF6600" />
              {item.enviando && <Text style={{ fontSize: 10, color: '#FF6600', marginTop: 5, fontWeight: 'bold' }}>ENVIANDO...</Text>}
            </View>
          ) : null}

          {esVideo && (
            <View style={styles.playIconOverlay}>
              <View style={styles.playButtonCircle}>
                <Ionicons name="play" size={35} color="white" style={{ marginLeft: 4 }} />
              </View>
            </View>
          )}

          <View style={styles.overlayFooter}>
            {esVideo ? (
              <View style={styles.durationWrap}>
                <Ionicons name="videocam" size={14} color="white" />
                <Text style={styles.durationText}>{formatDuracion(item.duracionMs)}</Text>
              </View>
            ) : <View style={{ flex: 1 }} />}

            <View style={styles.timeWrap}>
              <Text style={styles.horaTexto}>{hora}</Text>
              {esMio && (
                <Ionicons
                  name={leido ? "checkmark-done" : "checkmark"}
                  size={16}
                  color={leido ? "#34B7F1" : "rgba(255,255,255,0.8)"}
                  style={styles.checkIcon}
                />
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
      <ReaccionesMensaje reacciones={reacciones} />

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
  msgHighlighted: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF', borderWidth: 1.8 },
  replyContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 10, marginBottom: 5, overflow: 'hidden', marginHorizontal: 3, marginTop: 3 },
  replyBarCitada: { width: 3, backgroundColor: '#FF6600' },
  replyContent: { padding: 5, flex: 1, flexDirection: 'row', alignItems: 'center' },
  replyUser: { fontSize: 11, fontWeight: 'bold', color: '#FF6600' },
  replyText: { fontSize: 11, color: '#666' },
  replyImageMini: { width: 35, height: 35, borderRadius: 4, marginLeft: 5 },
  imageWrapper: {
    width: 230,
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000'
  },
  mediaContent: { width: '100%', height: '100%' },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    zIndex: 2,
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  playButtonCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  overlayFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 10,
  },
  durationWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  durationText: { color: 'white', fontSize: 11, fontWeight: 'bold', marginLeft: 5 },
  timeWrap: { flexDirection: 'row', alignItems: 'center' },
  horaTexto: { fontSize: 11, color: 'white', fontWeight: 'bold' },
  checkIcon: { marginLeft: 4 },
  viewerBackdrop: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  fullImage: { width: '100%', height: '100%' },
  senderInfo: { flexDirection: 'row', alignItems: 'center', padding: 5, backgroundColor: 'rgba(0,0,0,0.02)' },
  senderAvatar: { width: 20, height: 20, borderRadius: 10, marginRight: 5 },
  senderName: { fontSize: 12, fontWeight: 'bold', color: '#6B7280' },
});
