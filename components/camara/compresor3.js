import { Video } from 'react-native-compressor';

/**
 * MOTOR DE TRANSCODIFICACIÓN ROBUSTO
 * Diseñado para manejar videos 4K/HDR sin colapsar el hardware de Android.
 * Optimizado para streaming ultra-rápido en Cloudflare R2 con Range Requests.
 */
export const comprimirVideoPro = async (uriOriginal) => {
  try {
    // 1. Aseguramos el prefijo file:// (Crítico en algunas versiones de Android)
    const inputUri = uriOriginal.startsWith('file://') ? uriOriginal : `file://${uriOriginal}`;

    console.log("💾 [TRANSCODER] Procesando para streaming R2:", inputUri);

    /**
     * Usamos compresión manual de 1.4 Mbps / 1080p máximo.
     * Genera un archivo ultra liviano (~2.5MB por 15s) ideal para Range Requests en Cloudflare R2.
     */
    const uriComprimida = await Video.compress(
      inputUri,
      {
        compressionMethod: 'manual',
        bitrate: 1400000, // 1.4Mbps: Nitidez HD con peso mínimo
        maxSize: 1080,
      }
    );

    if (!uriComprimida) return null;

    console.log("✅ [ÉXITO] Video optimizado con éxito para streaming.");
    return uriComprimida.startsWith('file://') ? uriComprimida : `file://${uriComprimida}`;

  } catch (error) {
    console.log("❌ [FALLO EN EL MOTOR NATIVO]:", error);
    return null;
  }
};
