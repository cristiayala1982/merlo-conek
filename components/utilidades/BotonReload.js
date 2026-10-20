import React, { useState, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, Easing, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Componente BotonReload
 * @param {string} label - El texto que mostrará el botón (ej: "Market Merlo")
 * @param {function} onReload - Función que se ejecuta al presionar (limpiar filtros, etc)
 * @param {string} color - Color principal (ej: '#FF6600')
 * @param {string} bgColor - Color de fondo (ej: '#FFF5F0')
 */
export default function BotonReload({ label, onReload, color = '#FF6600', bgColor = '#FFF5F0' }) {
  const [cargando, setCargando] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;

  const handlePress = async () => {
    if (cargando) return;
    setCargando(true);

    // Iniciar animación de giro
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Ejecutar la lógica de recarga
    if (onReload) await onReload();

    // Simular un pequeño delay para que se vea el giro y luego frenar
    setTimeout(() => {
      Animated.timing(rotation).stop();
      rotation.setValue(0);
      setCargando(false);
    }, 600);
  };

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[styles.container, { backgroundColor: bgColor, borderColor: color }]}
    >
      <View style={styles.content}>
        <Text style={[styles.text, { color: color }]}>{label}</Text>
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Ionicons name="refresh" size={16} color={color} style={styles.icon} />
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  icon: {
    marginLeft: 2,
  }
});
