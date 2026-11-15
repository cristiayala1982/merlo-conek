import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Linking, Modal, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SelectorCompartir from '../../components/compartir/SelectorCompartir';
import SelectorOpcionesModal from '../../components/reportes/SelectorOpcionesModal';
import SelectorReporteModal from '../../components/reportes/SelectorReporteModal';
import { HaloUserIcon } from '../../components/icons/HaloIcons';
import { auth, db } from '../../firebaseConfig';
import { formatearFechaVencimiento, tiempoRelativo } from '../../services/dateUtils';
import { enviarReporte, obtenerPerfilUsuario, toggleLikeProducto, borrarArchivoPorUrl } from '../../services/firebaseService';
import { obtenerNivelEfectivo } from '../../services/marketAlgorithm';
import styles from './marketDetalle.styles';

const { width } = Dimensions.get('window');

export default function MarketDetalle() {
  const { productId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sugerenciasRef = useRef(null);
  const [producto, setProducto] = useState(null);
  const [vendedor, setVendedor] = useState(null);
  const [miPerfil, setMiPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fotoActiva, setFotoActiva] = useState(0);
  const [mostrarMenuOpciones, setMostrarMenuOpciones] = useState(false);
  const [mostrarMenuReporte, setMostrarMenuReporte] = useState(false);
  const [mostrarModalCalificar, setMostrarModalCalificar] = useState(false);
  const [mostrarCompartir, setMostrarCompartir] = useState(false);
  const [estrellas, setEstrellas] = useState(5);
  const [comentarioRating, setComentarioRating] = useState('');
  const [enviandoRating, setEnviandoRating] = useState(false);
  const [sugerencias, setSugerencias] = useState([]);

  const miUid = auth.currentUser?.uid;

  const formatPrecio = (val) => {
    if (typeof val === 'number') return val.toLocaleString('es-AR');
    if (!val) return '';
    const num = String(val).replace(/[^0-9]/g, '');
    if (!num) return '';
    return parseInt(num, 10).toLocaleString('es-AR');
  };

  useEffect(() => {
    if (miUid) {
      obtenerPerfilUsuario(miUid, setMiPerfil);
    }
  }, [miUid]);

  useEffect(() => {
    const cargarSugerencias = async () => {
      try {
        const ahora = new Date();
        const q = query(
          collection(db, 'productos_market'),
          where('esPremium', '==', true),
          where('estado', '==', 'activo'),
          limit(15)
        );
        const snap = await getDocs(q);

        let prods = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => {
            if (p.id === productId) return false;
            // Filtro de vencimiento
            if (p.vencimientoPremium) {
              const fVenc = p.vencimientoPremium.toDate ? p.vencimientoPremium.toDate() : new Date(p.vencimientoPremium);
              if (fVenc < ahora) return false;
            }
            return true;
          });

        // Si hay pocos premium vigentes, rellenar con comunes para que siempre haya movimiento
        if (prods.length < 5) {
          const q2 = query(
            collection(db, 'productos_market'),
            where('estado', '==', 'activo'),
            limit(15)
          );
          const snap2 = await getDocs(q2);
          const extras = snap2.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(p => {
              if (p.id === productId) return false;
              if (prods.some(x => x.id === p.id)) return false;
              // Las comunes también pueden tener vencimiento si fueron premium alguna vez
              if (p.vencimientoPremium) {
                const fVenc = p.vencimientoPremium.toDate ? p.vencimientoPremium.toDate() : new Date(p.vencimientoPremium);
                if (fVenc < ahora) return false;
              }
              return true;
            });
          prods = [...prods, ...extras].slice(0, 8);
        }

        setSugerencias(prods);
      } catch (e) {
        console.log("Error sugerencias:", e);
      }
    };

    if (productId) cargarSugerencias();
  }, [productId]);

  // Auto-scroll para sugerencias
  useEffect(() => {
    let interval;
    if (sugerencias.length > 1) {
      let index = 0;
      interval = setInterval(() => {
        if (sugerenciasRef.current) {
          index++;
          if (index >= sugerencias.length) index = 0;
          sugerenciasRef.current.scrollTo({
            x: index * 155,
            animated: true
          });
        }
      }, 2200);
    }
    return () => clearInterval(interval);
  }, [sugerencias]);

  useEffect(() => {
    if (!productId) return;

    // Escuchar cambios en tiempo real
    const unsub = onSnapshot(doc(db, 'productos_market', productId), async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProducto({ id: snap.id, ...data });

        // Cargar vendedor si no está
        if (!vendedor) {
          const uSnap = await getDoc(doc(db, 'usuarios', data.vendedorId));
          if (uSnap.exists()) setVendedor(uSnap.data());
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, [productId]);

  // Chequeo de bloqueo
  const loTengoBloqueado = miPerfil?.bloqueados?.includes(producto?.vendedorId);
  const meTieneBloqueado = vendedor?.bloqueados?.includes(miUid);
  const bloqueoActivo = loTengoBloqueado || meTieneBloqueado;

  const abrirWhatsApp = () => {
    if (!producto?.whatsapp || bloqueoActivo) return;

    // Limpiamos el número: sacamos todo lo que no sea número
    const tel = producto.whatsapp.replace(/\D/g, '');
    const numFinal = tel.startsWith('54') ? tel : `549${tel.startsWith('0') ? tel.substring(1) : tel}`;

    // Generamos el link de la app de forma prolija
    const mensaje = encodeURIComponent(`¡Hola! Me interesa tu publicación en Merlo Conek:\n\n📌 *${producto.titulo}*\n\n¿Sigue disponible?\n\nVer foto del producto:\n${producto.fotos[0]}`);

    // Intentamos apertura directa por app, si falla usamos link universal
    const urlApp = `whatsapp://send?phone=${numFinal}&text=${mensaje}`;
    const urlWeb = `https://wa.me/${numFinal}?text=${mensaje}`;

    Linking.canOpenURL(urlApp).then(supported => {
      if (supported) {
        return Linking.openURL(urlApp);
      } else {
        return Linking.openURL(urlWeb);
      }
    }).catch(() => {
      Alert.alert("Error", "No se pudo abrir WhatsApp.");
    });
  };

  const handleLike = () => {
    if (!producto || bloqueoActivo) return;
    const tieneLike = producto.likes?.includes(miUid);
    toggleLikeProducto(producto.id, tieneLike);
  };

  const abrirMapaExterno = () => {
    if (!producto?.coords || bloqueoActivo) return;
    const { latitude, longitude } = producto.coords;
    const label = encodeURIComponent(producto.titulo);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`
    });

    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "No se pudo abrir la aplicación de mapas.");
    });
  };

  const contactarVendedor = () => {
    if (!vendedor || bloqueoActivo || producto.estado === 'vendido') return;
    router.push({
      pathname: '/chats',
      params: {
        userId: producto.vendedorId,
        nombre: vendedor.nombre,
        tipo: 'market',
        productId: producto.id
      }
    });
  };

  const handleOpciones = () => {
    setMostrarMenuOpciones(true);
  };

  const handleCompartir = () => {
    setMostrarMenuOpciones(false);
    setMostrarCompartir(true);
  };

  const handleOcultar = async () => {
    setMostrarMenuOpciones(false);
    try {
      await updateDoc(doc(db, 'usuarios', miUid), {
        marketOcultos: arrayUnion(producto.id)
      });
      Alert.alert("Oculto", "No volverás a ver este producto en tu muro.");
      router.back();
    } catch (e) {
      console.log(e);
    }
  };

  const handleReportarPress = () => {
    setMostrarMenuReporte(true);
  };

  const enviarReporteProd = async (motivo) => {
    setMostrarMenuReporte(false);
    setMostrarMenuOpciones(false);
    try {
      await enviarReporte({
        tipo: 'producto_market',
        idContenido: producto.id,
        idAutor: producto.vendedorId,
        motivo,
        textoOpcional: `Producto: ${producto.titulo}`,
        extraData: {
          titulo: producto.titulo,
          precio: producto.precio,
          fotos: producto.fotos,
          descripcion: producto.descripcion,
          localidad: producto.localidad,
          vendedorNombre: vendedor?.nombre
        }
      });
      Alert.alert("Gracias", "Tu reporte ha sido enviado para revisión.");
    } catch (e) {
      Alert.alert("Error", "No se pudo enviar el reporte.");
    }
  };

  const handleEliminarMiProducto = () => {
    setMostrarMenuOpciones(false);
    Alert.alert(
      "Eliminar publicación",
      "¿Estás seguro de que quieres eliminar esta publicación? No podrás recuperarla.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const docSnap = await getDoc(doc(db, 'productos_market', producto.id));
              if (docSnap.exists()) {
                const data = docSnap.data();
                const todasLasFotos = [
                  ...(data.fotos || []),
                  ...(data.fotosLQ || []),
                  ...(data.thumbnailLqUrls || []),
                  data.foto,
                  data.url
                ].filter(Boolean);
                for (const f of todasLasFotos) {
                  await borrarArchivoPorUrl(f);
                }
              }
              await deleteDoc(doc(db, 'productos_market', producto.id));
              Alert.alert("Éxito", "Publicación eliminada correctamente.");
              router.back();
            } catch (e) {
              Alert.alert("Error", "No se pudo eliminar la publicación.");
            }
          }
        }
      ]
    );
  };

  const obtenerOpcionesMenu = () => {
    if (!producto) return [];

    const opciones = [
      {
        label: 'Compartir publicación',
        icon: 'share-social-outline',
        color: '#374151',
        onPress: handleCompartir
      }
    ];

    if (producto.vendedorId !== miUid) {
      opciones.push(
        {
          label: 'Ocultar',
          icon: 'eye-off-outline',
          color: '#374151',
          onPress: handleOcultar
        },
        {
          label: 'Reportar',
          icon: 'flag-outline',
          color: '#EF4444',
          onPress: handleReportarPress
        }
      );
    } else {
      opciones.push({
        label: 'Eliminar publicación',
        icon: 'trash-outline',
        color: '#EF4444',
        onPress: handleEliminarMiProducto
      });
    }

    return opciones;
  };

  const handleCalificar = async () => {
    if (!miUid || enviandoRating) return;
    setEnviandoRating(true);

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'usuarios', producto.vendedorId);
        const userSnap = await transaction.get(userRef);
        const userData = userSnap.data() || {};

        const totalVentas = (userData.totalVentas || 0);
        const reputacionActual = (userData.reputacion || 0);

        // Nueva reputación (Promedio simple para este ejemplo)
        const nuevaRepu = totalVentas === 0 ? estrellas : ((reputacionActual * totalVentas) + estrellas) / (totalVentas + 1);

        // 1. Guardar la calificación
        const califRef = doc(collection(db, 'usuarios', producto.vendedorId, 'calificaciones_market'));
        transaction.set(califRef, {
            estrellas,
            comentario: comentarioRating.trim(),
            compradorId: miUid,
            compradorNombre: miPerfil?.nombre || 'Usuario',
            productoId: producto.id,
            productoTitulo: producto.titulo,
            createdAt: serverTimestamp()
        });

        // 2. Actualizar reputación del vendedor
        transaction.update(userRef, {
            reputacion: nuevaRepu,
            totalVentas: totalVentas + 1
        });
      });

      Alert.alert("¡Gracias!", "Tu calificación ha sido enviada.");
      setMostrarModalCalificar(false);
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "No se pudo enviar la calificación.");
    } finally {
      setEnviandoRating(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#FF6600" /></View>;
  if (!producto) return <View style={styles.center}><Text>Producto no encontrado</Text></View>;

  if (bloqueoActivo) {
    return (
      <View style={styles.container}>
        <View style={[styles.backBtn, { top: insets.top + 10, backgroundColor: '#EEE' }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={60} color="#EF4444" />
          <Text style={styles.lockTitle}>Contenido no disponible</Text>
          <Text style={styles.lockSub}>No puedes ver este producto debido a un bloqueo activo.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        removeClippedSubviews={Platform.OS === 'android'}
        scrollEventThrottle={16}
      >

        {/* Slider de Fotos */}
        <View style={styles.imageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const offset = e.nativeEvent.contentOffset.x;
              setFotoActiva(Math.round(offset / width));
            }}
            scrollEventThrottle={16}
          >
            {producto.fotos.map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                placeholder={{ uri: producto.thumbnailLqUrls?.[i] || null }}
                placeholderContentFit="cover"
                style={styles.fullImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 10 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          {/* Botones de acción flotantes (Compartir y Opciones) */}
          <View style={[styles.floatingActions, { top: insets.top + 10 }]}>
            <TouchableOpacity
              style={styles.floatingBtnCircle}
              onPress={handleCompartir}
            >
              <Ionicons name="share-social" size={22} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.floatingBtnCircle}
              onPress={handleOpciones}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color="white" />
            </TouchableOpacity>

            {producto.vendedorId !== miUid && (
              <TouchableOpacity
                style={styles.floatingBtnCircle}
                onPress={handleLike}
              >
                <Ionicons
                  name={producto.likes?.includes(miUid) ? "heart" : "heart-outline"}
                  size={26}
                  color={producto.likes?.includes(miUid) ? "#FF6600" : "white"}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Indicador de fotos */}
          <View style={styles.dotsContainer}>
            {producto.fotos.map((_, i) => (
              <View key={i} style={[styles.dot, fotoActiva === i && styles.dotActive]} />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.priceRow}>
            <Text style={styles.precio}>${formatPrecio(producto.precio)}</Text>
            {producto.estado === 'vendido' && (
              <View style={styles.soldBadgeDetalle}>
                <Text style={styles.soldBadgeDetalleText}>VENDIDO</Text>
              </View>
            )}
          </View>
          <Text style={styles.titulo}>{producto.titulo}</Text>

          <View style={styles.infoMetaContainer}>
            <View style={styles.infoMetaItem}>
              <Ionicons name="time-outline" size={16} color="#6B7280" />
              <Text style={styles.infoMetaText}>Publicado {tiempoRelativo(producto.createdAt)}</Text>
            </View>
            <View style={styles.infoMetaItem}>
              <Ionicons name="location-outline" size={16} color="#6B7280" />
              <Text style={styles.infoMetaText}>
                {producto.partido ? `${producto.partido}${producto.localidad ? `, ${producto.localidad}` : ''}` : (producto.localidad || 'Ubicación no especificada')}
              </Text>
            </View>
          </View>

          {producto.vendedorId === miUid && producto.esPremium && (
            <View style={styles.premiumInfoBox}>
               <Ionicons name="rocket" size={16} color="#FF6600" />
               <View>
                 <Text style={styles.premiumInfoText}>
                   Impulso activo hasta el {formatearFechaVencimiento(obtenerNivelEfectivo(producto).vence)}
                 </Text>
                 {producto.nivelPremiumSiguiente && (
                   <Text style={[styles.premiumInfoText, {color: '#B45309', fontSize: 11}]}>
                     Próximo plan programado: MÁXIMO IMPULSO
                   </Text>
                 )}
               </View>
            </View>
          )}

          {producto.vendedorId === miUid && producto.likes?.length > 0 && (
            <View style={styles.likesOwnerBox}>
               <Ionicons name="heart" size={18} color="#FF6600" />
               <Text style={styles.likesOwnerText}>
                 A {producto.likes.length} {producto.likes.length === 1 ? 'persona le gusta' : 'personas les gusta'} tu publicación
               </Text>
            </View>
          )}

          {producto.direccion ? (
            <View style={styles.referenciaBox}>
               <Text style={styles.referenciaTitle}>Referencia:</Text>
               <Text style={styles.referenciaTxt}>{producto.direccion}</Text>
            </View>
          ) : null}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.descripcion}>{producto.descripcion}</Text>

          <View style={styles.divider} />

          {/* Botón Mapa si tiene GPS */}
          {producto.coords && (
            <TouchableOpacity style={styles.mapBtn} onPress={abrirMapaExterno}>
              <View style={styles.mapIconBg}>
                <Ionicons name="map" size={20} color="white" />
              </View>
              <View>
                <Text style={styles.mapBtnTitle}>Ver ubicación exacta</Text>
                <Text style={styles.mapBtnSub}>Abrir en Google Maps</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CCC" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          )}

          {/* Info Vendedor */}
          <View style={styles.vendedorCard}>
             {vendedor?.fotoUrl ? (
               <Image
                  source={{ uri: vendedor.fotoUrl }}
                  style={styles.vendedorAvatar}
                  contentFit="cover"
                  transition={100}
                  cachePolicy="memory-disk"
               />
             ) : (
               <View style={[styles.vendedorAvatar, { backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' }]}>
                 <HaloUserIcon size={24} color="#FFF" />
               </View>
             )}
             <View style={{ flex: 1 }}>
                <Text style={styles.vendedorLabel}>Vendedor</Text>
                <Text style={styles.vendedorNombre}>{vendedor?.nombre}</Text>
                <TouchableOpacity
                   style={styles.starsRow}
                   onPress={() => router.push({ pathname: '/(marketplace)/marketCalificaciones', params: { userId: producto.vendedorId } })}
                >
                   {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= (vendedor?.reputacion || 0) ? "star" : "star-outline"}
                        size={14}
                        color="#FFB800"
                      />
                   ))}
                   <Text style={styles.reputacionTxt}>
                     ({vendedor?.totalVentas || 0} ventas)
                   </Text>
                </TouchableOpacity>
             </View>
             <TouchableOpacity style={styles.perfilBtn} onPress={() => router.push({ pathname: '/(marketplace)/marketPerfilAjeno', params: { userId: producto.vendedorId } })}>
                <Text style={styles.perfilBtnTxt}>Ver perfil</Text>
             </TouchableOpacity>
          </View>

          {/* TAL VEZ TE INTERESE */}
          {sugerencias.length > 0 && (
            <View style={styles.sugerenciasSection}>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Tal vez te interese</Text>
              <ScrollView
                ref={sugerenciasRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sugerenciasScroll}
                snapToInterval={155}
                decelerationRate="fast"
              >
                {sugerencias.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.sugerenciaCard}
                    onPress={() => router.push({ pathname: '/(marketplace)/marketDetalle', params: { productId: item.id } })}
                  >
                    <Image
                      source={{ uri: item.fotos[0] }}
                      style={styles.sugerenciaImg}
                      contentFit="cover"
                      transition={150}
                      cachePolicy="memory-disk"
                    />
                    <View style={styles.sugerenciaInfo}>
                      <Text style={styles.sugerenciaPrecio}>${item.precio}</Text>
                      <Text style={styles.sugerenciaTitulo} numberOfLines={1}>{item.titulo}</Text>
                    </View>
                    <View style={styles.sugerenciaBadge}>
                      <Ionicons name="rocket" size={10} color="white" />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

        </View>
      </ScrollView>

      {/* Barra de contacto fija abajo */}
      <View style={[styles.footer, { paddingBottom: Math.max(20, insets.bottom) }]}>
         {producto.vendedorId === miUid ? (
           <TouchableOpacity
              style={[styles.chatBtn, { backgroundColor: '#4B5563' }]}
              onPress={() => router.push({ pathname: '/(marketplace)/marketEditar', params: { productId: producto.id } })}
           >
              <Ionicons name="create" size={24} color="white" />
              <Text style={styles.chatBtnText}>Editar mi publicación</Text>
           </TouchableOpacity>
         ) : producto.estado === 'vendido' ? (
            <TouchableOpacity
              style={[styles.chatBtn, { backgroundColor: '#FFB800' }]}
              onPress={() => setMostrarModalCalificar(true)}
            >
              <Ionicons name="star" size={24} color="white" />
              <Text style={styles.chatBtnText}>Calificar al vendedor</Text>
            </TouchableOpacity>
         ) : (
            <View style={styles.footerRow}>
              {producto.esPremium && producto.whatsapp ? (
                // SI ES PAGA Y TIENE WHATSAPP: SOLO BOTÓN DE WHATSAPP (Beneficio Premium)
                <TouchableOpacity
                  style={[styles.whatsappBtn, { flex: 1 }]}
                  onPress={abrirWhatsApp}
                >
                  <Ionicons name="logo-whatsapp" size={26} color="white" />
                  <Text style={styles.chatBtnText}>Contactar por WhatsApp</Text>
                </TouchableOpacity>
              ) : (
                // SI ES GRATIS O NO TIENE WHATSAPP: CHAT INTERNO DE CONECTADOS
                <TouchableOpacity
                  style={[styles.chatBtn, { flex: 1 }, (producto.estado === 'vendido' || bloqueoActivo) && styles.chatBtnDisabled]}
                  onPress={contactarVendedor}
                  disabled={producto.estado === 'vendido' || bloqueoActivo}
                >
                  <Ionicons name={producto.estado === 'vendido' ? "bag-check" : "chatbubble-ellipses"} size={24} color="white" />
                  <Text style={styles.chatBtnText}>
                    {producto.estado === 'vendido' ? 'Este artículo ya se vendió' : 'Chat de Conectados'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
         )}
      </View>

      {/* MODAL DE CALIFICACION */}
      <Modal visible={mostrarModalCalificar} transparent animationType="slide">
         <View style={styles.modalOverlay}>
            <View style={[styles.menuContent, { paddingBottom: 60 }]}>
               <View style={styles.menuIndicator} />
               <Text style={styles.califTitle}>Calificar a {vendedor?.nombre}</Text>
               <Text style={styles.califSub}>¿Cómo fue tu experiencia de compra?</Text>

               <View style={styles.starsSelectRow}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <TouchableOpacity key={s} onPress={() => setEstrellas(s)}>
                      <Ionicons name={s <= estrellas ? "star" : "star-outline"} size={40} color="#FFB800" />
                    </TouchableOpacity>
                  ))}
               </View>

               <TextInput
                  placeholder="Escribe un comentario opcional..."
                  style={styles.califInput}
                  multiline
                  value={comentarioRating}
                  onChangeText={setComentarioRating}
               />

               <TouchableOpacity
                style={[styles.enviarCalifBtn, enviandoRating && { opacity: 0.5 }]}
                onPress={handleCalificar}
                disabled={enviandoRating}
               >
                  {enviandoRating ? <ActivityIndicator color="white" /> : <Text style={styles.enviarCalifBtnTxt}>Enviar Calificación</Text>}
               </TouchableOpacity>

               <TouchableOpacity onPress={() => setMostrarModalCalificar(false)} style={styles.califCancelar}>
                  <Text style={styles.califCancelarTxt}>Cerrar</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

      {/* MODAL GLOBAL DE OPCIONES */}
      <SelectorOpcionesModal
        visible={mostrarMenuOpciones}
        onClose={() => setMostrarMenuOpciones(false)}
        titulo="Opciones"
        opciones={obtenerOpcionesMenu()}
      />

      {/* MODAL GLOBAL DE REPORTE */}
      <SelectorReporteModal
        visible={mostrarMenuReporte}
        onClose={() => setMostrarMenuReporte(false)}
        onReportar={enviarReporteProd}
      />

      {/* SELECTOR COMPARTIR INTERNO */}
      <SelectorCompartir
        visible={mostrarCompartir}
        onClose={() => setMostrarCompartir(false)}
        contenido={{
          id: producto.id,
          tipo: 'market',
          titulo: producto.titulo,
          imagen: producto.fotos[0] || null,
          subTitulo: `$${producto.precio}`
        }}
      />

    </View>
  );
}

