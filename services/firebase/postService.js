import { addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { censurarTexto } from '../../utils/profanityFilter';
import { evaluarImagenSensible } from '../imageModerationService';
import { crearNotificacion, crearNotificacionModeracion } from './notificationService';
import { enviarReporte } from './reportService';
import { subirArchivoConRuta } from './storageService';

/**
 * Detecta menciones (@Nombre) en un texto y envía notificaciones a los usuarios mencionados.
 */
export const procesarMencionesEnTexto = async (texto, postId, collectionName = 'posts') => {
  if (!texto || typeof texto !== 'string') return;
  const miUid = auth.currentUser?.uid;
  if (!miUid) return;

  const menciones = texto.match(/@([^@\s]*)/g);
  if (!menciones || menciones.length === 0) return;

  for (const m of menciones) {
    const nombreLimpio = m.replace('@', '').trim();
    if (!nombreLimpio) continue;
    try {
      const q = query(collection(db, 'usuarios'), where('nombre', '==', nombreLimpio));
      const uSnap = await getDocs(q);
      if (!uSnap.empty) {
        const targetUid = uSnap.docs[0].id;
        if (targetUid !== miUid) {
          await crearNotificacion({
            paraUserId: targetUid,
            tipo: 'mencion',
            postId: postId,
            collectionName,
            texto: 'te mencionó en una publicación 🏷️'
          });
          console.log(`[MENCION] Notificación enviada a @${nombreLimpio}`);
        }
      }
    } catch (e) {
      console.error(`Error procesando mención para @${nombreLimpio}:`, e);
    }
  }
};

/**
 * Sube un post con media (foto/video) a Firestore.
 */
export const subirPostAFirebase = async ({ uri, tipo, thumbnailUri = null, uriModeracion = null, thumbnailLqUri = null, texto = '', textoSobreMedia = '', esEspontanea = false, desafioId = null, provincia = null, partido = null, localidad = null, barrio = null, onProgress = null }) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // 0. Evaluacion de Moderación de Imagen en la Nube
    let estadoModeracion = 'ready';
    let evaluacion = null;

    // Evaluamos 'uri' si es foto, o 'thumbnailUri' si es video (1 sola foto por post para cuidar la cuota)
    const uriParaEvaluar = (tipo === 'video') ? thumbnailUri : (uriModeracion || uri);

    if (uriParaEvaluar) {
      onProgress?.({ fase: 'evaluando-imagen', progreso: 5 });
      evaluacion = await evaluarImagenSensible(uriParaEvaluar);

      if (evaluacion.accion === 'BLOQUEAR') {
        console.warn('[Moderación] Contenido explícito detectado; se enviará a revisión manual.');
        estadoModeracion = 'pendiente_revision';
      }

      if (evaluacion.accion === 'PENDIENTE_REVISION') {
        estadoModeracion = 'pendiente_revision';
      }

      if (evaluacion.accion === 'ERROR') {
        estadoModeracion = 'pendiente_revision';
      }
    }

    const postDocRef = doc(collection(db, 'posts'));
    const userDoc = await getDoc(doc(db, 'usuarios', uid));
    const userData = userDoc.exists() ? userDoc.data() : {};

    // 1. Subir Media principal
    let mediaUrl = null;
    if (uri) {
      mediaUrl = await subirArchivoConRuta(uri, tipo, `posts/${uid}/${postDocRef.id}/media`, (trans, total) => {
        const pct = Math.round((trans / total) * 100);
        onProgress?.({ fase: 'subiendo-media', progreso: pct });
      });
    }

    // 2. Subir Thumbnail (Calidad media o frame de video)
    let thumbnailUrl = null;
    if (thumbnailUri) {
      thumbnailUrl = await subirArchivoConRuta(thumbnailUri, 'foto', `posts/${uid}/${postDocRef.id}/thumb`, (trans, total) => {
        const pct = Math.round((trans / total) * 100);
        onProgress?.({ fase: 'subiendo-thumbnail', progreso: pct });
      });
    }

    // 3. Subir Miniatura ultra-baja (LQ) para placeholder borroso
    let thumbnailLqUrl = null;
    if (thumbnailLqUri) {
        thumbnailLqUrl = await subirArchivoConRuta(thumbnailLqUri, 'foto', `posts/${uid}/${postDocRef.id}/thumb_lq`);
    }

    const postData = {
      postId: postDocRef.id,
      userId: uid,
      userName: userData.nombre || 'Usuario',
      userPhotoUrl: userData.fotoUrl || null,
      tipo,
      texto: censurarTexto(texto),
      textoSobreMedia: censurarTexto(textoSobreMedia),
      esEspontanea,
      desafioId,
      url: mediaUrl,
      thumbnailUrl: thumbnailUrl,
      thumbnailLqUrl: thumbnailLqUrl,
      provincia,
      partido,
      localidad,
      barrio,
      status: estadoModeracion,
      createdAt: serverTimestamp()
    };

    await setDoc(postDocRef, postData);

    // Procesar menciones (@Nombre) para notificar
    await procesarMencionesEnTexto(texto, postDocRef.id, 'posts');

    // Si la imagen fue clasificada como dudosa/sensible, enviar reporte automático para la app de administración
    if (estadoModeracion === 'pendiente_revision') {
      try {
        await enviarReporte({
          tipo: 'post_moderacion_automatica',
          idContenido: postDocRef.id,
          idAutor: uid,
          motivo: evaluacion?.accion === 'ERROR'
            ? 'No se pudo completar la moderación automática; requiere revisión manual'
            : evaluacion?.accion === 'BLOQUEAR'
              ? 'Contenido explícito detectado automáticamente; requiere revisión manual antes de resolver la publicación'
            : 'Imagen dudosa/sensible detectada automáticamente por moderación en la nube',
          extraData: {
            url: mediaUrl,
            thumbnailUrl: thumbnailUrl,
            puntajeSensibilidad: evaluacion?.puntaje || 0,
            detalles: evaluacion?.detalles || {},
            errorModeracion: evaluacion?.accion === 'ERROR' ? evaluacion.motivo : null
          }
        });
      } catch (errReporte) {
        console.error("Error al registrar reporte automático de moderación:", errReporte);
      }

      try {
        await crearNotificacionModeracion({
          paraUserId: uid,
          tipo: 'post_en_revision',
          postId: postDocRef.id,
          texto: 'Tu publicación está en revisión por nuestro equipo de moderación.'
        });
      } catch (errNotif) {
        console.error('Error al crear notificación de revisión:', errNotif);
      }
    }

    // NUEVO: Si es espontánea y está aprobada, duplicar en historias
    if (esEspontanea && estadoModeracion === 'ready') {
      await addDoc(collection(db, 'historias'), {
        userId: uid,
        userName: userData.nombre || 'Usuario',
        userPhotoUrl: userData.fotoUrl || null,
        tipo,
        texto,
        url: mediaUrl,
        thumbnailUrl: thumbnailUrl,
        thumbnailLqUrl: thumbnailLqUrl,
        esEspontanea: true,
        status: 'ready',
        createdAt: serverTimestamp()
      });
    }

    // NUEVO: Si viene de un desafío, completarlo y notificar
    if (desafioId && estadoModeracion === 'ready') {
      try {
        const desafioRef = doc(db, 'desafios', desafioId);
        const dSnap = await getDoc(desafioRef);
        if (dSnap.exists()) {
          const dData = dSnap.data();
          await updateDoc(desafioRef, { status: 'completed', postId: postDocRef.id });

          await crearNotificacion({
            paraUserId: dData.deId,
            tipo: 'desafio_completado',
            postId: postDocRef.id,
            texto: 'cumplió tu desafío'
          });
        }
      } catch (err) { console.log("Error actualizando desafío:", err); }
    }

    onProgress?.({ fase: 'completado', progreso: 100 });

    return {
      id: postDocRef.id,
      ...postData,
      status: estadoModeracion,
      mensajeModeracion: estadoModeracion === 'pendiente_revision'
        ? 'Tu publicación quedó en revisión y estará visible en el muro en cuanto sea aprobada.'
        : null
    };
  } catch (error) {
    console.error('Error general subiendo post:', error);
    throw error;
  }
};

