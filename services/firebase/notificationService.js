import { addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

/**
 * Crea una notificación para un usuario específico.
 */
export const crearNotificacion = async ({ paraUserId, tipo, postId = null, comentarioId = null, texto = '', collectionName = 'posts' }) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid || miUid === paraUserId) return;
  const userDoc = await getDoc(doc(db, 'usuarios', miUid));
  const userData = userDoc.exists() ? userDoc.data() : {};
  await addDoc(collection(db, 'usuarios', paraUserId, 'notificaciones'), {
    deUserId: miUid,
    deNombre: userData.nombre || 'Alguien',
    deFoto: userData.fotoUrl || null,
    tipo,
    postId,
    comentarioId,
    collectionName,
    texto,
    leido: false,
    createdAt: serverTimestamp()
  });
};

/**
 * Escucha las notificaciones del usuario actual.
 */
export const escucharNotificaciones = (uid, onData) => {
  if (!uid) return () => {};
  const q = query(collection(db, 'usuarios', uid, 'notificaciones'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
};

/**
 * Marca una notificación como leída.
 */
export const marcarNotificacionLeida = async (notifId) => {
  const uid = auth.currentUser?.uid;
  if (uid) await updateDoc(doc(db, 'usuarios', uid, 'notificaciones', notifId), { leido: true });
};

/**
 * Elimina una notificación.
 */
export const eliminarNotificacion = async (notifId) => {
  const uid = auth.currentUser?.uid;
  if (uid) await deleteDoc(doc(db, 'usuarios', uid, 'notificaciones', notifId));
};

/**
 * Marca una sección comunitaria (alertas, general, clasificados) como vista.
 */
export const marcarSeccionComunidadVista = async (seccion) => {
  const uid = auth.currentUser?.uid;
  if (!uid || !seccion) return;
  const campo = `lastCheck_${seccion}`;
  await updateDoc(doc(db, 'usuarios', uid), { [campo]: serverTimestamp() });
};
