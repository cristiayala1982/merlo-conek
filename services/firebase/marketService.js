import { arrayRemove, arrayUnion, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { evaluarImagenSensible } from '../imageModerationService';
import { crearNotificacionModeracion } from './notificationService';
import { enviarReporte } from './reportService';
import { subirArchivoConRuta, borrarArchivoPorUrl } from './storageService';

const crearRevisionModeracionMarket = async ({ productoId, userId, producto, evaluacion }) => {
  const motivo = evaluacion?.accion === 'ERROR'
    ? 'No se pudo completar la moderación automática; requiere revisión manual'
    : evaluacion?.accion === 'BLOQUEAR'
      ? 'Contenido explícito detectado automáticamente; requiere revisión manual antes de resolver el anuncio'
      : 'Imagen dudosa/sensible detectada automáticamente por moderación en la nube';

  await enviarReporte({
    tipo: 'producto_market_moderacion_automatica',
    idContenido: productoId,
    idAutor: userId,
    motivo,
    extraData: {
      collectionName: 'productos_market',
      seccion: 'marketplace',
      titulo: producto.titulo,
      url: producto.fotos?.[0] || null,
      thumbnailUrl: producto.thumbnailLqUrls?.[0] || null,
      fotos: producto.fotos || [],
      fotosLQ: producto.thumbnailLqUrls || [],
      userName: producto.userName || auth.currentUser?.displayName || 'Usuario',
      userPhotoUrl: producto.userPhoto || null,
      puntajeSensibilidad: evaluacion?.puntaje || 0,
      detalles: evaluacion?.detalles || {},
      errorModeracion: evaluacion?.accion === 'ERROR' ? (evaluacion.motivo || 'Error desconocido al evaluar la imagen') : null
    }
  });

  await crearNotificacionModeracion({
    paraUserId: userId,
    tipo: 'producto_market_en_revision',
    postId: productoId,
    collectionName: 'productos_market',
    texto: 'Tu producto está en revisión por nuestro equipo de moderación.'
  });
};

/**
 * Publica un producto en el Marketplace.
 */
export const publicarProductoMarket = async ({ fotos, fotosLQ = [], titulo, precio, descripcion, categoria, whatsapp, provincia, partido, localidad, barrio, direccion, coords, onProgress }) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const productoDocRef = doc(collection(db, 'productos_market'));
    const urlsFotos = [];
    const urlsLQ = [];
    const evaluacion = fotos?.[0] ? await evaluarImagenSensible(fotos[0]) : null;
    const requiereRevision = !!evaluacion && evaluacion.accion !== 'APROBADO';

    // 1. Subir Fotos Principales
    for (let i = 0; i < fotos.length; i++) {
      const url = await subirArchivoConRuta(
        fotos[i],
        'foto',
        `market/${uid}/${productoDocRef.id}/foto_${i}.jpg`,
        (trans, total) => {
          const progresoFoto = (trans / total) * 100;
          const progresoGlobal = ((i * 100) + progresoFoto) / (fotos.length + fotosLQ.length);
          onProgress?.(Math.round(progresoGlobal));
        }
      );
      urlsFotos.push(url);
    }

    // 2. Subir Fotos LQ (Placeholders)
    for (let i = 0; i < fotosLQ.length; i++) {
        if (!fotosLQ[i]) { urlsLQ.push(null); continue; }
        const urlLQ = await subirArchivoConRuta(
            fotosLQ[i],
            'foto',
            `market/${uid}/${productoDocRef.id}/lq_${i}.jpg`
        );
        urlsLQ.push(urlLQ);
    }

    const productData = {
      id: productoDocRef.id,
      vendedorId: uid,
      fotos: urlsFotos,
      thumbnailLqUrls: urlsLQ, // Nueva propiedad
      titulo,
      precio: parseFloat(precio),
      descripcion,
      categoria,
      whatsapp: whatsapp || null,
      provincia,
      partido: partido || null,
      localidad,
      barrio,
      direccion: direccion || null,
      coords: coords || null,
      likes: [],
      estado: requiereRevision ? 'pendiente_revision' : 'activo',
      status: requiereRevision ? 'pendiente_revision' : 'ready',
      createdAt: serverTimestamp()
    };

    await setDoc(productoDocRef, productData);
    if (requiereRevision) {
      await crearRevisionModeracionMarket({
        productoId: productoDocRef.id,
        userId: uid,
        producto: productData,
        evaluacion
      });
    }
    return productData;
  } catch (e) { console.error("Error al publicar producto:", e); throw e; }
};

