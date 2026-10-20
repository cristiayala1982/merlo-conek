import { addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { subirArchivoConRuta } from './storageService';

/**
 * Sube un post con media (foto/video) a Firestore.
 */
export const subirPostAFirebase = async ({ uri, tipo, thumbnailUri = null, texto = '', textoSobreMedia = '', esEspontanea = false, provincia = null, partido = null, localidad = null, barrio = null, onProgress = null }) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const postDocRef = doc(collection(db, 'posts'));
    const userDoc = await getDoc(doc(db, 'usuarios', uid));
    const userData = userDoc.exists() ? userDoc.data() : {};

    // 1. Subir Media principal usando nuestro nuevo módulo de storage
    const mediaUrl = await subirArchivoConRuta(uri, tipo, `posts/${uid}/${postDocRef.id}/media`, (trans, total) => {
      onProgress?.({ fase: 'subiendo-media', progreso: (trans / total) * 100 });
    });

    // 2. Subir Thumbnail si existe
    let thumbnailUrl = null;
    if (thumbnailUri) {
      thumbnailUrl = await subirArchivoConRuta(thumbnailUri, 'foto', `posts/${uid}/${postDocRef.id}/thumb`, (trans, total) => {
        onProgress?.({ fase: 'subiendo-thumbnail', progreso: (trans / total) * 100 });
      });
    }

    const postData = {
      postId: postDocRef.id,
      userId: uid,
      userName: userData.nombre || 'Usuario',
      userPhotoUrl: userData.fotoUrl || null,
      tipo,
      texto,
      textoSobreMedia,
      esEspontanea,
      url: mediaUrl,
      thumbnailUrl: thumbnailUrl,
      provincia,
      partido,
      localidad,
      barrio,
      status: 'ready',
      createdAt: serverTimestamp()
    };

    await setDoc(postDocRef, postData);
    onProgress?.({ fase: 'completado', progreso: 100 });

    return { id: postDocRef.id, ...postData };
  } catch (e) { console.error(e); throw e; }
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
    await addDoc(collection(db, 'posts'), {
      userId: uid, userName: userData.nombre || 'Usuario',
      userPhotoUrl: userData.fotoUrl || null, tipo: 'texto',
      texto, status: 'ready', createdAt: serverTimestamp()
    });
  } catch (e) { console.error(e); throw e; }
};

/**
 * Escucha los posts del muro filtrando por seguidos y bloqueados.
 */
export const escucharPostsMuro = (onData) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid) return () => {};

  let unsubPosts = null;

  const unsubUser = onSnapshot(doc(db, 'usuarios', miUid), (uSnap) => {
    if (unsubPosts) unsubPosts();

    const dataMe = uSnap.data() || {};
    const siguiendo = dataMe.siguiendo || [];
    const bloqueados = dataMe.bloqueados || [];

    const filterIds = [miUid, ...siguiendo].filter(id => !bloqueados.includes(id)).slice(0, 30);

    const q = query(
      collection(db, 'posts'),
      where('userId', 'in', filterIds),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    unsubPosts = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => {
        const data = d.data();
        if (data.url && data.url.startsWith('file://')) data.url = null;
        if (data.thumbnailUrl && data.thumbnailUrl.startsWith('file://')) data.thumbnailUrl = null;
        return { id: d.id, ...data };
      });
      onData(docs);
    });
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
  return onSnapshot(q, (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
};

/**
 * Actualiza el contenido de un post.
 */
export const actualizarPost = async (postId, nuevoTexto) => {
  await updateDoc(doc(db, 'posts', postId), { texto: nuevoTexto, updatedAt: serverTimestamp() });
};
