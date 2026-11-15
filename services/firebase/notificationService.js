import { addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

/**
 * Crea una notificación en Firestore para el historial de la app.
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

  // DISPARAR NOTIFICACIÓN PUSH NATIVA
  try {
    const paraUserDoc = await getDoc(doc(db, 'usuarios', paraUserId));
    if (paraUserDoc.exists()) {
      const paraUserData = paraUserDoc.data();
      if (paraUserData.pushToken) {
        let pushTitle = 'Merlo Conek';
        let pushBody = texto;

        if (tipo === 'like') {
          pushTitle = '¡Nuevo Me Gusta! ❤️';
          pushBody = `${userData.nombre || 'Alguien'} le dio me gusta a tu publicación`;
        } else if (tipo === 'comentario') {
          pushTitle = 'Nuevo Comentario 💬';
          pushBody = `${userData.nombre || 'Alguien'} comentó: "${texto}"`;
        } else if (tipo === 'seguir') {
          pushTitle = 'Nuevo Seguidor 👤';
          pushBody = `${userData.nombre || 'Alguien'} ha comenzado a seguirte`;
        } else if (tipo === 'desafio') {
          pushTitle = '¡Desafío Espontáneo! ⚡';
          pushBody = `${userData.nombre || 'Alguien'} te desafió a una espontánea`;
        } else if (tipo === 'solicitud_amistad') {
          pushTitle = 'Solicitud de Amistad 👥';
          pushBody = `${userData.nombre || 'Alguien'} te envió una solicitud de amistad`;
        } else if (tipo === 'amigo' || tipo === 'aceptar_amistad') {
          pushTitle = '¡Solicitud Aceptada! 🎉';
          pushBody = `${userData.nombre || 'Alguien'} aceptó tu solicitud de amistad`;
        }

        enviarPushNotification(
          paraUserData.pushToken,
          pushTitle,
          pushBody,
          {
            type: 'social',
            tipoNotif: tipo,
            postId: postId,
            deUserId: miUid
          }
        );
      }
    }
  } catch (e) {
    console.log("Error enviando push social:", e);
  }
};

export const crearNotificacionModeracion = async ({ paraUserId, tipo, postId, collectionName = 'posts', texto }) => {
  if (!paraUserId || !postId) return;

  await addDoc(collection(db, 'usuarios', paraUserId, 'notificaciones'), {
    deUserId: auth.currentUser?.uid || 'moderacion',
    deNombre: 'Moderación Merlo Conek',
    deFoto: null,
    tipo,
    postId,
    collectionName,
    texto,
    leido: false,
    createdAt: serverTimestamp()
  });

  try {
    const userSnap = await getDoc(doc(db, 'usuarios', paraUserId));
    const pushToken = userSnap.exists() ? userSnap.data().pushToken : null;
    if (pushToken) {
      await enviarPushNotification(pushToken, 'Moderación Merlo Conek', texto, {
        type: 'social',
        tipoNotif: tipo,
        postId,
        collectionName,
        deUserId: 'moderacion'
      });
    }
  } catch (error) {
    console.error('Error enviando push de moderación:', error);
  }
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
 * Guarda el token de notificaciones push en el perfil del usuario.
 */
export const guardarPushToken = async (uid, token) => {
  if (!uid || !token) return;
  try {
    await updateDoc(doc(db, 'usuarios', uid), {
      pushToken: token
    });
  } catch (e) {
    console.error("Error guardando push token:", e);
  }
};

/**
 * Envía una notificación push de "SOLO DATOS" optimizada para el motor Kotlin.
 * Ahora incluye la foto del remitente para el modo Premium.
 */
export const enviarPushNotification = async (expoPushToken, title, body, data = {}) => {
  if (!expoPushToken) return;

  const miUid = auth.currentUser?.uid;
  let fotoUrl = null;

  // Intentar obtener la foto de quien envía para mostrarla en el círculo
  if (miUid) {
    try {
      const uSnap = await getDoc(doc(db, 'usuarios', miUid));
      if (uSnap.exists()) {
        fotoUrl = uSnap.data().fotoUrl || null;
      }
    } catch (e) {}
  }

  console.log(`🚀 [PUSH] Enviando a: ${expoPushToken.substring(0, 20)}... | Tipo: ${data.type || 'chat'}`);

  const message = {
    to: expoPushToken,
    data: {
      title: title, // Nombre del remitente o título social
      body: body,   // Mensaje (ej: "🎤 Audio" o comentario)
      chatId: data.chatId || 'default',
      deUserId: miUid || data.deUserId || '',
      deFoto: fotoUrl || '', // Foto del perfil para Kotlin
      type: data.type || 'chat', // 'chat' o 'social'
      tipoMensaje: data.tipoMensaje || 'texto', // Específico de chat (audio, foto, etc)
      chatTipo: data.tipo || 'regular', // Identificar si es 'market'
      productId: data.productId || '',
      tipoNotif: data.tipoNotif || '', // Específico de social (like, comentario)
      postId: data.postId || ''
    },
    priority: 'high',
    android: {
      priority: 'high'
    }
  };

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    console.log("✅ [PUSH] Orden enviada");
  } catch (e) {
    console.error("❌ [PUSH] Error:", e);
  }
};
