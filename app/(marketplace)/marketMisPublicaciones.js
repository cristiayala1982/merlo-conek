import { Ionicons } from '@expo/vector-icons';
import { HaloUserIcon } from '../../components/icons/HaloIcons';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';
import { formatearFechaVencimiento } from '../../services/dateUtils';
import { obtenerPerfilUsuario, borrarArchivoPorUrl } from '../../services/firebaseService';
import { obtenerNivelEfectivo } from '../../services/marketAlgorithm';

export default function MarketMisPublicaciones() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // Cargar perfil para la cabecera
    obtenerPerfilUsuario(uid, setPerfil);

    const q = query(
      collection(db, 'productos_market'),
      where('vendedorId', '==', uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Lógica de auto-borrado: Solo borramos si pasaron más de 24hs del vencimiento final
      const ahora = new Date();
      data.forEach(prod => {
        const info = obtenerNivelEfectivo(prod);

        // Si tiene cola, miramos el vencimiento final de la cola
        const fechaVencFinal = prod.vencimientoPremiumSiguiente
          ? (prod.vencimientoPremiumSiguiente.toDate ? prod.vencimientoPremiumSiguiente.toDate() : new Date(prod.vencimientoPremiumSiguiente))
          : (prod.vencimientoPremium ? (prod.vencimientoPremium.toDate ? prod.vencimientoPremium.toDate() : new Date(prod.vencimientoPremium)) : null);

        if (fechaVencFinal) {
          const fechaLimiteBorrado = new Date(fechaVencFinal.getTime() + (24 * 60 * 60 * 1000));
          if (fechaLimiteBorrado < ahora) {
            console.log("Producto expirado totalmente, borrando:", prod.id);
            eliminarProducto(prod.id);
          }
        }
      });

      setProductos(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const confirmarEliminar = (productId) => {
    Alert.alert(
      "Eliminar publicación",
      "¿Estás seguro de que quieres eliminar este artículo? No podrás recuperarlo.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => eliminarProducto(productId)
        }
      ]
    );
  };

  const eliminarProducto = async (id) => {
    try {
      const docSnap = await getDoc(doc(db, 'productos_market', id));
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
      await deleteDoc(doc(db, 'productos_market', id));
    } catch (e) {
      Alert.alert("Error", "No se pudo eliminar el producto.");
    }
  };

  const toggleVendido = async (id, estadoActual) => {
    try {
      const nuevoEstado = estadoActual === 'vendido' ? 'activo' : 'vendido';
      await updateDoc(doc(db, 'productos_market', id), {
        estado: nuevoEstado
      });
    } catch (e) {
      Alert.alert("Error", "No se pudo actualizar el estado.");
    }
  };

  const renderProducto = ({ item }) => {
    const esVendido = item.estado === 'vendido';
    const enRevision = item.estado === 'pendiente_revision';
    const ahora = new Date();
    const info = obtenerNivelEfectivo(item);

    const estaVencido = item.esPremium && info.nivel === 0;
    const tieneUpgradeEnCola = !!item.nivelPremiumSiguiente;

    return (
      <View style={styles.card}>
        {/* Parte Superior: Info e Imagen */}
        <TouchableOpacity
          style={styles.mainInfo}
          onPress={() => router.push({ pathname: '/(marketplace)/marketDetalle', params: { productId: item.id } })}
          activeOpacity={0.7}
        >
          <Image source={{ uri: item.fotos[0] }} style={styles.foto} />
          <View style={styles.textContainer}>
            <Text style={styles.titulo} numberOfLines={1}>{item.titulo}</Text>
            <Text style={styles.precio}>${item.precio}</Text>

            <View style={styles.statusRow}>
              {/* 1. Badge de Estado Prioritario: Pago/Aprobación Pendiente */}
              {enRevision ? (
                <View style={[styles.badge, styles.badgePendiente]}>
                  <Ionicons name="time" size={12} color="#854D0E" style={{ marginRight: 4 }} />
                  <Text style={[styles.badgeText, styles.badgeTextPendiente]}>EN REVISIÓN</Text>
                </View>
              ) : item.publicidadPendiente ? (
                <View style={[styles.badge, styles.badgePendiente]}>
                  <Ionicons name="time" size={12} color="#854D0E" style={{ marginRight: 4 }} />
                  <Text style={[styles.badgeText, styles.badgeTextPendiente]}>
                    ESPERANDO APROBACIÓN
                  </Text>
                </View>
              ) : (
                <>
                  {/* 2. Badge de Estado Base (ACTIVO / VENDIDO / VENCIDO) */}
                  <View style={[styles.badge, esVendido ? styles.badgeVendido : (estaVencido ? styles.badgeVendido : styles.badgeActivo)]}>
                    <Text style={[styles.badgeText, esVendido ? styles.badgeTextVendido : (estaVencido ? styles.badgeTextVendido : styles.badgeTextActivo)]}>
                      {esVendido ? 'VENDIDO' : (estaVencido ? 'IMPULSO VENCIDO' : 'ACTIVO')}
                    </Text>
                  </View>

                  {/* 3. Badge de Impulso Actual (Solo si está activo y no vencido) */}
                  {item.esPremium && !estaVencido && (
                    <View style={[styles.badge, item.nivelPremium === 2 ? styles.badgePremium2 : styles.badgePremium1]}>
                      <Ionicons name="rocket" size={12} color="white" style={{ marginRight: 4 }} />
                      <Text style={[styles.badgeText, { color: 'white' }]}>
                        {item.nivelPremium === 2 ? 'MÁXIMO IMPULSO' : 'IMPULSADA'}
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* 4. Badge de Interés (Likes) */}
              {item.likes?.length > 0 && (
                <View style={[styles.badge, styles.badgeLikes]}>
                  <Ionicons name="heart" size={12} color="#FF6600" style={{ marginRight: 4 }} />
                  <Text style={[styles.badgeText, { color: '#FF6600' }]}>
                    {item.likes.length} {item.likes.length === 1 ? 'interesado' : 'interesados'}
                  </Text>
                </View>
              )}

              {/* 5. Texto de Vencimiento */}
              {item.esPremium && item.vencimientoPremium && (
                <Text style={[styles.vencimientoTxt, estaVencido && { color: '#EF4444', fontWeight: 'bold' }]}>
                  {estaVencido ? `Venció el ${formatearFechaVencimiento(item.vencimientoPremium)}` : `Vence el ${formatearFechaVencimiento(item.vencimientoPremium)}`}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Separador sutil */}
        <View style={styles.divider} />

        {/* Barra de Acciones: Todo en una misma línea y con estilo unificado */}
        <View style={styles.toolbar}>
          <ActionButton
            icon="rocket"
            label={enRevision ? "En revisión" : (estaVencido ? "Renovar" : (item.esPremium ? "Impulsado" : "Impulsar"))}
            color={enRevision || (item.esPremium && !estaVencido) ? "#9CA3AF" : "#FF6600"}
            onPress={() => {
              if (enRevision) {
                Alert.alert("Anuncio en revisión", "Podrás impulsarlo cuando el equipo de moderación lo apruebe.");
                return;
              }
              if (item.esPremium && !estaVencido) {
                Alert.alert("Ya está impulsada", "Tu publicación ya tiene un plan activo. Podrás renovarlo una vez que venza.");
                return;
              }
              router.push({ pathname: '/(marketplace)/marketPromocionar', params: { productId: item.id } });
            }}
          />
          <ActionButton
            icon={esVendido ? "refresh" : "checkmark-circle"}
            label={esVendido ? "Activar" : "Vendido"}
            color={esVendido ? "#3B82F6" : "#059669"}
            onPress={() => {
              if (enRevision) {
                Alert.alert("Anuncio en revisión", "No se puede cambiar el estado hasta que el equipo de moderación lo revise.");
                return;
              }
              toggleVendido(item.id, item.estado);
            }}
          />
          <ActionButton
            icon="create"
            label="Editar"
            color="#4B5563"
            onPress={() => router.push({ pathname: '/(marketplace)/marketEditar', params: { productId: item.id } })}
          />
          <ActionButton
            icon="trash"
            label="Borrar"
            color="#EF4444"
            onPress={() => confirmarEliminar(item.id)}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* HEADER RÁPIDO */}
      <View style={[styles.navBar, { paddingTop: insets.top }]}>
        <View style={styles.navContent}>
          <TouchableOpacity onPress={() => router.replace('/(marketplace)')} style={styles.navIconBtn}>
            <Ionicons name="home" size={28} color="#FF6600" />
          </TouchableOpacity>

          <Text style={styles.navTitle}>Mis Publicaciones</Text>

          <TouchableOpacity onPress={() => router.push('/(marketplace)/marketPerfil')} style={styles.navProfileBtn}>
            {perfil?.fotoUrl ? (
              <Image source={{ uri: perfil.fotoUrl }} style={styles.navAvatar} />
            ) : (
              <View style={[styles.navAvatar, { backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' }]}>
                <HaloUserIcon size={18} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#FF6600" size="large" /></View>
      ) : (
        <FlatList
          data={productos}
          keyExtractor={(item) => item.id}
          renderItem={renderProducto}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(100, insets.bottom + 40) }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bag-remove-outline" size={60} color="#EEE" />
              <Text style={styles.emptyTxt}>Aún no tienes nada publicado.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function ActionButton({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.6}>
      <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // ESTILOS NAV BAR RÁPIDA
  navBar: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  navContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 60, paddingHorizontal: 15 },
  navIconBtn: { padding: 5 },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#111827' },
  navProfileBtn: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', borderWidth: 1.5, borderColor: '#FF6600', backgroundColor: '#F3F4F6' },
  navAvatar: { width: '100%', height: '100%' },
  navAvatarPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    height: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  backBtn: { padding: 5 },
  list: { padding: 12 },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 12,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3
  },
  mainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  foto: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#F3F4F6' },
  textContainer: { flex: 1, marginLeft: 15 },
  titulo: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  precio: { fontSize: 20, fontWeight: '900', color: '#FF6600', marginVertical: 4 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 2
  },
  badgeActivo: { backgroundColor: '#D1FAE5' },
  badgeVendido: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 11, fontWeight: '900' },
  badgeTextActivo: { color: '#059669' },
  badgeTextVendido: { color: '#EF4444' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  badgePendiente: { backgroundColor: '#FEF9C3', borderColor: '#FEF08A', borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  badgeTextPendiente: { color: '#854D0E' },
  badgePremium1: { backgroundColor: '#FF6600', flexDirection: 'row', alignItems: 'center' },
  badgePremium2: { backgroundColor: '#FFB800', flexDirection: 'row', alignItems: 'center' },
  badgeLikes: { backgroundColor: '#FFF5F0', borderColor: '#FF6600', borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  vencimientoTxt: { fontSize: 11, color: '#6B7280', marginTop: 4, width: '100%' },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6
  },
  actionBtn: {
    alignItems: 'center',
    flex: 1
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyTxt: { color: '#9CA3AF', marginTop: 15, fontSize: 16 }
});
