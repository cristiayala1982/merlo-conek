import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, DeviceEventEmitter, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

/**
 * Función global para mostrar un Toast desde cualquier parte.
 * @param {string} message - El mensaje a mostrar.
 * @param {string} type - 'success', 'error', 'challenge', 'info'.
 */
export const showToast = (message, type = 'success') => {
  DeviceEventEmitter.emit('SHOW_CUSTOM_TOAST', { message, type });
};

export default function CustomToast() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState({ message: '', type: 'success' });
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef(null);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('SHOW_CUSTOM_TOAST', (data) => {
      show(data);
    });
    return () => {
      sub.remove();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const show = (data) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setConfig(data);
    setVisible(true);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: insets.top + 10,
        useNativeDriver: true,
        bounciness: 8
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      })
    ]).start();

    timeoutRef.current = setTimeout(hide, 3000);
  };

  const hide = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 400,
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      })
    ]).start(() => setVisible(false));
  };

  if (!visible) return null;

  const getIcon = () => {
    switch (config.type) {
      case 'success': return { name: 'checkmark-circle', color: '#10B981' };
      case 'challenge': return { name: 'sparkles', color: '#FF6600' };
      case 'error': return { name: 'close-circle', color: '#EF4444' };
      default: return { name: 'information-circle', color: '#3B82F6' };
    }
  };

  const icon = getIcon();

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }], opacity }
      ]}
    >
      <View style={styles.toast}>
        <Ionicons name={icon.name} size={22} color={icon.color} style={styles.icon} />
        <Text style={styles.message}>{config.message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999999, // Super por encima de todo
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  toast: {
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 100, // Estilo píldora
    width: 'auto',
    maxWidth: width - 40,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  icon: {
    marginRight: 10,
  },
  message: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  }
});
