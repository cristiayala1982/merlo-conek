import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * UTILERÍA CENTRAL DE OPTIMIZACIÓN DE IMÁGENES - CONEK
 * Ubicación: components/camaraFotos/OptimizadorImagenes.js
 */

/**
 * Comprime una imagen a calidad HD (1080px de ancho) para que sea liviana.
 * Suele reducir fotos de 5-10MB a unos 600KB.
 */
export const comprimirImagenPrincipal = async (uri) => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1080 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result?.uri || null;
  } catch (error) {
    console.error("❌ [OPTIMIZADOR] Error comprimiendo imagen principal:", error);
    return null;
  }
};

/**
 * Genera una miniatura ultra-baja (150px) para usar como placeholder borroso.
 * Permite que la app muestre algo instantáneamente mientras descarga la imagen real.
 */
export const generarMiniaturaLQ = async (uri) => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 150 } }],
      { compress: 0.1, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result?.uri || null;
  } catch (error) {
    console.error("❌ [OPTIMIZADOR] Error generando miniatura LQ:", error);
    return null;
  }
};

/**
 * Compara dos archivos y muestra en consola cuánto espacio se ahorró.
 */
export const logAhorroDatos = async (uriOriginal, uriFinal, contexto = "IMAGEN") => {
  try {
    const infoO = await FileSystem.getInfoAsync(uriOriginal);
    const infoF = await FileSystem.getInfoAsync(uriFinal);

    if (infoO.exists && infoF.exists) {
      const sizeO = (infoO.size / (1024 * 1024)).toFixed(2); // MB
      const sizeF = (infoF.size / 1024).toFixed(2); // KB
      const ahorro = (((infoO.size - infoF.size) / infoO.size) * 100).toFixed(1);

      console.log(`📏 [${contexto}] Original: ${sizeO} MB -> Comprimido: ${sizeF} KB (Ahorro: ${ahorro}%)`);
    }
  } catch (e) {
    // Silencioso por si falla la lectura de info
  }
};

/**
 * Procesa una imagen de forma completa (Principal + LQ) y devuelve las URIs.
 */
export const procesarImagenCompleta = async (uri, contexto = "POST") => {
    console.log(`📸 [OPTIMIZADOR] Procesando ${contexto}...`);

    const principal = await comprimirImagenPrincipal(uri);
    const lq = await generarMiniaturaLQ(uri);

    if (principal) {
        await logAhorroDatos(uri, principal, contexto);
    }

    return {
        uriPrincipal: principal || uri,
        uriLQ: lq || null
    };
};
