import { Stack } from 'expo-router';
import { AppState, View, StyleSheet, Platform, LogBox } from 'react-native';

// Silenciador global para errores inocuos de desconexión de Firebase durante el logout o background
LogBox.ignoreLogs([
  'Missing or insufficient permissions',
  'Uncaught Error in snapshot listener'
]);

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { NavigationBar } from 'expo-navigation-bar';
import { auth } from '../firebaseConfig';
import { actualizarEstadoOnline } from '../services/firebaseService';
import CustomToast from '../components/utilidades/CustomToast';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { initAppStateManager } from '../services/appStateManager';
import mobileAds from 'react-native-google-mobile-ads';

function AppContent() {
  usePushNotifications(); // Activa las notificaciones y pide permisos

  return (
    <View style={styles.mainContainer}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="postDetalle" />
        {/* PRESENTACIÓN MODAL PARA LOS VISORES */}
        <Stack.Screen
          name="(viewers)/video-viewer"
          options={{
            presentation: 'modal',
            animation: 'fade',
            gestureEnabled: true
          }}
        />
        <Stack.Screen
          name="(viewers)/image-viewer"
          options={{
            presentation: 'modal',
            animation: 'fade',
            gestureEnabled: true
          }}
        />
      </Stack>
      <CustomToast />
    </View>
  );
}

export default function GlobalLayout() {
  useEffect(() => {
    let unsubAuth;

    const handleStatus = async (uid, status) => {
      if (!uid) return;
      await actualizarEstadoOnline(uid, status);
    };

    unsubAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        handleStatus(user.uid, true);
      }
    });

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const uid = auth.currentUser?.uid;
      if (uid) {
        if (nextAppState === 'active') {
          handleStatus(uid, true);
        } else {
          handleStatus(uid, false);
        }
      }
    });

    const heartbeat = setInterval(() => {
      const uid = auth.currentUser?.uid;
      if (uid && AppState.currentState === 'active') {
        handleStatus(uid, true);
      }
    }, 60000);

    // INICIAR EL VIGILANTE DE ESTADO (AppStateManager)
    const cleanupManager = initAppStateManager();

    // INICIALIZAR ADMOB
    mobileAds()
      .initialize()
      .then(adapterStatuses => {
        console.log('✅ [AdMob] SDK Inicializado correctamente');
      })
      .catch(err => {
        console.warn('❌ [AdMob] Error al inicializar SDK:', err);
      });

    return () => {
      if (unsubAuth) unsubAuth();
      subscription.remove();
      clearInterval(heartbeat);
      cleanupManager();
    };
  }, []);

  return (
    <SafeAreaProvider>
      {Platform.OS === 'android' && <NavigationBar style="dark" />}
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
