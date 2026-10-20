import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { auth } from '../firebaseConfig';
import { guardarPushToken } from '../services/firebase/notificationService';

// Configuración de cómo se muestran las notificaciones cuando la app está abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const usePushNotifications = () => {
  const [expoPushToken, setExpoPushToken] = useState('');
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        const uid = auth.currentUser?.uid;
        if (uid) {
          guardarPushToken(uid, token);
        }
      }
    });

    // Escuchar cuando llega una notificación mientras la app está abierta
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notificación recibida en primer plano:', notification);
    });

    // Escuchar cuando el usuario toca la notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Usuario tocó la notificación:', response);
      // Aquí podrías manejar la navegación profunda (deep linking) al chat
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return { expoPushToken };
};

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
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
    if (finalStatus !== 'granted') {
      console.log('Permiso de notificaciones denegado');
      return;
    }

    // Obtener el token de Expo
    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'merloconekapp' // Puedes usar Constants.expoConfig.extra.eas.projectId si lo tienes configurado
      })).data;
    } catch (e) {
      console.log('Error obteniendo token:', e);
    }
  } else {
    console.log('Debes usar un dispositivo físico para notificaciones push');
  }

  return token;
}
