import { NativeModules, Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';

const { HistoriasLabNative } = NativeModules;

/**
 * Obtiene el tamaño actual del caché en MegaBytes.
 */
export const obtenerTamanoCacheMB = async () => {
    if (Platform.OS === 'android' && HistoriasLabNative?.obtenerTamanoCache) {
        try {
            const bytes = await HistoriasLabNative.obtenerTamanoCache();
            return parseFloat((bytes / (1024 * 1024)).toFixed(2));
        } catch (e) {
            console.error("Error midiendo cache:", e);
            return 0;
        }
    }
    return 0;
};

/**
 * Borra archivos de la carpeta cache que tengan más de X horas,
 * PROTEGIENDO archivos críticos de historias y miniaturas.
 */
const limpiarArchivosViejos = async (horas = 24, protegerCriticos = true) => {
    try {
        const cacheDir = FileSystem.cacheDirectory;
        if (!cacheDir) return;
        const files = await FileSystem.readDirectoryAsync(cacheDir);
        const ahora = Date.now();
        const limiteMs = horas * 60 * 60 * 1000;
        let borrados = 0;

        for (const file of files) {
            const uri = `${cacheDir}${file}`;

            // PROTECCIÓN: Si el archivo es una historia o miniatura, lo saltamos en limpiezas normales
            if (protegerCriticos) {
                const nombreLower = file.toLowerCase();
                if (nombreLower.includes('thumb') || nombreLower.includes('historia')) {
                    continue;
                }
            }

            const info = await FileSystem.getInfoAsync(uri);
            if (info.exists && !info.isDirectory) {
                const fechaMod = info.modificationTime * 1000;
                if (ahora - fechaMod > limiteMs) {
                    await FileSystem.deleteAsync(uri, { idempotent: true });
                    borrados++;
                }
            }
        }
        console.log(`🧹 [LIMPIEZA] Se eliminaron ${borrados} archivos antiguos.`);
    } catch (e) {
        console.error("Error en limpieza por antigüedad:", e);
    }
};

/**
 * Limpieza SELECTIVA: Borra videos (.mp4) y miniaturas de creación.
 * Protege las miniaturas e imágenes de historias ya publicadas.
 */
export const limpiarRastroSubida = async (mostrarAlerta = false) => {
    console.log("✂️ [SISTEMA] Iniciando limpieza selectiva de subida...");
    try {
        let borrados = 0;

        const scanAndClean = async (directory) => {
            if (!directory) return;
            const files = await FileSystem.readDirectoryAsync(directory);
            for (const file of files) {
                const uri = `${directory}${file}`;
                const nombreLower = file.toLowerCase();

                // Borramos videos siempre (son lo más pesado)
                if (file.endsWith('.mp4') || file.endsWith('.m4a')) {
                    await FileSystem.deleteAsync(uri, { idempotent: true });
                    borrados++;
                }
                // Borramos la carpeta temporal de miniaturas de EXPO pero NO las historias
                else if (file === 'VideoThumbnails') {
                    // En lugar de borrar la carpeta, la vaciamos pero chequeando nombres
                    try {
                        const subFiles = await FileSystem.readDirectoryAsync(uri + '/');
                        for (const sf of subFiles) {
                            // Si NO dice historia, lo borramos (basura de posteo común)
                            if (!sf.toLowerCase().includes('historia')) {
                                await FileSystem.deleteAsync(`${uri}/${sf}`, { idempotent: true });
                                borrados++;
                            }
                        }
                    } catch (err) {
                        // Si falla entrar, borramos la carpeta (comportamiento anterior)
                        await FileSystem.deleteAsync(uri, { idempotent: true });
                    }
                }
            }
        };

        await scanAndClean(FileSystem.cacheDirectory);
        await scanAndClean(FileSystem.documentDirectory);

        console.log(`✅ [SISTEMA] Se eliminaron ${borrados} archivos pesados. Historias protegidas.`);

        if (mostrarAlerta) {
            Alert.alert(
                "🎬 Post Limpio",
                "Se eliminó el rastro del video. Las historias y fotos del muro siguen protegidas para máxima fluidez.",
                [{ text: "OK" }]
            );
        }
        return true;
    } catch (error) {
        console.error("❌ Error en limpieza selectiva:", error);
        return false;
    }
};

/**
 * Mantenimiento inteligente: Actúa por niveles protegiendo la fluidez.
 */
export const mantenimientoInteligente = async (umbralMB = 200) => {
    const actual = await obtenerTamanoCacheMB();
    console.log(`📊 [SALUD] Caché actual: ${actual} MB`);

    if (actual > 450) {
        // NIVEL ROJO (> 450MB): Único nivel donde se borra todo (Bomba Atómica)
        console.log("🚨 [SALUD] Nivel Rojo Crítico. Limpiando TODO.");
        await limpiarCacheProfundo(true, "⚠️ Memoria Crítica", `El caché llegó a ${actual} MB. Tuvimos que liberar todo el espacio para que el celular no se trabe.`);
        return true;
    }

    if (actual > 250) {
        // NIVEL NARANJA (250MB - 450MB): Borrar videos + archivos viejos pero PROTEGIENDO historias
        console.log("🟠 [SALUD] Nivel Naranja. Limpiando con protección de historias...");
        await limpiarRastroSubida();
        await limpiarArchivosViejos(24, true); // true = protege historias/thumbs

        Alert.alert(
            "🧹 Mantenimiento Inteligente",
            `Bajamos de ${actual} MB limpiando basura antigua. Tus historias y fotos recientes siguen guardadas para que la app vuele.`,
            [{ text: "Excelente" }]
        );
        return true;
    }

    if (actual > 150) {
        // NIVEL AMARILLO (150MB - 250MB): Solo borrar videos (monstruos)
        console.log("🟡 [SALUD] Nivel Amarillo. Borrando solo videos pesados...");
        await limpiarRastroSubida();
        return true;
    }

    console.log("🟢 [SALUD] Nivel Verde. Disco saludable y fluido.");
    return false;
};

/**
 * Realiza una limpieza profunda del caché de la aplicación.
 */
export const limpiarCacheProfundo = async (mostrarAlerta = false, tituloAlerta = "🧹 Caché Limpio", mensajeAlerta = "Se eliminó toda la basura del disco y la memoria.") => {
  console.log("🧹 [LIMPIEZA] Iniciando purga total de caché...");
  try {
    await Image.clearDiskCache();
    if (Platform.OS === 'android' && HistoriasLabNative?.limpiarCacheNativo) {
      await HistoriasLabNative.limpiarCacheNativo();
    }
    if (mostrarAlerta) {
      Alert.alert(tituloAlerta, mensajeAlerta, [{ text: "OK" }]);
    }
    return true;
  } catch (error) {
    console.error("❌ [LIMPIEZA] Error al limpiar caché:", error);
    return false;
  }
};
