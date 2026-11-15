import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { subirArchivoConRuta, borrarArchivoPorUrl } from './storageService';
import { enviarPushNotification } from './notificationService';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Envía un mensaje de chat y actualiza la metadata de la conversación.
 */
export const enviarMensajeChat = async ({ chatId, paraUserId, texto, tipo = 'texto', media = null, coords = null, replyTo = null, storyContext = null, clientSideId = null, extraData = {} }) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid || !paraUserId) return;

  // Generar chatId si no viene (red de seguridad)
  let finalChatId = chatId;
  if (!finalChatId) {
    finalChatId = miUid < paraUserId ? `${miUid}_${paraUserId}` : `${paraUserId}_${miUid}`;
  }

  const userDoc = await getDoc(doc(db, 'usuarios', miUid));
  const userData = userDoc.exists() ? userDoc.data() : {};

  const mensajeData = {
    chatId: finalChatId,
    userId: miUid,
    user: userData.nombre || 'Usuario',
    userPhoto: userData.fotoUrl || null,
    text: texto || '',
    url: media?.url || null,
    thumbnailUrl: media?.thumbnailUrl || null,
    duracionMs: media?.duracionMs || null,
    coords: coords || media?.coords || extraData?.coords || null,
    tipo: tipo !== 'texto' ? tipo : (media?.tipo || (storyContext ? 'historia_reply' : 'texto')),
    leido: false,
    createdAt: serverTimestamp(),
    replyTo: replyTo || null,
    clientSideId: clientSideId // Para sincronizar con el estado optimista de la UI
  };

  if (storyContext) {
    mensajeData.storyContext = {
      storyId: storyContext.id || storyContext.storyId || '',
      storyThumbnail: storyContext.thumbnailUrl || storyContext.url || '',
      tipo_accion: storyContext.tipo_accion || 'reply'
    };
  }

  await addDoc(collection(db, 'mensajes_chat'), mensajeData);

  // Actualizar metadata del chat
  let ultimoMensajeTexto = texto || '';
  if (storyContext) {
    ultimoMensajeTexto = storyContext.tipo_accion === 'like' ? '❤️ Reaccionó a tu historia' : `Respondió a tu historia: ${texto}`;
  } else if (replyTo) {
    const previewTexto = texto || (media?.tipo === 'audio' ? 'Audio' : (media?.tipo === 'video' ? 'Video' : 'Foto'));
    ultimoMensajeTexto = `Respondió a tu mensaje: ${previewTexto}`;
  } else if (!texto) {
    const tipoReal = media?.tipo || tipo;
    if (tipoReal === 'audio') ultimoMensajeTexto = '🎤 Audio';
    else if (tipoReal === 'video') ultimoMensajeTexto = '🎥 Video';
    else if (tipoReal === 'foto') ultimoMensajeTexto = '📷 Foto';
    else if (tipoReal === 'ubicacion') ultimoMensajeTexto = '📍 Ubicación';
  }

  await actualizarMetadataChat(finalChatId, paraUserId, ultimoMensajeTexto, true, extraData);

  // DISPARAR NOTIFICACIÓN PUSH
  try {
    const receiverDoc = await getDoc(doc(db, 'usuarios', paraUserId));
    if (receiverDoc.exists()) {
      const receiverData = receiverDoc.data();
      if (receiverData.pushToken) {
        enviarPushNotification(
          receiverData.pushToken,
          userData.nombre || 'Nuevo Mensaje',
          ultimoMensajeTexto,
          {
            chatId: finalChatId,
            deUserId: miUid,
            type: 'chat',
            tipoMensaje: replyTo ? 'respuesta' : tipo, // Identificamos si es respuesta
            ...extraData // Incluimos tipo: 'market' y productId si existen
          }
        );
      }
    }
  } catch (e) {
    console.log("Error al intentar enviar push:", e);
  }
};

/**
 * Actualiza la metadata global de una conversación (último mensaje, contadores, perfiles).
 */
