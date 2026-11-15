import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../../firebaseConfig';
import Constants from 'expo-constants';

const R2_WORKER_URL = process.env.EXPO_PUBLIC_R2_WORKER_URL || Constants.expoConfig?.extra?.r2WorkerUrl || 'https://merloconek-upload.cristianayala10.workers.dev';

/**
 * Sube un archivo a Cloudflare R2 como binario puro (ArrayBuffer) o a Firebase Storage como fallback.
 */
export const subirArchivoConRuta = async (uri, tipo, rutaStorage, onProgress = null) => {
  let contentType = tipo === 'video' ? 'video/mp4' : (tipo === 'audio' ? 'audio/m4a' : 'image/jpeg');

  // Si tenemos configurado el Worker de Cloudflare R2, subimos ahí como binario puro
  if (R2_WORKER_URL && R2_WORKER_URL !== 'https://tu-worker.workers.dev') {
    console.log("☁️ [R2 BINARY UPLOAD] Subiendo archivo binario a Cloudflare R2 vía Worker...");
    try {
      // Obtenemos el ArrayBuffer directamente de la URI local
      const fileResponse = await fetch(uri);
      const arrayBuffer = await fileResponse.arrayBuffer();

      const uploadUrl = `${R2_WORKER_URL}?path=${encodeURIComponent(rutaStorage)}`;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: arrayBuffer,
        headers: {
          'Content-Type': contentType,
        },
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Worker R2 no devolvió JSON válido. Respuesta: ${responseText.substring(0, 150)}`);
      }

      if (response.ok && data.success && data.url) {
        console.log("✅ [R2 BINARY UPLOAD] Subido con éxito a R2:", data.url);
        return data.url;
      } else {
        throw new Error(data.error || `Error HTTP ${response.status}: ${responseText.substring(0, 100)}`);
      }
    } catch (r2Error) {
      console.error("❌ [R2 BINARY UPLOAD] Falló R2, intentando fallback con Firebase Storage:", r2Error);
    }
  }

  // Fallback a Firebase Storage original (requiere blob)
  console.log("🔄 [FALLBACK] Subiendo a Firebase Storage...");
  let blob = null;
  try {
    blob = await new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.onload = function () {
        const response = xhr.response;
        xhr = null;
        resolve(response);
      };
      xhr.onerror = function (e) {
        xhr = null;
        reject(new Error("Error al convertir archivo para Firebase Storage"));
      };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });
  } catch (blobErr) {
    console.error("❌ Error creando blob para fallback:", blobErr);
    throw blobErr;
  }

  const storageRef = ref(storage, rutaStorage);
  const uploadTask = uploadBytesResumable(storageRef, blob, { contentType });

  return new Promise((resolve, reject) => {
    uploadTask.on('state_changed',
      (snap) => { if (onProgress) onProgress(snap.bytesTransferred, snap.totalBytes); },
      (err) => {
        if (blob && typeof blob.close === 'function') blob.close();
        reject(err);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        if (blob && typeof blob.close === 'function') {
          blob.close();
        }
        resolve(url);
      }
    );
  });
};

/**
 * Elimina un archivo de Cloudflare R2 o de Firebase Storage según la URL proporcionada.
 */
export const borrarArchivoPorUrl = async (url) => {
  if (!url) return;
  try {
    if (url.includes('r2.dev')) {
      const parts = url.split('.dev/');
      if (parts.length > 1) {
        const rutaStorage = parts[1];
        const deleteUrl = `${R2_WORKER_URL}?path=${encodeURIComponent(rutaStorage)}`;
        await fetch(deleteUrl, { method: 'DELETE' });
        console.log("🗑️ [R2] Archivo eliminado de R2:", rutaStorage);
      }
    } else if (url.includes('firebasestorage')) {
      const storageRef = ref(storage, url);
      await deleteObject(storageRef);
      console.log("🗑️ [Firebase] Archivo eliminado de Firebase Storage.");
    }
  } catch (e) {
    console.error("❌ Error al eliminar archivo:", e);
  }
};
