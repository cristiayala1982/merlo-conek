import { Linking, Platform } from 'react-native';

/**
 * Función global y centralizada para abrir mapas externos (Google Maps / Apple Maps).
 * Reutilizable en todo el proyecto (Marketplace, Clasificados, Huellitas, Chat, etc.).
 * @param {Object} coords - Coordenadas { latitude, longitude }
 * @param {string} label - Etiqueta opcional para el pin en el mapa
 */
export const abrirMapa = (coords, label = 'Ubicación') => {
  if (!coords || !coords.latitude || !coords.longitude) return;
  const { latitude, longitude } = coords;
  const encodedLabel = encodeURIComponent(label);
  const url = Platform.select({
    ios: `maps:0,0?q=${encodedLabel}@${latitude},${longitude}`,
    android: `geo:0,0?q=${latitude},${longitude}(${encodedLabel})`
  });

  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`);
  });
};
