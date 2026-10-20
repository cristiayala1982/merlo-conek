import { arrayRemove, arrayUnion, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { subirArchivoConRuta } from './storageService';

/**
 * Publica un producto en el Marketplace.
 */
export const publicarProductoMarket = async ({ fotos, titulo, precio, descripcion, categoria, whatsapp, provincia, partido, localidad, barrio, direccion, coords, onProgress }) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const productoDocRef = doc(collection(db, 'productos_market'));
    const urlsFotos = [];

    for (let i = 0; i < fotos.length; i++) {
      const url = await subirArchivoConRuta(
        fotos[i],
        'foto',
        `market/${uid}/${productoDocRef.id}/foto_${i}.jpg`,
        (trans, total) => {
          const progresoFoto = (trans / total) * 100;
          const progresoGlobal = ((i * 100) + progresoFoto) / fotos.length;
          onProgress?.(Math.round(progresoGlobal));
        }
      );
      urlsFotos.push(url);
    }

    const productData = {
      id: productoDocRef.id,
      vendedorId: uid,
      fotos: urlsFotos,
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
      estado: 'activo',
      createdAt: serverTimestamp()
    };

    await setDoc(productoDocRef, productData);
    return productData;
  } catch (e) { console.error("Error al publicar producto:", e); throw e; }
};

/**
 * Actualiza un producto existente.
 */
export const actualizarProductoMarket = async ({ id, fotos, titulo, precio, descripcion, categoria, whatsapp, provincia, partido, localidad, barrio, direccion, coords, onProgress }) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const urlsFinales = [];

    for (let i = 0; i < fotos.length; i++) {
      const uri = fotos[i];
      if (uri.startsWith('http')) {
        urlsFinales.push(uri);
      } else {
        const url = await subirArchivoConRuta(
          uri,
          'foto',
          `market/${uid}/${id}/foto_${Date.now()}_${i}.jpg`,
          (trans, total) => {
            const progresoGlobal = ((i * 100) + ((trans / total) * 100)) / fotos.length;
            onProgress?.(Math.round(progresoGlobal));
          }
        );
        urlsFinales.push(url);
      }
    }

    const productRef = doc(db, 'productos_market', id);
    await updateDoc(productRef, {
      fotos: urlsFinales,
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
      updatedAt: serverTimestamp()
    });
    return true;
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
