import { Tabs } from 'expo-router';
import { StyleSheet, View, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Navbar } from '../../components/barraNavegacion/Navbar';
import AmigosModal from '../../components/amigos/AmigosModal';

export default function RootLayout() {
  const insets = useSafeAreaInsets();
  const [mostrarAmigos, setMostrarAmigos] = useState(false);

  useEffect(() => {
    // LIMPIEZA DE EMERGENCIA: Borramos cualquier rastro previo de este evento
    // para evitar que se acumulen "fantasmas" al navegar fuera y dentro.
    DeviceEventEmitter.removeAllListeners('OPEN_AMIGOS_DESAFIO');

    const subOpenAmigos = DeviceEventEmitter.addListener('OPEN_AMIGOS_DESAFIO', (esDesafio = true) => {
      setMostrarAmigos(true);
      // Pequeño delay para asegurar que el modal se monte antes de recibir el evento
      setTimeout(() => {
        DeviceEventEmitter.emit('SET_MODO_DESAFIO', esDesafio);
      }, 100);
    });

    return () => {
      subOpenAmigos.remove();
    };
  }, []);

  return (
    <View style={[
      styles.layoutContainer,
      {
        paddingTop: insets.top,
        paddingBottom: insets.bottom
      }
    ]}>
      <Navbar />
      <View style={styles.contentContainer}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
            lazy: false // Cargar todas las pestañas para que el cambio sea instantáneo
          }}
        >
          <Tabs.Screen name="home/index" />
          <Tabs.Screen name="notificaciones/index" />
          <Tabs.Screen name="perfil/index" />
          <Tabs.Screen name="perfilAjeno/index" />
          <Tabs.Screen name="historias/index" />
        </Tabs>
      </View>

      {/* MODAL UNIFICADO EN EL LAYOUT RAÍZ (Anti-duplicación) */}
      <AmigosModal visible={mostrarAmigos} onClose={() => setMostrarAmigos(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  layoutContainer: { 
    flex: 1, 
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
