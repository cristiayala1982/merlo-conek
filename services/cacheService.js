import { NativeModules, Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';

const { HistoriasLabNative } = NativeModules;

/**
 * Realiza una limpieza profunda del caché de la aplicación.
 * @param {boolean} mostrarAlerta - Si se debe mostrar un Alert al finalizar (para pruebas).
 */
export const limpiarCacheProfundo = async (mostrarAlerta = false) => {
  console.log("🧹 [LIMPIEZA] Iniciando purga total de caché...");

  try {
    // 1. Limpiar caché de expo-image (Fotos del muro, market, etc.)
    await Image.clearDiskCache();
    console.log("🖼️ [LIMPIEZA] Caché de expo-image borrado.");

    // 2. Limpiar carpeta temporal de FileSystem (Videos optimizados, miniaturas)
    if (FileSystem.cacheDirectory) {
        const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
        for (const file of files) {
            try {
                await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${file}`, { idempotent: true });
            } catch (e) {
                // Algunos archivos pueden estar bloqueados, los ignoramos
            }
        }
    }
    console.log("💾 [LIMPIEZA] Carpeta temporal de FileSystem vaciada.");

    // 3. Limpieza Nativa (La solución definitiva)
    if (Platform.OS === 'android' && HistoriasLabNative?.limpiarCacheNativo) {
      await HistoriasLabNative.limpiarCacheNativo();
      console.log("🤖 [LIMPIEZA] Comando nativo ejecutado con éxito.");
    }

    if (mostrarAlerta) {
      Alert.alert(
        "🧹 Caché Limpio",
        "Se eliminó toda la basura del disco y la memoria. La app está como nueva.",
        [{ text: "OK" }]
      );
    }

    return true;
  } catch (error) {
    console.error("❌ [LIMPIEZA] Error al limpiar caché:", error);
    return false;
  }
};