/**
 * Sube un post de solo texto.
 */
export const subirPostTextoAFirebase = async ({ texto }) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const userDoc = await getDoc(doc(db, 'usuarios', uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const newRef = await addDoc(collection(db, 'posts'), {
      userId: uid, userName: userData.nombre || 'Usuario',
      userPhotoUrl: userData.fotoUrl || null, tipo: 'texto',
      texto: censurarTexto(texto), status: 'ready', createdAt: serverTimestamp()
    });
    await procesarMencionesEnTexto(texto, newRef.id, 'posts');
    return newRef.id;
  } catch (e) { console.error(e); throw e; }
};

/**
 * Escucha los posts del muro filtrando por seguidos y bloqueados.
 */
export const escucharPostsMuro = (onData) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid) {
    onData([]);
    return () => {};
  }

  let unsubPosts = null;

  const unsubUser = onSnapshot(doc(db, 'usuarios', miUid), (uSnap) => {
    if (unsubPosts) unsubPosts();

    // Si perdimos los permisos (ej. cerramos sesión justo ahora), cortamos
    if (!uSnap.exists()) {
      onData([]);
      return;
    }

    const dataMe = uSnap.data() || {};
    const siguiendo = dataMe.siguiendo || [];
    const bloqueados = dataMe.bloqueados || [];

    const filterIds = [miUid, ...siguiendo].filter(id => !bloqueados.includes(id)).slice(0, 30);

    // Si el usuario no tiene amigos y por alguna razón quedó un array vacío, forzamos su propio ID
    if (filterIds.length === 0) filterIds.push(miUid);

    const q = query(
      collection(db, 'posts'),
      where('userId', 'in', filterIds),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    unsubPosts = onSnapshot(q, (snap) => {
      const docs = snap.docs
        .map(d => {
          const data = d.data();
          if (data.url && data.url.startsWith('file://')) data.url = null;
          if (data.thumbnailUrl && data.thumbnailUrl.startsWith('file://')) data.thumbnailUrl = null;
          return { id: d.id, ...data };
        })
        .filter(p => !p.status || p.status === 'ready');
      onData(docs);
    }, (error) => {
      // Ignorar errores de permisos durante el logout silenciosamente
      if (error.code === 'permission-denied') return;
      console.log('Error en escucharPostsMuro:', error);
    });
  }, (error) => {
    if (error.code === 'permission-denied') return;
    console.log('Error en unsubUser de posts:', error);
  });

  return () => {
    unsubUser();
    if (unsubPosts) unsubPosts();
  };
};

