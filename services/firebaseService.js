import { addDoc, collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes, uploadBytesResumable } from 'firebase/storage';
import { auth, db, storage } from '../firebaseConfig';

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const esErrorTransitorio = (error) => {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const texto = `${code} ${message}`;

  return [
    'unavailable',
    'deadline-exceeded',
    'aborted',
    'resource-exhausted',
    'network-request-failed',
    'webchannel',
    'transport',
    'timeout',
  ].some((token) => texto.includes(token));
};

const ejecutarConReintento = async (fn, { maxIntentos = 3, esperaBaseMs = 350 } = {}) => {
  let ultimoError;

  for (let intento = 1; intento <= maxIntentos; intento += 1) {
    try {
      return await fn();
    } catch (error) {
      ultimoError = error;
      const puedeReintentar = esErrorTransitorio(error) && intento < maxIntentos;
      if (!puedeReintentar) {
        throw error;
      }

      await esperar(esperaBaseMs * intento);
    }
  }

  throw ultimoError;
};

/**
 * Sube un archivo a Firebase Storage y retorna su URL
 */
const normalizarUriLocal = (uri) => {
  if (!uri) return uri;
  if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('http')) {
    return uri;
  }
  return `file://${uri}`;
};

const uriABlob = async (uri) => {
  const uriNormalizada = normalizarUriLocal(uri);

  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onerror = () => reject(new TypeError(`No se pudo cargar el archivo local: ${uriNormalizada}`));
    xhr.onload = () => resolve(xhr.response);
    xhr.responseType = 'blob';
    xhr.open('GET', uriNormalizada, true);
    xhr.send(null);
  });
};

const subirArchivoSimple = async (uri, tipo, carpeta) => {
  const blob = await uriABlob(uri);
  const nombreArchivo = `${Date.now()}_${tipo === 'video' ? 'video.mp4' : 'thumb.jpg'}`;
  const storageRef = ref(storage, `${carpeta}/${nombreArchivo}`);
  const snapshot = await uploadBytes(storageRef, blob, {
    contentType: tipo === 'video' ? 'video/mp4' : 'image/jpeg',
  });

  if (typeof blob.close === 'function') {
    blob.close();
  }

  return await getDownloadURL(snapshot.ref);
};

const subirArchivoConRuta = async (uri, tipo, rutaStorage, onProgress = null) => {
  const blob = await uriABlob(uri);
  const storageRef = ref(storage, rutaStorage);
  const metadata = {
    contentType: tipo === 'video' ? 'video/mp4' : 'image/jpeg',
  };

  const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

  const snapshot = await new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (taskSnapshot) => {
        if (typeof onProgress === 'function') {
          onProgress(taskSnapshot.bytesTransferred, taskSnapshot.totalBytes);
        }
      },
      (error) => reject(error),
      () => resolve(uploadTask.snapshot)
    );
  });

  if (typeof blob.close === 'function') {
    blob.close();
  }

  return await getDownloadURL(snapshot.ref);
};

export const subirArchivoAFirebase = async (uri, tipo, coleccion = "historias", thumbnailUri = null) => {
  try {
    console.log(`🚀 Iniciando subida a Firebase (${coleccion})...`);

    // 1. Subir el archivo principal (video o foto)
    const downloadURL = await subirArchivoSimple(uri, tipo, coleccion);

    // 2. Si hay miniatura, subirla también
    let thumbnailUrl = null;
    if (thumbnailUri) {
      console.log("🖼️ Subiendo miniatura...");
      thumbnailUrl = await subirArchivoSimple(thumbnailUri, 'foto', `${coleccion}/thumbs`);
    }

    // 3. Guardar metadata en Firestore
    const docRef = await addDoc(collection(db, coleccion), {
      url: downloadURL,
      thumbnailUrl: thumbnailUrl,
      tipo: tipo,
      fecha: serverTimestamp(),
      visto: false,
      creadoPor: "Cristian"
    });

    console.log(`✅ Todo guardado con éxito. ID:`, docRef.id);
    return { downloadURL, thumbnailUrl };
  } catch (error) {
    console.error(`❌ Error en subirArchivoAFirebase:`, error);
    throw error;
  }
};

