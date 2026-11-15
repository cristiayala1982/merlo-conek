import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { subirArchivoConRuta, borrarArchivoPorUrl } from './storageService';
import { crearNotificacion } from './notificationService';

/**
 * Obtiene el perfil de un usuario y escucha cambios en tiempo real.
 */
export const obtenerPerfilUsuario = (uid, callback) => {
  if (!uid) return () => {};
  return onSnapshot(doc(db, 'usuarios', uid), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data.fotoUrl && data.fotoUrl.startsWith('file://')) data.fotoUrl = null;
      if (data.portadaUrl && data.portadaUrl.startsWith('file://')) data.portadaUrl = null;
      callback({ id: snap.id, ...data });
    } else {
      // Intento de compatibilidad con ruta vieja 'users'
      getDoc(doc(db, 'users', uid)).then(s => {
        if (s.exists()) {
          const d = s.data();
          if (d.fotoUrl && d.fotoUrl.startsWith('file://')) d.fotoUrl = null;
          callback({ id: s.id, ...d });
        } else {
          callback(null);
        }
      }).catch(() => callback(null));
    }
  });
};

/**
 * Actualiza los datos del perfil, incluyendo subida de imágenes si son locales.
 * Limpia automáticamente las imágenes antiguas para evitar basura en el storage.
 */
export const actualizarPerfilUsuario = async (datos) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const updateData = { ...datos, updatedAt: serverTimestamp() };
  const esLocalUri = (uri) => uri && (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://') || !uri.startsWith('http'));

  // Obtenemos los datos actuales para saber si hay que borrar fotos viejas
  const userDoc = await getDoc(doc(db, 'usuarios', uid));
  const userData = userDoc.exists() ? userDoc.data() : null;

  if (datos.fotoUri && esLocalUri(datos.fotoUri)) {
    // Si hay una foto nueva local, la subimos
    updateData.fotoUrl = await subirArchivoConRuta(datos.fotoUri, 'foto', `perfiles/${uid}/foto_${Date.now()}.jpg`);
    // Y borramos la vieja si existía (y era de firebase storage)
    if (userData?.fotoUrl) {
       await borrarArchivoPorUrl(userData.fotoUrl).catch(e => console.log('Error borrando foto vieja:', e));
    }
  }

  if (datos.portadaUri && esLocalUri(datos.portadaUri)) {
    updateData.portadaUrl = await subirArchivoConRuta(datos.portadaUri, 'foto', `perfiles/${uid}/portada_${Date.now()}.jpg`);
    if (userData?.portadaUrl) {
       await borrarArchivoPorUrl(userData.portadaUrl).catch(e => console.log('Error borrando portada vieja:', e));
    }
  }

  delete updateData.fotoUri;
  delete updateData.portadaUri;

  await setDoc(doc(db, 'usuarios', uid), updateData, { merge: true });
};

/**
 * Busca usuarios por nombre, excluyendo bloqueados y a uno mismo.
 */
export const buscarUsuarios = (termino, callback) => {
  const miUid = auth.currentUser?.uid;
  const q = query(collection(db, 'usuarios'), limit(50));

  return onSnapshot(q, (snap) => {
    getDoc(doc(db, 'usuarios', miUid)).then(uSnap => {
      const misBloqueados = uSnap.data()?.bloqueados || [];

      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => {
          const coincide = !termino || u.nombre?.toLowerCase().includes(termino.toLowerCase());
          const yoLoBloquee = misBloqueados.includes(u.id);
          const elMeBloqueo = u.bloqueados?.includes(miUid);
          const noSoyYo = u.id !== miUid;

          return coincide && !yoLoBloquee && !elMeBloqueo && noSoyYo;
        });

      callback(lista);
    });
  });
};

/**
 * Actualiza el estado de conexión del usuario.
 */
export const actualizarEstadoOnline = async (uid, isOnline) => {
  if (uid) await setDoc(doc(db, 'usuarios', uid), { online: isOnline, ultimaVez: serverTimestamp() }, { merge: true });
};

