import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function MensajeTexto({ texto, esMio, hora }) {
  return (
    <View style={[styles.cajaMensaje, esMio ? styles.msgPropio : styles.msgAjeno]}>
      <Text style={styles.textoMsg}>{texto}</Text>
      <Text style={styles.horaTexto}>{hora}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cajaMensaje: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: '100%',
    borderWidth: 1.5
  },
  msgPropio: {
    borderColor: '#FF6600',
    backgroundColor: '#FFF5ED',
    borderBottomRightRadius: 4
  },
  msgAjeno: {
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    borderBottomLeftRadius: 4
  },
  textoMsg: { fontSize: 17, color: '#1F2937' },
  horaTexto: { fontSize: 11, color: '#6B7280', fontWeight: 'bold', textAlign: 'right', marginTop: 2 },
});
