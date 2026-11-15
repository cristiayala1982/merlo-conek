import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { HaloUserIcon } from '../../components/icons/HaloIcons';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Image } from 'expo-image';
import { auth, db } from '../../firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { obtenerPerfilUsuario } from '../../services/firebaseService';

// --- COMPONENTE DE TARJETA MEMOIZADO ---
const VentaCard = React.memo(({ item, router }) => {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/(marketplace)/marketDetalle', params: { productId: item.id } })}
    >
      <Image
        source={{ uri: item.fotos[0] }}
        style={styles.foto}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.info}>
        <Text style={styles.titulo} numberOfLines={1}>{item.titulo}</Text>
        <Text style={styles.precio}>${item.precio}</Text>
        <View style={styles.soldBadge}>
           <Ionicons name="checkmark-done" size={14} color="#059669" />
           <Text style={styles.soldText}>VENDIDO</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#CCC" />
    </TouchableOpacity>
  );
});

export default function MarketVentasFinalizadas() {
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
      where('estado', '==', 'vendido'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProductos(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const renderProducto = useCallback(({ item }) => (
    <VentaCard item={item} router={router} />
  ), [router]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* HEADER RÁPIDO */}
      <View style={[styles.navBar, { paddingTop: insets.top }]}>
        <View style={styles.navContent}>
          <TouchableOpacity onPress={() => router.replace('/(marketplace)')} style={styles.navIconBtn}>
            <Ionicons name="home" size={28} color="#FF6600" />
          </TouchableOpacity>

          <Text style={styles.navTitle}>Ventas Finalizadas</Text>

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
          contentContainerStyle={styles.list}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cart-outline" size={60} color="#EEE" />
              <Text style={styles.emptyTxt}>Aún no tienes ventas finalizadas.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
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
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE'
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  backBtn: { padding: 5 },
  list: { padding: 15 },
  card: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 15,
    marginBottom: 15,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  foto: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#F3F4F6' },
  info: { flex: 1, marginLeft: 15 },
  titulo: { fontSize: 16, fontWeight: '700', color: '#111827' },
  precio: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  soldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 4
  },
  soldText: { fontSize: 11, color: '#059669', fontWeight: '900' },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyTxt: { color: '#9CA3AF', marginTop: 15, fontSize: 16 }
});