/**
 * Bloquea a un usuario y lo elimina de la lista de seguidos.
 */
export const bloquearUsuario = async (targetUid) => {
  const miUid = auth.currentUser?.uid;
  if (miUid) {
    await updateDoc(doc(db, 'usuarios', miUid), { bloqueados: arrayUnion(targetUid) });
    await dejarDeSeguirUsuario(targetUid);
  }
};

/**
 * Desbloquea a un usuario.
 */
export const desbloquearUsuario = async (targetUid) => {
  const miUid = auth.currentUser?.uid;
  if (miUid) await updateDoc(doc(db, 'usuarios', miUid), { bloqueados: arrayRemove(targetUid) });
};

// --- AMISTAD / SEGUIDORES ---

export const enviarSolicitudAmistad = async (targetUid) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid) return;
  const relId = miUid < targetUid ? `${miUid}_${targetUid}` : `${targetUid}_${miUid}`;
  await setDoc(doc(db, 'solicitudes', relId), { deUid: miUid, paraUid: targetUid, status: 'pendiente', createdAt: serverTimestamp() });

  try {
    await crearNotificacion({
      paraUserId: targetUid,
      tipo: 'solicitud_amistad',
      texto: 'te envió una solicitud de amistad'
    });
  } catch (e) {
    console.error('Error enviando notificación de solicitud:', e);
  }
};

export const escucharEstadoAmistad = (targetUid, callback) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid || !targetUid) return () => {};
  const relId = miUid < targetUid ? `${miUid}_${targetUid}` : `${targetUid}_${miUid}`;
  return onSnapshot(doc(db, 'solicitudes', relId), (snap) => callback(snap.exists() ? snap.data() : null));
};

export const aceptarSolicitudAmistad = async (notifId, deUserId) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid) return;
  const relId = miUid < deUserId ? `${miUid}_${deUserId}` : `${deUserId}_${miUid}`;
  await updateDoc(doc(db, 'solicitudes', relId), { status: 'aceptada' });
  await updateDoc(doc(db, 'usuarios', miUid), { siguiendo: arrayUnion(deUserId) });
  await updateDoc(doc(db, 'usuarios', deUserId), { siguiendo: arrayUnion(miUid) });

  // Actualizar la notificación local del usuario receptor para reflejar que ya se aceptó
  if (notifId) {
    try {
      await updateDoc(doc(db, 'usuarios', miUid, 'notificaciones', notifId), {
        tipo: 'amigo',
        texto: 'ahora es tu amigo/a',
        leido: true
      });
    } catch (e) {
      console.log('Error actualizando notificación local al aceptar:', e);
    }
  }

  try {
    await crearNotificacion({
      paraUserId: deUserId,
      tipo: 'amigo',
      texto: 'aceptó tu solicitud de amistad'
    });
  } catch (e) {
    console.error('Error enviando notificación de amistad aceptada:', e);
  }
};

export const dejarDeSeguirUsuario = async (targetUid) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid) return;
  const relId = miUid < targetUid ? `${miUid}_${targetUid}` : `${targetUid}_${miUid}`;
  await deleteDoc(doc(db, 'solicitudes', relId));
  await updateDoc(doc(db, 'usuarios', miUid), { siguiendo: arrayRemove(targetUid) });
  await updateDoc(doc(db, 'usuarios', deUserId || targetUid), { siguiendo: arrayRemove(miUid) });
};

export const rechazarSolicitudAmistad = dejarDeSeguirUsuario;

/**
 * Marca una sección de la comunidad (alertas, general, clasificados) como vista.
 */
export const marcarSeccionComunidadVista = async (seccion) => {
  const uid = auth.currentUser?.uid;
  if (!uid || !seccion) return;
  try {
    const campo = `lastCheck_${seccion}`;
    await updateDoc(doc(db, 'usuarios', uid), {
      [campo]: serverTimestamp()
    });
  } catch (e) {
    console.error(`Error al marcar sección ${seccion} como vista:`, e);
  }
};

