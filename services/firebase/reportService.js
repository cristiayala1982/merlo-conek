import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { crearNotificacionModeracion } from './notificationService';
import { borrarArchivoPorUrl } from './storageService';

/**
 * Envía un reporte de contenido (post, perfil, comentario, etc).
 */
export const enviarReporte = async ({ tipo, idContenido, idAutor, motivo, idPadre = null, textoOpcional = '', extraData = {} }) => {
  try {
    const miUid = auth.currentUser?.uid;
    if (!miUid) return;

    const isModeracion = Boolean(tipo?.includes('moderacion') || extraData?.esModeracionAutomatica);
    const mediaUrl = extraData?.url || extraData?.mediaUrl || null;
    const thumbnailUrl = extraData?.thumbnailUrl || null;
    const fotosArray = mediaUrl ? [mediaUrl] : (extraData?.fotos || []);
    const collectionName = extraData?.collectionName || extraData?.seccion || (tipo?.includes('clasificados') ? 'clasificados' : 'posts');

    await addDoc(collection(db, 'reportes'), {
      tipo,
      esModeracion: isModeracion,
      esModeracionAutomatica: isModeracion,
      origen: isModeracion ? 'moderacion_automatica' : 'usuario',
      idContenido,
      idPost: idContenido,
      postId: idContenido,
      collectionName,
      seccion: collectionName,
      idAutor,
      autorNombre: extraData?.userName || extraData?.autorNombre || null,
      autorFoto: extraData?.userPhotoUrl || extraData?.autorFoto || null,
      url: mediaUrl,
      mediaUrl: mediaUrl,
      foto: mediaUrl,
      fotoUrl: mediaUrl,
      thumbnailUrl: thumbnailUrl,
      fotos: fotosArray,
      idPadre,
      reporterId: miUid,
      motivo,
      texto: textoOpcional || extraData?.titulo || '',
      titulo: extraData?.titulo || '',
      extraData,
      estado: 'pendiente',
      createdAt: serverTimestamp()
    });
    return true;
  } catch (e) {
    console.error("Error al enviar reporte:", e);
    throw e;
  }
};

/**
 * Alias para reportar perfiles específicamente (compatibilidad).
 */
export const reportarPerfil = async (targetUid, motivo = 'general') => {
  return await enviarReporte({ tipo: 'perfil', idContenido: targetUid, idAutor: targetUid, motivo });
};

/**
 * Sincroniza y asegura que todos los posts del usuario con status 'pendiente_revision'
 * tengan un documento activo en la colección 'reportes' para ser revisados desde Reportes y Pagos.
 */
export const sincronizarReportesPendientes = async (userId) => {
  try {
    if (!userId) return;

    // 1. Obtener todos los posts del usuario que estén pendientes de revisión
    const postsQuery = query(
      collection(db, 'posts'),
      where('userId', '==', userId),
      where('status', '==', 'pendiente_revision')
    );
    const postsSnap = await getDocs(postsQuery);

    if (postsSnap.empty) return;

    for (const postDoc of postsSnap.docs) {
      const postId = postDoc.id;
      const postData = postDoc.data();

      // 2. Verificar si ya existe un reporte 'pendiente' para este post
      const reportQuery = query(
        collection(db, 'reportes'),
        where('idContenido', '==', postId),
        where('estado', '==', 'pendiente')
      );
      const reportSnap = await getDocs(reportQuery);

      // Si no existe reporte pendiente para este post, lo creamos de inmediato
      if (reportSnap.empty) {
        console.log(`[Moderación] Sincronizando reporte pendiente faltante para post: ${postId}`);
        await enviarReporte({
          tipo: 'post_moderacion_automatica',
          idContenido: postId,
          idAutor: postData.userId || userId,
          motivo: 'Publicación en revisión por moderación automática (sincronizado)',
          extraData: {
            url: postData.url || null,
            thumbnailUrl: postData.thumbnailUrl || null,
            userName: postData.userName || '',
            userPhotoUrl: postData.userPhotoUrl || ''
          }
        });
      }
    }
  } catch (err) {
    console.error("Error al sincronizar reportes pendientes:", err);
  }
};

/**
 * Permite desde la app de Reportes y Pagos aprobar o rechazar un post pendiente de revisión por moderación.
 * @param {string} idPost ID del post en la colección 'posts'
 * @param {string} idReporte ID del reporte en la colección 'reportes'
 * @param {'aprobar' | 'rechazar'} accion Acción a realizar
 */
