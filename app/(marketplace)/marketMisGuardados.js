import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { HaloUserIcon } from '../../components/icons/HaloIcons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Image } from 'expo-image';
import { auth, db } from '../../firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toggleLikeProducto, obtenerPerfilUsuario } from '../../services/firebaseService';

// --- COMPONENTE DE TARJETA MEMOIZADO ---
const GuardadoCard = React.memo(({ item, router, onRemove }) => {
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
        <Text style={styles.loc}>
          {item.provincia && item.localidad ? `${item.provincia}, ${item.localidad}` : (item.localidad || item.provincia || 'Buenos Aires')}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => onRemove(item.id)}
      >
        <Ionicons name="heart" size={24} color="#FF6600" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

export default function MarketMisGuardados() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState(null);

  const miUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!miUid) return;

    // Cargar perfil para la cabecera
    obtenerPerfilUsuario(miUid, setPerfil);

    // Buscamos productos donde mi UID esté en la lista de 'likes'
    const q = query(
      collection(db, 'productos_market'),
      where('likes', 'array-contains', miUid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProductos(data);
      setLoading(false);
    });

    return () => unsub();
  }, [miUid]);

  const handleRemove = useCallback((productId) => {
    toggleLikeProducto(productId, true);
  }, []);

  const renderProducto = useCallback(({ item }) => (
    <GuardadoCard item={item} router={router} onRemove={handleRemove} />
  ), [router, handleRemove]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* HEADER RÁPIDO */}
      <View style={[styles.navBar, { paddingTop: insets.top }]}>
        <View style={styles.navContent}>
          <TouchableOpacity onPress={() => router.replace('/(marketplace)')} style={styles.navIconBtn}>
            <Ionicons name="home" size={28} color="#FF6600" />
          </TouchableOpacity>

          <Text style={styles.navTitle}>Mis Guardados</Text>

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
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={10}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-dislike-outline" size={60} color="#EEE" />
              <Text style={styles.emptyTxt}>No tienes productos guardados todavía.</Text>
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
  foto: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#F3F4F6' },
  info: { flex: 1, marginLeft: 15 },
  titulo: { fontSize: 16, fontWeight: '700', color: '#111827' },
  precio: { fontSize: 15, fontWeight: 'bold', color: '#FF6600', marginTop: 2 },
  loc: { fontSize: 12, color: '#4B5563', marginTop: 4 },
  removeBtn: { padding: 10 },
  empty: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyTxt: { color: '#9CA3AF', marginTop: 15, fontSize: 16, textAlign: 'center' }
});
