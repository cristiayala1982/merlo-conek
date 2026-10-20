import { addDoc, collection, doc, getDoc, increment, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { subirArchivoConRuta } from './storageService';

/**
 * Envía un mensaje de chat y actualiza la metadata de la conversación.
 */
export const enviarMensajeChat = async ({ paraUserId, texto, media = null, storyContext = null }) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid || !paraUserId) return;
  const chatId = [miUid, paraUserId].sort().join('_');

  const userDoc = await getDoc(doc(db, 'usuarios', miUid));
  const userData = userDoc.exists() ? userDoc.data() : {};

  const mensajeData = {
    chatId,
    userId: miUid,
    user: userData.nombre || 'Usuario',
    userPhoto: userData.fotoUrl || null,
    text: texto || '',
    url: media?.url || null,
    tipo: media ? media.tipo : (storyContext ? 'historia_reply' : 'texto'),
    leido: false,
    createdAt: serverTimestamp()
  };

  if (storyContext) {
    mensajeData.storyContext = {
      storyId: storyContext.id || storyContext.storyId || '',
      storyThumbnail: storyContext.thumbnailUrl || storyContext.url || '',
      tipo_accion: storyContext.tipo_accion || 'reply'
    };
  }

  await addDoc(collection(db, 'mensajes_chat'), mensajeData);

  const chatRef = doc(db, 'chats', chatId);
  const ultimoMensajeTexto = storyContext
    ? (storyContext.tipo_accion === 'like' ? '❤️ Reaccionó a tu historia' : `Respondió a tu historia: ${texto}`)
    : (texto || (media?.tipo === 'audio' ? '🎤 Audio' : 'Archivo adjunto'));

  await setDoc(chatRef, {
    ultimoMensaje: ultimoMensajeTexto,
    fechaUltimoMensaje: serverTimestamp(),
    participantes: [miUid, paraUserId],
    [miUid]: {
      nombre: userData.nombre || 'Usuario',
      foto: userData.fotoUrl || null,
      eliminadoPara: false
    },
    [paraUserId]: {
      unreadCount: increment(1),
      eliminadoPara: false
    }
  }, { merge: true });
};

/**
 * Sube un archivo de audio para el chat.
 */
export const subirAudioChat = async (uri) => {
  return await subirArchivoConRuta(uri, 'audio', `chats/audios/${auth.currentUser.uid}/${Date.now()}.m4a`);
};

/**
 * Sube media (foto/video) para el chat.
 */
export const subirMediaChat = async (params) => {
  const { uri, tipo, thumbnailUri, onProgress } = typeof params === 'string' ? { uri: params, tipo: arguments[1] } : params;

  const ext = tipo === 'video' ? 'mp4' : 'jpg';
  const mediaUrl = await subirArchivoConRuta(uri, tipo, `chats/media/${auth.currentUser.uid}/${Date.now()}.${ext}`, (trans, total) => {
    if (onProgress) {
      const pct = Math.round((trans / total) * 100);
      onProgress({ fase: 'subiendo-media', progreso: pct });
    }
  });

  let thumbnailUrl = null;
  if (thumbnailUri) {
    thumbnailUrl = await subirArchivoConRuta(thumbnailUri, 'foto', `chats/media/${auth.currentUser.uid}/thumb_${Date.now()}.jpg`, (trans, total) => {
      if (onProgress) {
        const pct = Math.round((trans / total) * 100);
        onProgress({ fase: 'subiendo-thumbnail', progreso: pct });
      }
    });
  }

  return typeof params === 'string' ? mediaUrl : { mediaUrl, thumbnailUrl };
};