export const subirPostAFirebase = async ({
  uri,
  tipo,
  thumbnailUri = null,
  texto = '',
  fileSizeBytes = null,
  duracionMs = null,
  width = null,
  height = null,
  onProgress = null,
}) => {
  let postDocRef = null;
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      throw new Error('Debes iniciar sesion para publicar un post.');
    }

    const postsRef = collection(db, 'posts');
    postDocRef = doc(postsRef);
    const postId = postDocRef.id;

    const basePath = `posts/${uid}/${postId}`;
    const mediaPath = tipo === 'video' ? `${basePath}/video.mp4` : `${basePath}/image.jpg`;
    const thumbnailPath = thumbnailUri ? `${basePath}/thumbnail.jpg` : null;
    let ultimoPctPersistido = -1;

    const persistirProgreso = (pct, fase) => {
      if (!postDocRef) return;

      const progresoNormalizado = Math.max(0, Math.min(99, Math.round(Number(pct) || 0)));
      const saltoMinimo = 4;
      const esPasoRelevante =
        progresoNormalizado >= 99 ||
        ultimoPctPersistido < 0 ||
        progresoNormalizado - ultimoPctPersistido >= saltoMinimo;

      if (!esPasoRelevante) return;

      ultimoPctPersistido = progresoNormalizado;
      updateDoc(postDocRef, {
        uploadProgress: progresoNormalizado,
        uploadPhase: fase || 'subiendo',
      }).catch(() => {
        // No bloqueamos la subida por una actualizacion visual de progreso.
      });
    };

    // Intentamos obtener el nombre del usuario para guardarlo en el post
    let userNombre = 'Usuario';
    try {
        const userDoc = await getDoc(doc(db, 'usuarios', uid));
        if (userDoc.exists()) {
            userNombre = userDoc.data().nombre || 'Usuario';
        }
    } catch (e) {
        console.log('Error obteniendo nombre para post:', e);
    }

    await ejecutarConReintento(() => setDoc(postDocRef, {
      postId,
      userId: uid,
      userName: userNombre,
      tipo,
      texto,
      status: 'uploading',
      uploadProgress: 0,
      uploadPhase: 'preparando',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      url: null,
      thumbnailUrl: null,
      storagePath: mediaPath,
      thumbnailPath,
      fileSizeBytes,
      duracionMs,
      width,
      height,
    }));

    const mediaUrl = await ejecutarConReintento(() => subirArchivoConRuta(uri, tipo, mediaPath, (bytes, total) => {
      if (typeof onProgress === 'function') {
        const pct = total > 0 ? Math.round((bytes / total) * 80) : 0;
        persistirProgreso(pct, 'subiendo-media');
        onProgress({
          fase: 'subiendo-media',
          progreso: Math.max(1, pct),
        });
      }
    }));

    let thumbnailUrl = null;
    if (thumbnailUri && thumbnailPath) {
      thumbnailUrl = await ejecutarConReintento(() => subirArchivoConRuta(thumbnailUri, 'foto', thumbnailPath, (bytes, total) => {
        if (typeof onProgress === 'function') {
          const pctThumb = total > 0 ? Math.round((bytes / total) * 20) : 0;
          persistirProgreso(80 + pctThumb, 'subiendo-thumbnail');
          onProgress({
            fase: 'subiendo-thumbnail',
            progreso: 80 + pctThumb,
          });
        }
      }));
    }

    await ejecutarConReintento(() => updateDoc(postDocRef, {
      status: 'ready',
      uploadProgress: 100,
      uploadPhase: 'completado',
      url: mediaUrl,
      thumbnailUrl,
      updatedAt: serverTimestamp(),
    }));

    if (typeof onProgress === 'function') {
      onProgress({
        fase: 'completado',
        progreso: 100,
      });
    }

    return { postId, mediaUrl, thumbnailUrl };
  } catch (error) {
    if (postDocRef) {
      try {
        await ejecutarConReintento(() => updateDoc(postDocRef, {
          status: 'error',
          uploadPhase: 'error',
          updatedAt: serverTimestamp(),
          errorMessage: error?.message || 'Error desconocido subiendo post',
        }), { maxIntentos: 2, esperaBaseMs: 250 });
      } catch {
        // Si falla la escritura de estado no bloqueamos el error principal.
      }
    }

    console.error('❌ Error en subirPostAFirebase:', error);
    throw error;
  }
};

