import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { subirArchivoConRuta } from './storageService';

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
 */
export const actualizarPerfilUsuario = async (datos) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const updateData = { ...datos, updatedAt: serverTimestamp() };

  if (datos.fotoUri?.startsWith('file://')) {
    updateData.fotoUrl = await subirArchivoConRuta(datos.fotoUri, 'foto', `perfiles/${uid}/foto.jpg`);
  }
  if (datos.portadaUri?.startsWith('file://')) {
    updateData.portadaUrl = await subirArchivoConRuta(datos.portadaUri, 'foto', `perfiles/${uid}/portada.jpg`);
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
  // Nota: crearNotificacion se manejará en el módulo de notificaciones
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
};

export const dejarDeSeguirUsuario = async (targetUid) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid) return;
  const relId = miUid < targetUid ? `${miUid}_${targetUid}` : `${targetUid}_${miUid}`;
  await deleteDoc(doc(db, 'solicitudes', relId));
  await updateDoc(doc(db, 'usuarios', miUid), { siguiendo: arrayRemove(targetUid) });
  await updateDoc(doc(db, 'usuarios', targetUid), { siguiendo: arrayRemove(miUid) });
};