/**
 * Actualiza un producto existente.
 */
export const actualizarProductoMarket = async ({ id, fotos, fotosLQ = [], titulo, precio, descripcion, categoria, whatsapp, provincia, partido, localidad, barrio, direccion, coords, onProgress }) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const productRef = doc(db, 'productos_market', id);
    const productoActualSnap = await getDoc(productRef);
    if (!productoActualSnap.exists()) throw new Error('El producto ya no existe.');
    const productoActual = productoActualSnap.data();
    const urlsFinales = [];
    const urlsLQFinales = [];
    const cambioPortada = fotos?.[0] && fotos[0] !== productoActual.fotos?.[0];
    const evaluacion = cambioPortada ? await evaluarImagenSensible(fotos[0]) : null;
    const requiereRevision = !!evaluacion && evaluacion.accion !== 'APROBADO';

    // Subida fotos principales
    for (let i = 0; i < fotos.length; i++) {
      const uri = fotos[i];
      if (uri.startsWith('http')) {
        urlsFinales.push(uri);
        // Si es remota, intentamos mantener su LQ correspondiente
        urlsLQFinales.push(fotosLQ[i] || null);
      } else {
        const url = await subirArchivoConRuta(
          uri,
          'foto',
          `market/${uid}/${id}/foto_${Date.now()}_${i}.jpg`,
          (trans, total) => {
            const progresoGlobal = ((i * 100) + ((trans / total) * 100)) / (fotos.length + fotosLQ.length);
            onProgress?.(Math.round(progresoGlobal));
          }
        );
        urlsFinales.push(url);

        // Subir su nueva LQ
        if (fotosLQ[i]) {
            const urlLQ = await subirArchivoConRuta(fotosLQ[i], 'foto', `market/${uid}/${id}/lq_${Date.now()}_${i}.jpg`);
            urlsLQFinales.push(urlLQ);
        } else {
            urlsLQFinales.push(null);
        }
      }
    }

    // Borrar fotos viejas descartadas del servidor (R2)
    const fotosViejas = productoActual.fotos || [];
    const fotosLQViejas = productoActual.thumbnailLqUrls || [];
    for (let i = 0; i < fotosViejas.length; i++) {
      const fVieja = fotosViejas[i];
      const fLQVieja = fotosLQViejas[i];
      if (fVieja && !urlsFinales.includes(fVieja)) {
        console.log("[STORAGE] Borrando foto huérfana de producto market editado:", fVieja);
        await borrarArchivoPorUrl(fVieja).catch(e => console.log('Error borrando foto market huérfana:', e));
        if (fLQVieja) {
          await borrarArchivoPorUrl(fLQVieja).catch(e => console.log('Error borrando foto LQ market huérfana:', e));
        }
      }
    }

    const mantenerRevision = productoActual.estado === 'pendiente_revision' || requiereRevision;
    const estadoFinal = mantenerRevision ? 'pendiente_revision' : (productoActual.estado || 'activo');
    await updateDoc(productRef, {
      fotos: urlsFinales,
      thumbnailLqUrls: urlsLQFinales,
      titulo,
      precio: parseFloat(precio),
      descripcion,
      categoria,
      whatsapp: whatsapp || null,
      provincia,
      partido: partido || null,
      localidad,
      barrio,
      direccion: direccion || null,
      coords: coords || null,
      estado: estadoFinal,
      status: mantenerRevision ? 'pendiente_revision' : 'ready',
      updatedAt: serverTimestamp()
    });

    if (requiereRevision && productoActual.estado !== 'pendiente_revision') {
      const productoActualizado = {
        ...productoActual,
        fotos: urlsFinales,
        thumbnailLqUrls: urlsLQFinales,
        titulo,
        userName: productoActual.userName || 'Usuario',
        userPhoto: productoActual.userPhoto || null
      };
      await crearRevisionModeracionMarket({
        productoId: id,
        userId: uid,
        producto: productoActualizado,
        evaluacion
      });
    }
    return { estado: estadoFinal };
  } catch (e) { console.error("Error al actualizar producto:", e); throw e; }
};

/**
 * Agrega o quita un producto de favoritos.
 */
export const toggleLikeProducto = async (productId, yaTieneLike) => {
  const miUid = auth.currentUser?.uid;
  if (!miUid || !productId) return;
  const productRef = doc(db, 'productos_market', productId);
  await updateDoc(productRef, {
    likes: yaTieneLike ? arrayRemove(miUid) : arrayUnion(miUid)
  });
};