export const resolverModeracionPost = async ({ idPost, idReporte, accion, collectionName = 'posts' }) => {
  try {
    const miUid = auth.currentUser?.uid;
    if (!miUid) throw new Error("Usuario no autenticado");

    let targetCollection = collectionName || 'posts';
    let autorId = null;

    if (idReporte) {
      try {
        const repSnap = await getDoc(doc(db, 'reportes', idReporte));
        if (repSnap.exists()) {
          const repData = repSnap.data();
          if (repData.collectionName || repData.seccion) {
            targetCollection = repData.collectionName || repData.seccion;
          }
          if (repData.idAutor) autorId = repData.idAutor;
        }
      } catch (e) {}
    }

    if (!autorId && idPost) {
      try {
        const pSnap = await getDoc(doc(db, targetCollection, idPost));
        if (pSnap.exists()) {
          autorId = pSnap.data().userId || pSnap.data().idAutor;
        }
      } catch (errPost) {
        console.log("No se pudo obtener el autor:", errPost);
      }
    }

    if (accion === 'aprobar') {
      if (idPost) {
        await updateDoc(doc(db, targetCollection, idPost), {
          status: 'ready',
          estado: targetCollection === 'clasificados' ? 'activo' : 'ready',
          aprobadoPor: miUid,
          fechaAprobacion: serverTimestamp()
        });
      }

      if (idReporte) {
        await updateDoc(doc(db, 'reportes', idReporte), {
          estado: 'resuelto_aprobado',
          resueltoPor: miUid,
          resueltoAt: serverTimestamp()
        });
      }

      if (autorId) {
        try {
          await crearNotificacionModeracion({
            paraUserId: autorId,
            tipo: 'post_aprobado',
            postId: idPost,
            collectionName: targetCollection,
            texto: targetCollection === 'clasificados'
              ? '¡Tu anuncio en Clasificados fue aprobado y ya está visible!'
              : '¡Tu publicación fue aprobada y ya está visible en el muro social!'
          });
        } catch (errNotif) {
          console.error("Error al enviar notificación de aprobación:", errNotif);
        }
      }
    } else if (accion === 'rechazar') {
      if (idPost) {
        try {
          const pSnap = await getDoc(doc(db, targetCollection, idPost));
          if (pSnap.exists()) {
            const data = pSnap.data();
            const todasLasFotos = [
              ...(data.fotos || []),
              ...(data.fotosLQ || []),
              ...(data.fotosServicio || []),
              ...(data.thumbnailLqUrls || []),
              data.foto,
              data.url,
              data.thumbnailUrl,
              data.thumbnailLqUrl
            ].filter(Boolean);

            for (const f of todasLasFotos) {
              await borrarArchivoPorUrl(f).catch(() => {});
            }
          }
        } catch (eErr) { console.log("Error borrando multimedia de reporte:", eErr); }

        if (targetCollection === 'posts' || targetCollection === 'alertas_comunitarias') {
          try {
            const comRef = collection(db, targetCollection, idPost, 'comentarios');
            const comSnap = await getDocs(comRef);
            if (!comSnap.empty) {
              const { writeBatch } = require('firebase/firestore');
              const batch = writeBatch(db);
              comSnap.forEach(cDoc => batch.delete(cDoc.ref));
              await batch.commit();
            }
          } catch (eCom) {}
          await deleteDoc(doc(db, targetCollection, idPost));
        } else {
          await deleteDoc(doc(db, targetCollection, idPost));
        }
      }

      if (idReporte) {
        await updateDoc(doc(db, 'reportes', idReporte), {
          estado: 'resuelto_rechazado',
          resueltoPor: miUid,
          resueltoAt: serverTimestamp()
        });
      }

      if (autorId) {
        try {
          await crearNotificacionModeracion({
            paraUserId: autorId,
            tipo: 'post_rechazado',
            postId: idPost,
            collectionName: targetCollection,
            texto: 'Tu publicación fue eliminada por nuestro equipo de moderación por incumplir las normas de la comunidad.'
          });
        } catch (errNotif) {
          console.error("Error al enviar notificación de rechazo:", errNotif);
        }
      }
    }
    return true;
  } catch (e) {
    console.error("Error al resolver moderación de post:", e);
    throw e;
  }
};
