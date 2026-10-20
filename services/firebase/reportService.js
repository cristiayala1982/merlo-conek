import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

/**
 * Envía un reporte de contenido (post, perfil, comentario, etc).
 */
export const enviarReporte = async ({ tipo, idContenido, idAutor, motivo, idPadre = null, textoOpcional = '', extraData = {} }) => {
  try {
    const miUid = auth.currentUser?.uid;
    if (!miUid) return;

    await addDoc(collection(db, 'reportes'), {
      tipo,
      idContenido,
      idAutor,
      idPadre,
      reporterId: miUid,
      motivo,
      texto: textoOpcional,
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
