import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { abrirMapa } from '../../services/mapUtils';
import ReaccionesMensaje from './ReaccionesMensaje';

export default function MensajeUbicacion({
  coords,
  esMio,
  hora,
  leido,
  userPhoto,
  showUserPhoto,
  isHighlighted,
  onLongPress,
  reacciones
}) {
  return (
    <TouchableOpacity
      onPress={() => abrirMapa(coords, 'Ubicación')}
      onLongPress={onLongPress}
      activeOpacity={0.8}
      style={[
        styles.cajaBurbuja,
        esMio ? styles.msgPropio : styles.msgAjeno,
        isHighlighted && styles.msgHighlighted,
        { marginBottom: reacciones && Object.keys(reacciones).length > 0 ? 22 : 4 }
      ]}
    >
      {showUserPhoto && userPhoto && !esMio && (
        <Image source={{ uri: userPhoto }} style={styles.avatar} />
      )}

      <View style={styles.contentRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="location" size={26} color="#FF6600" />
        </View>
        <View style={styles.infoContainer}>
          <Text style={[styles.titulo, isHighlighted && { color: '#1E40AF' }]}>Ubicación compartida</Text>
          <Text style={[styles.subtitulo, isHighlighted && { color: '#3B82F6' }]}>Toca para abrir en el mapa</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={isHighlighted ? "#3B82F6" : "#9CA3AF"} />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.hora, isHighlighted && { color: '#1E40AF' }]}>{hora}</Text>
        {esMio && (
          <Ionicons
            name={leido ? "checkmark-done" : "checkmark"}
            size={18}
            color={leido ? "#2563EB" : "#6B7280"}
            style={{ marginLeft: 4 }}
          />
        )}
      </View>

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
    marginVertical: 3,
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
  msgHighlighted: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF', borderWidth: 1.5 },
  avatar: { width: 28, height: 28, borderRadius: 14, marginRight: 6, alignSelf: 'flex-end', marginBottom: 4 },
  contentRow: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF5F0', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#FFE0CC' },
  infoContainer: { flex: 1 },
  titulo: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  subtitulo: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8, paddingRight: 2 },
  hora: { fontSize: 11.5, color: '#4B5563', fontWeight: '500' }
});