/**
 * Escucha los posts de un usuario específico.
 */
export const escucharPostsUsuario = (userId, onData) => {
  if (!userId) return () => {};
  const q = query(collection(db, 'posts'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const docs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => !p.status || p.status === 'ready');
    onData(docs);
  });
};

/**
 * Actualiza el contenido de un post.
 */
export const actualizarPost = async (postId, nuevoTexto) => {
  await updateDoc(doc(db, 'posts', postId), { texto: censurarTexto(nuevoTexto), updatedAt: serverTimestamp() });
};

/**
 * Escucha los desafíos pendientes dirigidos al usuario actual.
 */
export const escucharDesafiosPendientes = (onData) => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    if (onData) onData(null);
    return () => {};
  }
  try {
    const q = query(
      collection(db, 'desafios'),
      where('paraId', '==', uid),
      where('status', '==', 'pending'),
      limit(1)
    );
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const docData = snap.docs[0].data();
        onData({ id: snap.docs[0].id, ...docData });
      } else {
        onData(null);
      }
    }, (err) => {
      console.error("Error escuchando desafíos pendientes:", err);
      if (onData) onData(null);
    });
  } catch (e) {
    console.error("Excepción en escucharDesafiosPendientes:", e);
    if (onData) onData(null);
    return () => {};
  }
};

/**
 * Responde un desafío (aceptar o rechazar).
 */
export const responderDesafio = async (desafioId, laAcepto) => {
  if (!desafioId) return;
  try {
    const dRef = doc(db, 'desafios', desafioId);
    if (laAcepto) {
      await updateDoc(dRef, { status: 'accepted' });
    } else {
      await updateDoc(dRef, { status: 'rejected' });
    }
  } catch (e) {
    console.error("Error al responder desafío:", e);
  }
};

/**
 * Lanza un desafío espontáneo a otro usuario.
 */