export const actualizarMetadataChat = async (chatId, otroId, ultimoMsg, esEnvio = false, extraData = {}) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid || !otroId) return;

  const chatRef = doc(db, 'chats', chatId);

  // Obtenemos perfiles para asegurar que la lista de chats tenga info fresca
  const miSnap = await getDoc(doc(db, 'usuarios', miUid));
  const otroSnap = await getDoc(doc(db, 'usuarios', otroId));

  const miPerfil = miSnap.exists() ? miSnap.data() : {};
  const otroPerfil = otroSnap.exists() ? otroSnap.data() : {};

  const updateData = {
    ultimoMensaje: ultimoMsg,
    fechaUltimoMensaje: serverTimestamp(),
    ultimoMensajeDe: miUid,
    participantes: [miUid, otroId],
    tipo: extraData.tipo || 'regular',
    ...extraData
  };

  // Guardamos nombres y fotos en el documento del chat para que la lista cargue rápido
  updateData[`${miUid}`] = {
    nombre: miPerfil.nombre || 'Usuario',
    foto: miPerfil.fotoUrl || null,
    eliminadoPara: false
  };
  updateData[`${otroId}`] = {
    nombre: otroPerfil.nombre || 'Usuario',
    foto: otroPerfil.fotoUrl || null,
    eliminadoPara: false
  };

  if (esEnvio) {
    updateData[`${otroId}`].unreadCount = increment(1);
  }

  try {
    const snap = await getDoc(chatRef);
    if (!snap.exists()) {
      updateData.chatId = chatId;
      updateData[`${miUid}`].unreadCount = 0;
    } else {
      // Preservar estado anterior de unreadCount si existe
      const existingData = snap.data();
      if (existingData[miUid]?.unreadCount !== undefined) {
          updateData[`${miUid}`].unreadCount = existingData[miUid].unreadCount;
      }
      if (!esEnvio && existingData[otroId]?.unreadCount !== undefined) {
          updateData[`${otroId}`].unreadCount = existingData[otroId].unreadCount;
      }
    }
    await setDoc(chatRef, updateData, { merge: true });
  } catch (e) { console.error("Error actualizarMetadataChat:", e); }
};

/**
 * Marca como leídos todos los mensajes recibidos en un chat.
 */
export const marcarMensajesComoLeidos = async (mensajes, miUid) => {
  const batch = writeBatch(db);
  let hayCambios = false;
  mensajes.forEach(m => {
    if (m.userId !== miUid && !m.leido) {
      batch.update(doc(db, 'mensajes_chat', m.id), { leido: true });
      hayCambios = true;
    }
  });
  if (hayCambios) await batch.commit();
};

/**
 * Actualiza el estado de "escribiendo" o "grabando" en el chat.
 */
export const actualizarEstadoEscribiendo = async (chatId, miUid, status) => {
  if (!chatId || !miUid) return;
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`${miUid}.status`]: status || null
    }).catch(async () => {
      await setDoc(chatRef, {
        [miUid]: { status: status || null }
      }, { merge: true });
    });
  } catch (e) {}
};

/**
 * Destruye de forma definitiva todos los mensajes de una conversación y borra sus archivos de Cloudflare R2.
 */
export const borrarMensajesDeChat = async (chatId) => {
  if (!chatId) return;
  try {
    const q = query(collection(db, 'mensajes_chat'), where('chatId', '==', chatId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      for (const docSnap of snap.docs) {
        const msgData = docSnap.data();
        if (msgData.url) await borrarArchivoPorUrl(msgData.url).catch(() => {});
        if (msgData.thumbnailUrl) await borrarArchivoPorUrl(msgData.thumbnailUrl).catch(() => {});

        // Borrar nota de voz del disco local si existe
        try {
          const audioPath = `${FileSystem.cacheDirectory}chat-audios/${docSnap.id}.m4a`;
          await FileSystem.deleteAsync(audioPath, { idempotent: true });
        } catch (eFs) {}

        batch.delete(docSnap.ref);
      }
      await batch.commit();
      console.log(`[CHAT] Destruidos ${snap.size} mensajes, archivos R2 y caché local de audio para chatId: ${chatId}`);
    }
  } catch (e) {
    console.log("Error al borrar mensajes de chat:", e);
  }
};

/**
 * Borra una conversación para el usuario actual.
 */
export const eliminarChat = async (chatId, miUid) => {
  if (!chatId || !miUid) return;
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`${miUid}.eliminadoPara`]: true,
      [`${miUid}.ultimoVaciado`]: serverTimestamp()
    });

    // Comprobar si AMBOS participantes lo eliminaron para destruir la conversación y todos sus mensajes
    const snap = await getDoc(chatRef);
    if (snap.exists()) {
      const data = snap.data();
      const participantes = data.participantes || [];
      const otroId = participantes.find(id => id !== miUid);

      if (otroId && data[otroId]?.eliminadoPara === true) {
        console.log("Destruyendo sala, mensajes y multimedia porque ambos usuarios eliminaron la conversación:", chatId);
        // 1. Quemar todas las cartas (mensajes) y archivos en R2
        await borrarMensajesDeChat(chatId);
        // 2. Destruir el buzón principal (chats)
        await deleteDoc(chatRef);
      }
    }
  } catch (e) {
    console.log("Error al eliminar chat:", e);
  }
};

/**
 * Vacía los mensajes de un chat para el usuario actual (usando timestamp).
 */
export const vaciarChat = async (chatId, miUid) => {
  if (!chatId || !miUid) return;
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      [`${miUid}.ultimoVaciado`]: serverTimestamp()
    });
  } catch (e) {
    console.log("Error al vaciar chat:", e);
  }
};

