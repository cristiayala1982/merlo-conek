import { addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { auth, db, storage } from '../../firebaseConfig';
import { subirArchivoConRuta } from './storageService';

/**
 * Escucha las historias de un usuario específico.
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
    onData(docs);
  });
};

/**
 * Escucha las historias de los círculos (seguidos) excluyendo bloqueados.
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
      });
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
 * Agrupa y obtiene historias para un set de usuarios.
 */
export const obtenerHistoriasGrupales = async (uids) => {
  const q = query(collection(db, 'historias'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const filtered = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(h => uids.includes(h.userId));

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
 * Sube una historia a Firebase.
 */
export const subirHistoriaAFirebase = async (datos) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const userDoc = await getDoc(doc(db, 'usuarios', uid));
  const userData = userDoc.exists() ? userDoc.data() : {};

  const mediaUrl = await subirArchivoConRuta(datos.uri, datos.tipo, `historias/${uid}/${Date.now()}/media`, (trans, total) => {
    datos.onProgress?.({ fase: 'subiendo-media', progreso: (trans / total) * 100 });
  });

  let thumbnailUrl = null;
  if (datos.thumbnailUri) {
    thumbnailUrl = await subirArchivoConRuta(datos.thumbnailUri, 'foto', `historias/${uid}/${Date.now()}/thumb`, (trans, total) => {
      datos.onProgress?.({ fase: 'subiendo-thumbnail', progreso: (trans / total) * 100 });
    });
  }

  await addDoc(collection(db, 'historias'), {
    userId: uid,
    userName: userData.nombre || 'Usuario',
    userPhotoUrl: userData.fotoUrl || null,
    tipo: datos.tipo,
    texto: datos.texto || '',
    url: mediaUrl,
    thumbnailUrl: thumbnailUrl,
    esEspontanea: datos.esEspontanea || false,
    status: 'ready',
    createdAt: serverTimestamp()
  });
  datos.onProgress?.({ fase: 'completado', progreso: 100 });
};

/**
 * Elimina una historia de Firestore y Storage.
 */
export const eliminarHistoriaAFirebase = async (historia) => {
  try {
    const id = historia?.id || historia?.storyId;
    if (!id) return;
    await deleteDoc(doc(db, 'historias', id));
    if (historia.url && historia.url.includes('firebasestorage')) {
      const storageRef = ref(storage, historia.url);
      await deleteObject(storageRef).catch(err => console.log("Error borrar storage:", err));
    }
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

// --- DESAFÍOS ESPONTÁNEOS ---

export const escucharDesafiosPendientes = (onData) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid) return () => {};
  const q = query(collection(db, 'desafios'), where('paraId', '==', miUid), where('status', '==', 'pending'));
  return onSnapshot(q, (snap) => onData(snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null));
};

export const responderDesafio = async (id, status) => {
  if (!id) return;
  try {
    const desafioRef = doc(db, 'desafios', id);
    const snap = await getDoc(desafioRef);
    if (!snap.exists()) return;
    await updateDoc(desafioRef, { status });
  } catch (e) { console.error("Error al responder desafío:", e); }
};

export const obtenerAmigosParaDesafio = async () => {
  const miUid = auth.currentUser?.uid;
  if (!miUid) return [];
  const userSnap = await getDoc(doc(db, 'usuarios', miUid));
  const siguiendo = userSnap.data()?.siguiendo || [];
  if (siguiendo.length === 0) return [];
  const q = query(collection(db, 'usuarios'), where('__name__', 'in', siguiendo.slice(0, 10)));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
};

export const lanzarDesafioEspontaneo = async (targetUid) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid || !targetUid) return;
  const expiraAt = new Date(Date.now() + 10 * 60 * 1000);
  const desafioRef = await addDoc(collection(db, 'desafios'), { deId: miUid, paraId: targetUid, status: 'pending', createdAt: serverTimestamp(), expiraAt });
  return desafioRef.id;
};
