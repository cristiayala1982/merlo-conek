import * as FileSystem from 'expo-file-system/legacy';

/**
 * SERVICIO DE MODERACIÓN DE IMÁGENES EN LA NUBE (Sightengine / Nudity Detection)
 *
 * Evalúa imágenes antes de ser publicadas en el muro social.
 * Clasifica en 3 niveles:
 * 1. BLOQUEAR: Desnudez explícita / Contenido obsceno (>= 50%) o erotismo elevado (>= 70%)
 * 2. PENDIENTE_REVISION: Contenido dudoso / sugestivo (25% - 50%) -> Envía a 'reportes'
 * 3. APROBADO: Imagen segura (< 25%)
 */

// Credenciales de Sightengine (Se pueden configurar vía variables de entorno EXPO_PUBLIC_)
const SIGHTENGINE_USER = process.env.EXPO_PUBLIC_SIGHTENGINE_USER || '38325635';
const SIGHTENGINE_SECRET = process.env.EXPO_PUBLIC_SIGHTENGINE_SECRET || '35tFWyTYkjuHBAMrwZjpgFStuSvKuZdD';

/**
 * Evalúa si una imagen local (uri) o remota (url) contiene contenido obsceno o desnudez.
 * @param {string} imageUri Ruta de la imagen local (file://...) o URL (http://...)
 * @returns {Promise<{ accion: 'BLOQUEAR' | 'PENDIENTE_REVISION' | 'APROBADO' | 'ERROR', motivo: string, detalles?: object, puntaje?: number }>}
 */