/**
 * Elimina un mensaje individual solo para el usuario actual.
 */
export const eliminarMensajeParaMi = async (msgId, miUid) => {
  await updateDoc(doc(db, 'mensajes_chat', msgId), { borradoPara: arrayUnion(miUid) });
};

/**
 * Elimina un mensaje para todos los participantes.
 */
export const eliminarMensajeParaTodos = async (msgId) => {
  await updateDoc(doc(db, 'mensajes_chat', msgId), {
    deletedForAll: true,
    text: 'Este mensaje fue eliminado',
    url: null,
    thumbnailUrl: null,
    duracionMs: null,
    reacciones: {}
  });
};

/**
 * Gestiona las reacciones (emojis) en un mensaje.
 */
export const gestionarReaccionMensaje = async (msg, emoji, miUid) => {
  const reaccionesActuales = msg.reacciones || {};
  const usuariosConEsteEmoji = reaccionesActuales[emoji] || [];
  let nuevasReacciones = { ...reaccionesActuales };

  if (usuariosConEsteEmoji.includes(miUid)) {
    nuevasReacciones[emoji] = usuariosConEsteEmoji.filter(id => id !== miUid);
    if (nuevasReacciones[emoji].length === 0) delete nuevasReacciones[emoji];
  } else {
    // Quitar mi reacción de otros emojis (estilo WhatsApp)
    Object.keys(nuevasReacciones).forEach(key => {
      nuevasReacciones[key] = nuevasReacciones[key].filter(id => id !== miUid);
      if (nuevasReacciones[key].length === 0) delete nuevasReacciones[key];
    });
    nuevasReacciones[emoji] = [...(nuevasReacciones[emoji] || []), miUid];
  }

  await updateDoc(doc(db, 'mensajes_chat', msg.id), { reacciones: nuevasReacciones });

  const seAgrego = !usuariosConEsteEmoji.includes(miUid);

  if (seAgrego) {
    const textoReaccion = `${emoji} Reaccionó a tu mensaje`;
    console.log(`🚀 [REACCION] Preparando: ${textoReaccion}`);

    const participantes = msg.chatId.split('_');
    const otroId = participantes.find(id => id !== miUid && id !== 'market');

    // Detectar si el chat original es de Marketplace para pasar el contexto
    const esMarket = msg.chatId.endsWith('_market');
    const productId = esMarket ? msg.productId || '' : '';

    if (otroId) {
      console.log(`🚀 [REACCION] Actualizando metadata para la lista de chats`);
      await actualizarMetadataChat(msg.chatId, otroId, textoReaccion, true, esMarket ? { tipo: 'market', productId } : {});
    }

    try {
      const receiverId = msg.userId;
      console.log(`🚀 [REACCION] El receptor es: ${receiverId} | Yo soy: ${miUid}`);

      if (receiverId && receiverId !== miUid) {
        const receiverDoc = await getDoc(doc(db, 'usuarios', receiverId));
        if (receiverDoc.exists()) {
          const receiverData = receiverDoc.data();
          if (receiverData.pushToken) {
            const miDoc = await getDoc(doc(db, 'usuarios', miUid));
            const miNombre = miDoc.exists() ? miDoc.data().nombre : 'Alguien';

            console.log(`🚀 [REACCION] DISPARANDO PUSH REAL A ${receiverId}`);
            enviarPushNotification(
              receiverData.pushToken,
              miNombre,
              textoReaccion,
              {
                chatId: msg.chatId,
                deUserId: miUid,
                type: 'chat',
                tipoMensaje: 'reaccion',
                tipo: esMarket ? 'market' : 'regular', // IMPORTANTE PARA EL DEEP LINK
                productId: productId // IMPORTANTE PARA EL DEEP LINK
              }
            );
          } else {
            console.log(`⚠️ [REACCION] Receptor sin pushToken`);
          }
        }
      } else {
        console.log(`ℹ [REACCION] Auto-reacción, no se envía push`);
      }
    } catch (e) { console.log("❌ Error push reaccion:", e); }
  }

  return seAgrego; // retorna si se agregó
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
    if (onProgress) onProgress({ fase: 'subiendo-media', progreso: Math.round((trans / total) * 100) });
  });

  let thumbnailUrl = null;
  if (thumbnailUri) {
    thumbnailUrl = await subirArchivoConRuta(thumbnailUri, 'foto', `chats/media/${auth.currentUser.uid}/thumb_${Date.now()}.jpg`, (trans, total) => {
      if (onProgress) onProgress({ fase: 'subiendo-thumbnail', progreso: Math.round((trans / total) * 100) });
    });
  }
  return typeof params === 'string' ? mediaUrl : { mediaUrl, thumbnailUrl };
};
