import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../../firebaseConfig';

/**
 * Convierte una URI local en un Blob para subir a Firebase.
 * Incluye limpieza manual de XHR para evitar fugas de memoria en Android.
 */
export const uriABlob = async (uri) => {
  return new Promise((resolve, reject) => {
    console.log("🧩 [BLOB] Iniciando conversión XHR de:", uri);
    let xhr = new XMLHttpRequest();
    xhr.onload = function () {
      const response = xhr.response;
      console.log("✅ [BLOB] Conversión exitosa. Liberando XHR...");
      xhr = null;
      resolve(response);
    };
    xhr.onerror = function (e) {
      console.error("❌ [BLOB] Error uriABlob:", e);
      xhr = null;
      reject(new Error("Error al convertir archivo para la subida"));
    };
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
};

/**
 * Sube un archivo a Firebase Storage y retorna su URL de descarga.
 */
export const subirArchivoConRuta = async (uri, tipo, rutaStorage, onProgress = null) => {
  const blob = await uriABlob(uri);
  const storageRef = ref(storage, rutaStorage);
  let contentType = tipo === 'video' ? 'video/mp4' : (tipo === 'audio' ? 'audio/m4a' : 'image/jpeg');
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
        console.log("☁️ [UPLOAD] Subida completada. Liberando RAM del Blob...");
        if (blob && typeof blob.close === 'function') {
          blob.close();
          console.log("🧹 [RAM] Memoria del Blob liberada con éxito.");
        }
        resolve(url);
      }
    );
  });
};
