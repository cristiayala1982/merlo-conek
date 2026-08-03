import { Slot } from 'expo-router';
import { AppState } from 'react-native';
import { useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { actualizarEstadoOnline } from '../services/firebaseService';
import { onAuthStateChanged } from 'firebase/auth';

export default function GlobalLayout() {
  useEffect(() => {
    let currentUid = null;

    // Escuchar cambios de usuario (Login/Logout)
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUid = user.uid;
        actualizarEstadoOnline(currentUid, true);
      } else {
        if (currentUid) {
          actualizarEstadoOnline(currentUid, false);
        }
        currentUid = null;
      }
    });

    // Escuchar si la app se minimiza o se abre
    const handleAppState = (nextState) => {
      if (currentUid) {
        actualizarEstadoOnline(currentUid, nextState === 'active');
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);

    return () => {
      unsubAuth();
      sub.remove();
      if (currentUid) {
        actualizarEstadoOnline(currentUid, false);
      }
    };
  }, []);

  return <Slot />;
}