/**
 * Limpia todas las publicaciones, alertas, productos, mascotas, historias y fotos en R2/Storage asociadas a un usuario.
 */
const limpiarContenidosUsuario = async (uid) => {
  if (!uid) return;

  const colecciones = [
    { name: 'posts', userKey: 'userId' },
    { name: 'alertas_comunitarias', userKey: 'userId' },
    { name: 'productos_market', userKey: 'vendedorId' },
    { name: 'clasificados', userKey: 'userId' },
    { name: 'mascotas', userKey: 'userId' },
    { name: 'historias', userKey: 'userId' },
    { name: 'desafios', userKey: 'deId' },
    { name: 'desafios', userKey: 'paraId' },
  ];

  for (const item of colecciones) {
    try {
      const q = query(collection(db, item.name), where(item.userKey, '==', uid));
      const snap = await getDocs(q);

      for (const docSnap of snap.docs) {
        const data = docSnap.data();

        // 1. Borrar fotos/videos principales
        if (data.url) await borrarArchivoPorUrl(data.url).catch(() => {});
        if (data.thumbnailUrl) await borrarArchivoPorUrl(data.thumbnailUrl).catch(() => {});
        if (data.thumbnailLqUrl) await borrarArchivoPorUrl(data.thumbnailLqUrl).catch(() => {});

        // 2. Borrar array de fotos (en productos de marketplace o clasificados)
        if (Array.isArray(data.fotos)) {
          for (const fotoUrl of data.fotos) {
            if (fotoUrl) await borrarArchivoPorUrl(fotoUrl).catch(() => {});
          }
        }

        // 3. Borrar el documento de Firestore
        await deleteDoc(doc(db, item.name, docSnap.id)).catch(() => {});
      }
    } catch (e) {
      console.log(`[Limpieza] Error al limpiar colección ${item.name}:`, e);
    }
  }

  // 4. Borrar fotos de perfil y portada del usuario
  try {
    const uSnap = await getDoc(doc(db, 'usuarios', uid));
    if (uSnap.exists()) {
      const uData = uSnap.data();
      if (uData.fotoUrl) await borrarArchivoPorUrl(uData.fotoUrl).catch(() => {});
      if (uData.portadaUrl) await borrarArchivoPorUrl(uData.portadaUrl).catch(() => {});
    }
  } catch (e) {}
};

/**
 * Elimina la cuenta del usuario actual de Authentication y de la base de datos (usuarios),
 * limpiando previamente todas sus publicaciones, fotos y videos de Cloudflare R2 / Storage.
 */
export const eliminarCuentaUsuario = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("No hay usuario autenticado.");

  const uid = user.uid;

  // VERIFICACIÓN PREVENTIVA DE SEGURIDAD
  // Comprobamos la antigüedad del último inicio de sesión ANTES de borrar 1 solo dato.
  // Firebase Auth exige un inicio de sesión de menos de 5 minutos (300.000 ms).
  // Usamos un margen seguro de 4 minutos (240.000 ms).
  const lastSignInTime = user.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).getTime() : 0;
  const now = Date.now();
  const cuatroMinutosMs = 4 * 60 * 1000;

  if (now - lastSignInTime > cuatroMinutosMs) {
    console.log("⚠️ [Seguridad] Sesión no reciente. Se detiene el proceso sin borrar ningún dato.");
    return { success: false, code: 'requires-recent-login' };
  }

  try {
    // 0. Limpieza total en cascada de publicaciones, fotos en R2 y contenidos
    await limpiarContenidosUsuario(uid);

    // 1. Borrar documento de usuario de Firestore
    await deleteDoc(doc(db, 'usuarios', uid));

    // 2. Borrar cuenta de Authentication
    await user.delete();

    return { success: true };
  } catch (error) {
    console.error("Error al eliminar cuenta:", error);
    // Si Firebase requiere reautenticación, enviará este error específico
    if (error.code === 'auth/requires-recent-login') {
      return { success: false, code: 'requires-recent-login' };
    }
    return { success: false, code: error.code || 'unknown' };
  }
};