export const evaluarImagenSensible = async (imageUri) => {
  if (!imageUri) {
    return { accion: 'APROBADO', motivo: 'Sin imagen para evaluar' };
  }

  // Si no hay credenciales configuradas válidas o reales, registrar advertencia y aprobar (Fail-safe)
  const credencialesValidas = SIGHTENGINE_USER && SIGHTENGINE_SECRET &&
    SIGHTENGINE_USER !== '123456789' && SIGHTENGINE_SECRET !== 'your_sightengine_secret';

  if (!credencialesValidas) {
    console.warn('[Moderación Cloud] Credenciales de Sightengine no configuradas. Omitiendo evaluación automática.');
    return { accion: 'ERROR', motivo: 'Servicio de moderación sin credenciales configuradas' };
  }

  try {
    let data = null;

    if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
      console.log('[Moderación Cloud] Evaluando URL remota...');
      const params = new URLSearchParams({
        models: 'nudity-2.0',
        api_user: SIGHTENGINE_USER,
        api_secret: SIGHTENGINE_SECRET,
        url: imageUri
      });
      const response = await fetch(`https://api.sightengine.com/1.0/check.json?${params.toString()}`);
      data = await response.json();
    } else {
      const formattedUri = imageUri.startsWith('file://') || imageUri.startsWith('content://')
        ? imageUri
        : `file://${imageUri}`;

      console.log('[Moderación Cloud] Evaluando archivo local con FileSystem.uploadAsync:', formattedUri);

      try {
        const uploadResult = await FileSystem.uploadAsync(
          'https://api.sightengine.com/1.0/check.json',
          formattedUri,
          {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: 'media',
            parameters: {
              models: 'nudity-2.0',
              api_user: SIGHTENGINE_USER,
              api_secret: SIGHTENGINE_SECRET
            }
          }
        );

        if (uploadResult?.body) {
          data = JSON.parse(uploadResult.body);
        }
      } catch (fsError) {
        console.warn('[Moderación Cloud] FileSystem.uploadAsync falló, reintentando con XHR:', fsError?.message || fsError);

        data = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const formData = new FormData();
          formData.append('models', 'nudity-2.0');
          formData.append('api_user', SIGHTENGINE_USER);
          formData.append('api_secret', SIGHTENGINE_SECRET);

          const ext = formattedUri.split('.').pop() || 'jpg';
          formData.append('media', {
            uri: formattedUri,
            name: `upload.${ext}`,
            type: `image/${ext === 'png' ? 'png' : 'jpeg'}`
          });

          xhr.open('POST', 'https://api.sightengine.com/1.0/check.json');
          xhr.onload = () => {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (e) {
              reject(e);
            }
          };
          xhr.onerror = () => reject(new Error('Error de conexión XHR al evaluar imagen'));
          xhr.ontimeout = () => reject(new Error('Tiempo de espera XHR agotado'));
          xhr.timeout = 15000;
          xhr.send(formData);
        });
      }
    }

    if (!data || data.status !== 'success') {
      console.error('[Moderación Cloud] Error de API Sightengine:', data?.error?.message || data);
      return { accion: 'ERROR', motivo: data?.error?.message || 'Error al consultar API de moderación' };
    }

    const nudity = data.nudity || {};

    // 1. Puntuaciones de Desnudez Explícita Real (Pechos al descubierto, pezones, genitales, sexo)
    const scoreRaw = nudity.raw || 0;
    const scoreActividadSexual = nudity.sexual_activity || 0;
    const scoreMuestraSexual = nudity.sexual_display || 0;
    const scoreErotica = nudity.erotica || 0;

    // Desnudez Explícita pura (Muestra sexual / Actividad sexual / Raw)
    const scoreExplicitoDirecto = Math.max(scoreRaw, scoreActividadSexual, scoreMuestraSexual);

    console.log(`[Moderación Cloud] Puntuaciones -> Muestra Sexual/Desnudez: ${(scoreExplicitoDirecto * 100).toFixed(1)}%, Erótico: ${(scoreErotica * 100).toFixed(1)}%`);

    // REGLA 1: BIKINIS / PLAYA / ROPA DE VERANO -> APROBAR DE UNA
    // Permitimos erotismo hasta 55% (para que bikinis y ropa de playa pasen sin mandar a revisión),
    // siempre que la desnudez explícita real (raw) sea baja (< 12%).
    if (scoreExplicitoDirecto < 0.12 && scoreErotica < 0.55) {
      console.log('✅ [Moderación Cloud] Imagen APROBADA (Bikini/Playa/Ropa de verano).');
      return {
        accion: 'APROBADO',
        motivo: 'Imagen limpia y segura',
        puntaje: scoreExplicitoDirecto,
        detalles: nudity
      };
    }

    // REGLA 2: DESNUDEZ EXPLÍCITA REAL / PECHOS DESCUBIERTOS / GENITALES -> BLOQUEAR DE UNA
    if (scoreExplicitoDirecto >= 0.18 || scoreActividadSexual >= 0.15) {
      console.warn('🚫 [Moderación Cloud] Imagen BLOQUEADA por desnudez explícita.');
      return {
        accion: 'BLOQUEAR',
        motivo: 'Tu publicación contiene contenido no permitido y fue rechazada.',
        puntaje: Math.max(scoreExplicitoDirecto, scoreActividadSexual),
        detalles: nudity
      };
    }

    // REGLA 3: CASOS BORDES / TRANSPARENCIAS / STICKERS SOBRE DESNUDO -> PENDIENTE DE REVISIÓN
    // (Genera reporte automático para el panel de administración y se oculta del muro)
    console.log('⚠️ [Moderación Cloud] Imagen PENDIENTE DE REVISIÓN (Caso borde / Transparencia / Contenido dudosamente erótico).');
    return {
      accion: 'PENDIENTE_REVISION',
      motivo: 'Imagen con contenido dudoso o potencialmente sensible.',
      puntaje: Math.max(scoreExplicitoDirecto, scoreErotica),
      detalles: nudity
    };

  } catch (error) {
    console.error('[Moderación Cloud] Excepción al evaluar imagen:', error);
    return { accion: 'ERROR', motivo: error?.message || 'Fallo en evaluación por red' };
  }
};

export default {
  evaluarImagenSensible
};
