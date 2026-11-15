import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, DeviceEventEmitter, Dimensions, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

/**
 * Función global para mostrar un Toast desde cualquier parte.
 * @param {string} message - El mensaje a mostrar.
 * @param {string} type - 'success', 'error', 'challenge', 'review', 'info'.
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
        toValue: insets.top + 56, // Posicionarlo debajo de la Navbar (56px)
        useNativeDriver: true,
        bounciness: 8
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      })
    ]).start();

    timeoutRef.current = setTimeout(hide, 5000);
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
      case 'success': return { name: 'checkmark-circle', color: '#FF6600' }; // Naranja para éxito
      case 'challenge': return { name: 'sparkles', color: '#FDBA74' };
      case 'error': return { name: 'close-circle', color: '#EF4444' };
      case 'review': return { name: 'time-outline', color: '#FBBF24' };
      default: return { name: 'information-circle', color: '#9CA3AF' }; // Gris para info
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
        <Ionicons name={icon.name} size={18} color={icon.color} style={styles.icon} />
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
    zIndex: 999999,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  toast: {
    backgroundColor: 'rgba(31, 41, 55, 0.95)', // Gris Grafito oscuro con transparencia sutil
    borderLeftWidth: 4,
    borderLeftColor: '#FF6600', // Acento Naranja
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8, // Bordes menos redondeados para mayor elegancia
    width: 'auto',
    maxWidth: width - 40,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  icon: {
    marginRight: 10,
  },
  message: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  }
});
