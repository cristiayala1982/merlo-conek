import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReaccionesMensaje from './ReaccionesMensaje';

export default function MensajeTexto({ texto, esMio, hora, isDeleted, replyTo, onReplyPress, leido, isHighlighted, onLongPress, reacciones, showUserPhoto, userPhoto, userName }) {
  const esClasificados = texto?.startsWith('🟢 [CLASIFICADOS]');
  const esHuellitas = texto?.startsWith('🐾 [HUELLITAS]');

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onLongPress={onLongPress}
      style={[
        styles.cajaMensaje,
        esMio ? styles.msgPropio : styles.msgAjeno,
        isDeleted && styles.msgDeleted,
        isHighlighted && styles.msgHighlighted,
        esClasificados && styles.msgClasificados,
        esHuellitas && styles.msgHuellitas,
        replyTo && { minWidth: 260 },
        { marginBottom: reacciones && Object.keys(reacciones).length > 0 ? 22 : 4 }
      ]}
    >
      {replyTo && (
        <TouchableOpacity
          style={styles.replyContainer}
          onPress={() => onReplyPress?.(replyTo.id)}
          activeOpacity={0.7}
        >
          <View style={styles.replyBar} />
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
      {showUserPhoto && !esMio && (
        <View style={styles.senderInfo}>
          {userPhoto ? (
            <Image source={{ uri: userPhoto }} style={styles.senderAvatar} />
          ) : (
            <View style={[styles.senderAvatar, { backgroundColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={10} color="#FFF" />
            </View>
          )}
          <Text style={styles.senderName}>{userName}</Text>
        </View>
      )}
      <View style={styles.contentWrapper}>
        <View style={(esClasificados || esHuellitas) ? styles.especialHeader : null}>
          {esClasificados && (
            <Ionicons name="newspaper" size={18} color="#059669" style={{ marginRight: 6 }} />
          )}
          {esHuellitas && (
            <Ionicons name="paw" size={18} color="#10B981" style={{ marginRight: 6 }} />
          )}
          <Text style={[
            styles.textoMsg,
            isDeleted && styles.textoMsgDeleted,
            esClasificados && styles.textoClasificados,
            esHuellitas && styles.textoHuellitas
          ]}>
            {esClasificados ? texto.replace('🟢 ', '') : esHuellitas ? texto.replace('🐾 ', '') : texto}
          </Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.horaTexto}>{hora}</Text>
          {esMio && !isDeleted && (
            <Ionicons
              name={leido ? "checkmark-done" : "checkmark"}
              size={20}
              color={leido ? "#34B7F1" : "#8696A0"}
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1.2,
    minWidth: 80,
    maxWidth: '100%',
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
  msgClasificados: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  msgHuellitas: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  msgHighlighted: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
  },
  msgDeleted: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  contentWrapper: {
    flexDirection: 'column',
  },
  textoMsg: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 20
  },
  textoClasificados: {
    color: '#065F46',
    fontWeight: '600'
  },
  textoHuellitas: {
    color: '#047857',
    fontWeight: '600'
  },
  textoMsgDeleted: {
    color: '#9CA3AF',
    fontStyle: 'italic',
    fontSize: 14
  },
  especialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  horaTexto: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500'
  },
  checkIcon: {
    marginLeft: 3
  },
  replyContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    marginBottom: 6,
    overflow: 'hidden',
    maxHeight: 100
  },
  replyBar: { width: 4, backgroundColor: '#FF6600' },
  replyContent: { padding: 6, flex: 1, flexDirection: 'row', alignItems: 'center' },
  replyUser: { fontSize: 12, fontWeight: 'bold', color: '#FF6600' },
  replyText: { fontSize: 12, color: '#666' },
  replyImageMini: { width: 35, height: 35, borderRadius: 4, marginLeft: 8 },
  senderInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, opacity: 0.8 },
  senderAvatar: { width: 18, height: 18, borderRadius: 9, marginRight: 5 },
  senderName: { fontSize: 11, fontWeight: 'bold', color: '#6B7280' },
});