export const subirHistoriaAFirebase = async ({
  uri,
  tipo,
  thumbnailUri = null,
  fileSizeBytes = null,
  duracionMs = null,
  width = null,
  height = null,
  onProgress = null,
}) => {
  let historiaDocRef = null;
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      throw new Error('Debes iniciar sesion para publicar una historia.');
    }

    const historiasRef = collection(db, 'historias');
    historiaDocRef = doc(historiasRef);
    const historiaId = historiaDocRef.id;

    const basePath = `historias/${uid}/${historiaId}`;
    const mediaPath = tipo === 'video' ? `${basePath}/video.mp4` : `${basePath}/image.jpg`;
    const thumbnailPath = thumbnailUri ? `${basePath}/thumbnail.jpg` : null;
    let ultimoPctPersistido = -1;

    const persistirProgreso = (pct, fase) => {
      if (!historiaDocRef) return;

      const progresoNormalizado = Math.max(0, Math.min(99, Math.round(Number(pct) || 0)));
      const saltoMinimo = 4;
      const esPasoRelevante =
        progresoNormalizado >= 99 ||
        ultimoPctPersistido < 0 ||
        progresoNormalizado - ultimoPctPersistido >= saltoMinimo;

      if (!esPasoRelevante) return;

      ultimoPctPersistido = progresoNormalizado;
      updateDoc(historiaDocRef, {
        uploadProgress: progresoNormalizado,
        uploadPhase: fase || 'subiendo',
      }).catch(() => {
        // No bloqueamos la subida por una actualizacion visual de progreso.
      });
    };

    await ejecutarConReintento(() => setDoc(historiaDocRef, {
      historiaId,
      userId: uid,
      tipo,
      status: 'uploading',
      uploadProgress: 0,
      uploadPhase: 'preparando',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      url: null,
      thumbnailUrl: null,
      storagePath: mediaPath,
      thumbnailPath,
      fileSizeBytes,
      duracionMs,
      width,
      height,
    }));

    const mediaUrl = await ejecutarConReintento(() => subirArchivoConRuta(uri, tipo, mediaPath, (bytes, total) => {
      if (typeof onProgress === 'function') {
        const pct = total > 0 ? Math.round((bytes / total) * 80) : 0;
        persistirProgreso(pct, 'subiendo-media');
        onProgress({
          fase: 'subiendo-media',
          progreso: Math.max(1, pct),
        });
      }
    }));

    let thumbnailUrl = null;
    if (thumbnailUri && thumbnailPath) {
      thumbnailUrl = await ejecutarConReintento(() => subirArchivoConRuta(thumbnailUri, 'foto', thumbnailPath, (bytes, total) => {
        if (typeof onProgress === 'function') {
          const pctThumb = total > 0 ? Math.round((bytes / total) * 20) : 0;
          persistirProgreso(80 + pctThumb, 'subiendo-thumbnail');
          onProgress({
            fase: 'subiendo-thumbnail',
            progreso: 80 + pctThumb,
          });
        }
      }));
    }

    await ejecutarConReintento(() => updateDoc(historiaDocRef, {
      status: 'ready',
      uploadProgress: 100,
      uploadPhase: 'completado',
      url: mediaUrl,
      thumbnailUrl,
      updatedAt: serverTimestamp(),
    }));

    if (typeof onProgress === 'function') {
      onProgress({
        fase: 'completado',
        progreso: 100,
      });
    }

    return { historiaId, mediaUrl, thumbnailUrl };
  } catch (error) {
    if (historiaDocRef) {
      try {
        await ejecutarConReintento(() => updateDoc(historiaDocRef, {
          status: 'error',
          uploadPhase: 'error',
          updatedAt: serverTimestamp(),
          errorMessage: error?.message || 'Error desconocido subiendo historia',
        }), { maxIntentos: 2, esperaBaseMs: 250 });
      } catch {
        // Si falla la escritura de estado no bloqueamos el error principal.
      }
    }

    console.error('❌ Error en subirHistoriaAFirebase:', error);
    throw error;
  }
};

