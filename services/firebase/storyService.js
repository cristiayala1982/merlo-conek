import { addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { showToast } from '../../components/utilidades/CustomToast';
import { auth, db, storage } from '../../firebaseConfig';
import { evaluarImagenSensible } from '../imageModerationService';
import { crearNotificacion } from './notificationService';
import { enviarReporte } from './reportService';
import { subirArchivoConRuta, borrarArchivoPorUrl } from './storageService';

const VEINTICUATRO_HORAS_MS = 24 * 60 * 60 * 1000;

/**
 * Verifica si una historia tiene menos de 24 horas. Si es más vieja, la elimina de Firestore y R2.
 */
const filtrarYLimpiarHistoriaExpirada = (h) => {
  const ahora = Date.now();
  const creadoEn = h.createdAt?.toMillis ? h.createdAt.toMillis() : (h.createdAt?.seconds ? h.createdAt.seconds * 1000 : null);
  if (!creadoEn) return true;

  const esExpirada = (ahora - creadoEn > VEINTICUATRO_HORAS_MS);
  if (esExpirada) {
    // Auto-eliminación silenciosa de R2 y Firestore
    eliminarHistoriaAFirebase(h).catch(() => {});
    return false;
  }
  return true;
};

/**
 * Cuenta las historias normales activas (últimas 24 horas, excluyendo espontáneas).
 */
export const contarHistoriasNormalesActivas = async (uid) => {
  if (!uid) return 0;
  try {
    const q = query(
      collection(db, 'historias'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const ahora = Date.now();

    const normalesActivas = snap.docs.filter(d => {
      const data = d.data();
      if (data.esEspontanea) return false;
      if (data.status && data.status !== 'ready') return false;
      const creadoEn = data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : null);
      return creadoEn && (ahora - creadoEn < VEINTICUATRO_HORAS_MS);
    });

    return normalesActivas.length;
  } catch (e) {
    console.error("Error contando historias normales activas:", e);
    return 0;
  }
};

/**
 * Escucha las historias de un usuario específico (filtrando expiradas > 24h).
 */
export const escucharHistoriasUsuario = (userId, onData) => {
  if (!userId) return () => {};
  const q = query(collection(db, 'historias'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map(d => {
      const data = d.data();
      if (data.url && data.url.startsWith('file://')) data.url = null;
      if (data.thumbnailUrl && data.thumbnailUrl.startsWith('file://')) data.thumbnailUrl = null;
      return { id: d.id, ...data };
    });
    const validas = docs.filter(story => (!story.status || story.status === 'ready') && filtrarYLimpiarHistoriaExpirada(story));
    onData(validas);
  });
};

/**
 * Escucha las historias de los círculos (seguidos) excluyendo bloqueados y expiradas (> 24h).
 */
export const escucharHistoriasCirculos = (onData) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid) return () => {};

  let unsubStories = null;

  const unsubUser = onSnapshot(doc(db, 'usuarios', miUid), (uSnap) => {
    if (unsubStories) unsubStories();
    const dataMe = uSnap.data() || {};
    const siguiendo = dataMe.siguiendo || [];
    const bloqueados = dataMe.bloqueados || [];

    const filterIds = [miUid, ...siguiendo].filter(id => !bloqueados.includes(id)).slice(0, 30);

    const q = query(
      collection(db, 'historias'),
      where('userId', 'in', filterIds),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    unsubStories = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data();
        if (data.url && data.url.startsWith('file://')) data.url = null;
        if (data.thumbnailUrl && data.thumbnailUrl.startsWith('file://')) data.thumbnailUrl = null;
        return { id: d.id, ...data };
      }).filter(h => (!h.status || h.status === 'ready') && filtrarYLimpiarHistoriaExpirada(h));

      const mapa = new Map();
      items.forEach(h => { if (!mapa.has(h.userId)) mapa.set(h.userId, h); });
      onData(Array.from(mapa.values()));
    });
  });

  return () => {
    unsubUser();
    if (unsubStories) unsubStories();
  };
};

/**
 * Agrupa y obtiene historias para un set de usuarios (filtrando expiradas > 24h).
 */