export const lanzarDesafioEspontaneo = async (paraUid) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid || !paraUid) return;

  const desafioRef = await addDoc(collection(db, 'desafios'), {
    deId: miUid,
    paraId: paraUid,
    status: 'pending',
    createdAt: serverTimestamp()
  });

  try {
    await crearNotificacion({
      paraUserId: paraUid,
      tipo: 'desafio',
      postId: desafioRef.id,
      texto: 'te desafió a una publicación espontánea ⚡'
    });
  } catch (e) {
    console.error('Error enviando notificación de desafío:', e);
  }

  return desafioRef.id;
};

/**
 * Borra un post y todos los documentos de su subcolección 'comentarios'.
 */
export const borrarPostConComentarios = async (postId, collectionName = 'posts') => {
  if (!postId) return;

  const comentariosRef = collection(db, collectionName, postId, 'comentarios');
  const postRef = doc(db, collectionName, postId);

  try {
    const snap = await getDocs(comentariosRef);

    // Si hay comentarios, los borramos en un batch
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      console.log(`Borrados ${snap.size} comentarios del post ${postId}`);
    }

    // Finalmente borramos el post principal
    await deleteDoc(postRef);
    console.log(`Post ${postId} eliminado de ${collectionName}`);

  } catch (error) {
    console.error(`Error borrando post con comentarios (${postId}):`, error);
    throw error;
  }
};

/**
 * Recompartes/Reposteas una publicación o alerta existente en tu propio muro o alertas.
 */
export const repostearContenido = async ({ postOriginal, comentario = '', collectionName = 'posts' }) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid || !postOriginal) return;

  const userDoc = await getDoc(doc(db, 'usuarios', miUid));
  const userData = userDoc.exists() ? userDoc.data() : {};

  // REGLA ANTI-CHOCLO (Aplanamiento a la Raíz):
  // Si el post a recompartir ya era un recompartido, viajamos directo a la publicación de raíz original
  const raizOriginal = (postOriginal.tipo === 'repost' && postOriginal.repostOriginal)
    ? postOriginal.repostOriginal
    : postOriginal;

  const idOriginal = raizOriginal.id || raizOriginal.postId;
  const autorOriginalId = raizOriginal.userId || raizOriginal.idAutor;

  const repostData = {
    userId: miUid,
    userName: userData.nombre || 'Usuario',
    userPhotoUrl: userData.fotoUrl || null,
    tipo: 'repost',
    texto: comentario.trim(),
    repostOriginal: {
      id: idOriginal,
      collectionName: raizOriginal.collectionName || collectionName,
      userId: autorOriginalId,
      userName: raizOriginal.userName || raizOriginal.user || 'Usuario',
      userPhotoUrl: raizOriginal.userPhotoUrl || raizOriginal.userPhoto || null,
      texto: raizOriginal.texto || raizOriginal.text || '',
      url: raizOriginal.url || raizOriginal.foto || null,
      thumbnailUrl: raizOriginal.thumbnailUrl || null,
      thumbnailLqUrl: raizOriginal.thumbnailLqUrl || null,
      tipoOriginal: raizOriginal.tipo || 'texto',
      provincia: raizOriginal.provincia || null,
      partido: raizOriginal.partido || null,
      localidad: raizOriginal.localidad || null,
      barrio: raizOriginal.barrio || null,
      createdAt: raizOriginal.createdAt || null
    },
    provincia: userData.provincia || 'Buenos Aires',
    partido: userData.partido || userData.localidad || 'Merlo',
    localidad: userData.localidadInterna || 'Merlo',
    barrio: userData.barrio || '',
    status: 'ready',
    likes: [],
    comentariosCount: 0,
    repostsCount: 0,
    createdAt: serverTimestamp()
  };

  // 1. Guardar el nuevo post de tipo 'repost'
  const newRef = await addDoc(collection(db, collectionName), repostData);

  // 2. Incrementar contador de reposts en el post original
  try {
    const originalRef = doc(db, collectionName, idOriginal);
    const { increment } = require('firebase/firestore');
    await updateDoc(originalRef, {
      repostsCount: increment(1)
    });
  } catch (e) {}

  // 3. Notificar al autor original si es otra persona
  if (autorOriginalId && autorOriginalId !== miUid) {
    try {
      await crearNotificacion({
        paraUserId: autorOriginalId,
        tipo: 'repost',
        postId: newRef.id,
        collectionName,
        texto: 'compartió tu publicación 🔁'
      });
    } catch (eNotif) {
      console.error("Error al notificar recompartido:", eNotif);
    }
  }

  return newRef.id;
};
