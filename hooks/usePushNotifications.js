import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from '../firebaseConfig';
import { guardarPushToken } from '../services/firebase/notificationService';

export const usePushNotifications = () => {
  const [expoPushToken, setExpoPushToken] = useState('');
  const notificationListener = useRef();
  const responseListener = useRef();
  const router = useRouter();

  useEffect(() => {
    // 1. Obtener el token
    registerForPushNotificationsAsync().then(token => {
      if (token) setExpoPushToken(token);
    });

    // 2. VIGILANTE: Registro y Limpieza
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // Limpiamos notificaciones al entrar para mantener la barra limpia
        Notifications.dismissAllNotificationsAsync();
        let token = expoPushToken;
        if (!token) token = await registerForPushNotificationsAsync();
        if (token) await guardarPushToken(user.uid, token);
      }
    });

    // 3. LIMPIEZA AUTOMÁTICA: Cuando la app vuelve al primer plano
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        Notifications.dismissAllNotificationsAsync();
      }
    });

    // 4. ESCUCHAR TOQUES (Manejo simple para evitar bucles)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      // Dejamos que el sistema operativo maneje el Deep Link de Kotlin
      // Solo nos encargamos de limpiar la barra aquí
      Notifications.dismissAllNotificationsAsync();
    });

    return () => {
      if (unsubAuth) unsubAuth();
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
      appStateSub.remove();
    };
  }, [expoPushToken]);

  return { expoPushToken };
};

async function registerForPushNotificationsAsync() {
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('chats', {
      name: 'Mensajes de Chat',
      importance: Notifications.AndroidImportance.MAX,
      lightColor: '#FF6600',
    });
  }
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus === 'granted') {
      try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } catch (e) {}
    }
  }
  return token;
}