export const obtenerHistoriasGrupales = async (uids) => {
  const q = query(collection(db, 'historias'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const filtered = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(h => uids.includes(h.userId) && (!h.status || h.status === 'ready') && filtrarYLimpiarHistoriaExpirada(h));

  const cacheUsuarios = {};
  const grouped = {};

  for (const h of filtered) {
    if (h.url && h.url.startsWith('file://')) h.url = null;
    if (h.thumbnailUrl && h.thumbnailUrl.startsWith('file://')) h.thumbnailUrl = null;

    if (!grouped[h.userId]) {
      let name = h.userName;
      let photo = h.userPhotoUrl;

      if (!name || !photo) {
        if (!cacheUsuarios[h.userId]) {
          const uSnap = await getDoc(doc(db, 'usuarios', h.userId));
          if (uSnap.exists()) cacheUsuarios[h.userId] = uSnap.data();
        }
        if (cacheUsuarios[h.userId]) {
          if (!name) name = cacheUsuarios[h.userId].nombre;
          if (!photo) photo = cacheUsuarios[h.userId].fotoUrl;
        }
      }

      grouped[h.userId] = {
        userId: h.userId,
        userName: name || 'Usuario',
        userPhotoUrl: photo || null,
        stories: []
      };
    }
    grouped[h.userId].stories.push({
      id: h.id,
      type: h.tipo,
      url: h.url,
      thumbnailUrl: h.thumbnailUrl,
      esEspontanea: h.esEspontanea || false,
      texto: h.texto || '',
      reacciones: h.reacciones || {},
      createdAt: h.createdAt
    });
  }
  return Object.values(grouped);
};

/**
 * Reacciona a una historia.
 */
export const reaccionarHistoria = async (historiaId, tipo = 'like') => {
  const miUid = auth.currentUser?.uid;
  if (!miUid || !historiaId) return;
  const updateData = {};
  if (tipo) {
    updateData[`reacciones.${miUid}`] = tipo;
  } else {
    updateData[`reacciones.${miUid}`] = deleteField();
  }
  await updateDoc(doc(db, 'historias', historiaId), updateData);
};

/**
 * Sube una historia a Firebase con soporte para múltiples calidades y miniaturas.
 * Limita a un máximo de 5 historias normales en las últimas 24 horas.
 */
export const subirHistoriaAFirebase = async (datos) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  // VERIFICACIÓN DE LÍMITE: Solo aplica a historias normales (las espontáneas no cuentan para el límite)
  if (!datos.esEspontanea) {
    const activasNormales = await contarHistoriasNormalesActivas(uid);
    if (activasNormales >= 5) {
      showToast('Alcanzaste el límite de 5 historias en las últimas 24 horas.', 'warning');
      throw new Error('Límite de 5 historias alcanzado');
    }
  }

  const userDoc = await getDoc(doc(db, 'usuarios', uid));
  const userData = userDoc.exists() ? userDoc.data() : {};

  // 0. Evaluacion de Moderación de Imagen/Video en la Nube
  let estadoModeracion = 'ready';
  let evaluacion = null;

  // Si es video, evaluamos la miniatura/captura (thumbnailUri), si es foto evaluamos uri
  const uriParaEvaluar = (datos.tipo === 'video') ? datos.thumbnailUri : datos.uri;

  if (uriParaEvaluar) {
    datos.onProgress?.({ fase: 'evaluando-imagen', progreso: 5 });
    try {
      evaluacion = await evaluarImagenSensible(uriParaEvaluar);

      if (evaluacion.accion === 'PENDIENTE_REVISION' || evaluacion.accion === 'ERROR' || evaluacion.accion === 'BLOQUEAR') {
        estadoModeracion = 'pendiente_revision';
      }
    } catch (errEval) {
      console.log('Error evaluando moderación en Historia:', errEval);
      estadoModeracion = 'pendiente_revision';
    }
  }

  // 1. Subir Media principal (Foto comprimida o Video)
  const mediaUrl = await subirArchivoConRuta(datos.uri, datos.tipo, `historias/${uid}/${Date.now()}/media`, (trans, total) => {
    datos.onProgress?.({ fase: 'subiendo-media', progreso: (trans / total) * 100 });
  });

  // 2. Subir Thumbnail (Frame de video o miniatura de lista de historias)
  let thumbnailUrl = null;
  if (datos.thumbnailUri) {
    thumbnailUrl = await subirArchivoConRuta(datos.thumbnailUri, 'foto', `historias/${uid}/${Date.now()}/thumb`, (trans, total) => {
      datos.onProgress?.({ fase: 'subiendo-thumbnail', progreso: (trans / total) * 100 });
    });
  }

  // 3. Subir Miniatura ultra-baja (LQ) para placeholder borroso instantáneo
  let thumbnailLqUrl = null;
  if (datos.thumbnailLqUri) {
      thumbnailLqUrl = await subirArchivoConRuta(datos.thumbnailLqUri, 'foto', `historias/${uid}/${Date.now()}/thumb_lq`);
  }

  const storyDocRef = await addDoc(collection(db, 'historias'), {
    userId: uid,
    userName: userData.nombre || 'Usuario',
    userPhotoUrl: userData.fotoUrl || null,
    tipo: datos.tipo,
    texto: datos.texto || '',
    url: mediaUrl,
    thumbnailUrl: thumbnailUrl,
    thumbnailLqUrl: thumbnailLqUrl,
    esEspontanea: datos.esEspontanea || false,
    status: estadoModeracion,
    createdAt: serverTimestamp()
  });

  if (estadoModeracion === 'pendiente_revision') {
    try {
      const motivoReporte = evaluacion?.accion === 'BLOQUEAR'
        ? 'Imagen/Video con contenido sensible/obsceno detectado automáticamente por moderación en la nube'
        : 'Imagen dudosa/sensible detectada automáticamente por moderación en la nube';

      const puntajePct = Math.round((evaluacion?.puntaje || 0.20) * 100) || 20;

      await enviarReporte({
        tipo: 'historia_moderacion_automatica',
        idContenido: storyDocRef.id,
        idAutor: uid,
        motivo: motivoReporte,
        extraData: {
          url: mediaUrl || thumbnailUrl,
          mediaUrl: mediaUrl || thumbnailUrl,
          thumbnailUrl: thumbnailUrl || mediaUrl,
          userName: userData.nombre || 'Usuario',
          userPhotoUrl: userData.fotoUrl || null,
          puntajeSensibilidad: puntajePct,
          seccion: 'historias',
          collectionName: 'historias',
          esModeracionAutomatica: true,
          esModeracion: true
        }
      });

      await addDoc(collection(db, 'usuarios', uid, 'notificaciones'), {
        deUserId: 'system',
        deNombre: 'Moderación Merlo Conek',
        deFoto: null,
        tipo: 'historia_en_revision',
        postId: storyDocRef.id,
        collectionName: 'historias',
        texto: 'Tu historia está en revisión por nuestro equipo de moderación.',
        leido: false,
        createdAt: serverTimestamp()
      });

      showToast('Tu historia está en revisión por nuestro equipo de moderación.', 'review');
    } catch (errReporte) {
      console.error("Error al registrar reporte de historia:", errReporte);
    }
  }

  datos.onProgress?.({ fase: 'completado', progreso: 100 });
};

/**
 * Elimina una historia de Firestore y Storage / Cloudflare R2.
 */
export const eliminarHistoriaAFirebase = async (historia) => {
  try {
    const id = historia?.id || historia?.storyId;
    if (!id) return;

    if (historia?.url) await borrarArchivoPorUrl(historia.url);
    if (historia?.thumbnailUrl) await borrarArchivoPorUrl(historia.thumbnailUrl);
    if (historia?.thumbnailLqUrl) await borrarArchivoPorUrl(historia.thumbnailLqUrl);

    await deleteDoc(doc(db, 'historias', id));
  } catch (e) { console.error("Error al eliminar historia:", e); throw e; }
};

// --- MÉTODOS DE VISTAS ---

export const marcarHistoriasComoVistas = async () => {
  const uid = auth.currentUser?.uid;
  if (uid) await updateDoc(doc(db, 'usuarios', uid), { lastStoriesCheck: serverTimestamp() });
};

export const marcarUsuarioHistoriaComoVista = async (targetUid) => {
  const uid = auth.currentUser?.uid;
  if (uid && targetUid) await updateDoc(doc(db, 'usuarios', uid), { [`vistasHistorias.${targetUid}`]: serverTimestamp() });
};

export const registrarVistaHistoria = async (storyId) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid || !storyId) return;
  await updateDoc(doc(db, 'historias', storyId), { [`vistas.${miUid}`]: serverTimestamp() });
};
