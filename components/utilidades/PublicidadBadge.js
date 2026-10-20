import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Componente reutilizable para mostrar la etiqueta de "PUBLICIDAD"
 * en publicaciones impulsadas/pagas para cumplir con las políticas de Google Play.
 */
export default function PublicidadBadge({ style, textStyle }) {
  return (
    <View style={[styles.badge, style]}>
      <Text style={[styles.text, textStyle]}>PUBLICIDAD</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10
  },
  text: {
    color: 'white',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1
  }
});