export const subirPostTextoAFirebase = async ({ texto = '' }) => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Debes iniciar sesion para publicar un post.');
  }

  const textoLimpio = (texto || '').trim();
  if (!textoLimpio) {
    throw new Error('El post no puede estar vacio.');
  }

  const postsRef = collection(db, 'posts');
  const postDocRef = doc(postsRef);
  const postId = postDocRef.id;

  // Intentamos obtener el nombre del usuario
  let userNombre = 'Usuario';
  try {
      const userDoc = await getDoc(doc(db, 'usuarios', uid));
      if (userDoc.exists()) {
          userNombre = userDoc.data().nombre || 'Usuario';
      }
  } catch (e) {
      console.log('Error obteniendo nombre para post texto:', e);
  }

  await setDoc(postDocRef, {
    postId,
    userId: uid,
    userName: userNombre,
    tipo: 'texto',
    texto: textoLimpio,
    status: 'ready',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    url: null,
    thumbnailUrl: null,
    storagePath: null,
    thumbnailPath: null,
    fileSizeBytes: null,
    duracionMs: null,
    width: null,
    height: null,
  });

  return { postId };
};

export const escucharPostsMuro = (onData, onError) => {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(20));

  return onSnapshot(
    q,
    (snapshot) => {
      const posts = snapshot.docs
        .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
        .filter((post) => post.status !== 'error');

      onData(posts);
    },
    (error) => {
      if (typeof onError === 'function') {
        onError(error);
      }
    }
  );
};

export const escucharHistoriasCirculos = (onData, onError) => {
  const q = query(collection(db, 'historias'), orderBy('createdAt', 'desc'), limit(80));

  return onSnapshot(
    q,
    (snapshot) => {
      const historias = snapshot.docs
        .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
        .filter((historia) => historia?.status !== 'error' && !!historia?.userId);

      const mapaPorUsuario = new Map();
      for (const historia of historias) {
        if (!mapaPorUsuario.has(historia.userId)) {
          mapaPorUsuario.set(historia.userId, historia);
        }
      }

      onData(Array.from(mapaPorUsuario.values()));
    },
    (error) => {
      if (typeof onError === 'function') {
        onError(error);
      }
    }
  );
};

export const actualizarPerfilUsuario = async ({ nombre, bio, fotoUri }) => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuario no autenticado');

  let fotoUrl = fotoUri;
  // Si la foto es una ruta local, la subimos a Storage
  if (fotoUri && fotoUri.startsWith('file://')) {
    const path = `perfiles/${uid}/foto_perfil.jpg`;
    fotoUrl = await subirArchivoConRuta(fotoUri, 'foto', path);
  }

  const userRef = doc(db, 'usuarios', uid);
  await setDoc(userRef, {
    nombre,
    bio,
    fotoUrl,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return { nombre, bio, fotoUrl };
};

export const obtenerPerfilUsuario = (uid, callback) => {
  if (!uid) return () => {};
  const userRef = doc(db, 'usuarios', uid);
  return onSnapshot(userRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ uid: snapshot.id, ...snapshot.data() });
    } else {
      callback(null);
    }
  });
};
