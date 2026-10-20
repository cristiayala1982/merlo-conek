import { AppState, DeviceEventEmitter } from 'react-native';

/**
 * AppStateManager
 * Vigilante global del ciclo de vida de la aplicación.
 * Se encarga de decidir cuándo la app está "vieja" y necesita refrescarse al volver del segundo plano.
 */

let lastBackgroundTime = null;
const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutos en milisegundos

export const initAppStateManager = () => {
  const subscription = AppState.addEventListener('change', nextAppState => {
    if (nextAppState === 'background') {
      // Guardamos la hora exacta en la que el usuario minimizó la app
      lastBackgroundTime = Date.now();
      console.log("[AppStateManager] App enviada a segundo plano.");
    }

    if (nextAppState === 'active') {
      console.log("[AppStateManager] App volvió a primer plano.");

      if (lastBackgroundTime) {
        const timeElapsed = Date.now() - lastBackgroundTime;

        // Si pasaron más de 5 minutos, mandamos la orden de refrescar el Muro Social
        if (timeElapsed > INACTIVITY_LIMIT) {
          console.log(`[AppStateManager] Pasaron ${Math.round(timeElapsed / 1000)}s. Disparando recarga inteligente.`);
          DeviceEventEmitter.emit('RELOAD_HOME_FEED');
        } else {
          console.log(`[AppStateManager] Solo pasaron ${Math.round(timeElapsed / 1000)}s. Manteniendo persistencia.`);
        }
      }

      // Limpiamos para el próximo ciclo
      lastBackgroundTime = null;
    }
  });

  return () => {
    subscription.remove();
  };
};
