import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar, Dimensions, FlatList, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Image } from 'expo-image'; // MOTOR DE ALTO RENDIMIENTO
import { auth, db } from '../../firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { obtenerPerfilUsuario } from '../../services/firebaseService';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 40) / 2;
const CARD_HEIGHT = 255;

// --- COMPONENTE DE PRODUCTO MEMOIZADO (IDÉNTICO AL MURO PRINCIPAL) ---
const ProductCard = React.memo(({ item, router }) => {
  return (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => router.push({ pathname: '/(marketplace)/marketDetalle', params: { productId: item.id } })}
    >
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: item.fotos[0] }}
          style={styles.productImg}
          contentFit="cover"
          transition={200}
        />
        {item.estado === 'vendido' && (
          <View style={styles.soldOverlay}>
            <Text style={styles.soldBadgeText}>VENDIDO</Text>
          </View>
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productPrice}>${item.precio}</Text>
        <Text style={styles.productTitle} numberOfLines={1}>{item.titulo}</Text>
        <View style={styles.locRow}>
          <Ionicons name="location-outline" size={12} color="#6B7280" />
          <Text style={styles.productLocation} numberOfLines={1}>
            {item.provincia && item.localidad ? `${item.provincia}, ${item.localidad}` : (item.localidad || 'Buenos Aires')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function MarketPerfilAjeno() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [perfil, setPerfil] = useState(null);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  const miUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) return;
    const unsubPerfil = obtenerPerfilUsuario(userId, setPerfil);
    const q = query(
      collection(db, 'productos_market'),
      where('vendedorId', '==', userId),
      where('estado', 'in', ['activo', 'vendido']),
      orderBy('createdAt', 'desc')
    );
    const unsubProds = onSnapshot(q, (snap) => {
      setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => { unsubPerfil(); unsubProds(); };
  }, [userId]);

  const renderHeader = useCallback(() => (
    <View style={styles.headerProfile}>
      <Image
        source={{ uri: perfil?.fotoUrl || 'https://picsum.photos/200' }}
        style={styles.avatar}
        contentFit="cover"
      />
      <Text style={styles.nombre}>{perfil?.nombre}</Text>

      <TouchableOpacity
        style={styles.starsRow}
        onPress={() => router.push({ pathname: '/(marketplace)/marketCalificaciones', params: { userId } })}
      >
        {[1, 2, 3, 4, 5].map(s => (
          <Ionicons
            key={s}
            name={s <= (perfil?.reputacion || 0) ? "star" : "star-outline"}
            size={18}
            color="#FFB800"
          />
        ))}
        <Text style={styles.reputacionTxt}>
          {perfil?.reputacion?.toFixed(1) || '0.0'} ({perfil?.totalVentas || 0} ventas)
        </Text>
      </TouchableOpacity>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.socialBtn}
          onPress={() => {
            if (userId === miUid) router.push('/(tabs)/perfil');
            else router.push({ pathname: '/(tabs)/perfilAjeno', params: { userId } });
          }}
        >
          <Ionicons name="person-circle-outline" size={20} color="#FF6600" />
          <Text style={styles.socialBtnText}>Ver Perfil Social</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionDivider}>
        <Text style={styles.sectionTitle}>Publicaciones</Text>
      </View>
    </View>
  ), [perfil, userId, miUid]);

  const renderItem = useCallback(({ item }) => (
    <ProductCard item={item} router={router} />
  ), [router]);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#FF6600" size="large" /></View>;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#333" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Perfil del Vendedor</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={productos}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={renderItem}
        initialNumToRender={4}
        windowSize={3}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
        getItemLayout={(data, index) => (
          { length: CARD_HEIGHT, offset: CARD_HEIGHT * index, index }
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>Este vendedor no tiene publicaciones.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: 'white' },
  topBarTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  backBtn: { padding: 5 },
  headerProfile: { alignItems: 'center', paddingVertical: 30, backgroundColor: '#FFFBF5' },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EEE', borderWidth: 3, borderColor: 'white' },
  nombre: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginTop: 15 },
  starsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  reputacionTxt: { fontSize: 14, color: '#6B7280', marginLeft: 5, fontWeight: '600' },
  actionButtons: { marginTop: 20 },
  socialBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, borderWidth: 1, borderColor: '#FF6600', gap: 8 },
  socialBtnText: { color: '#FF6600', fontWeight: 'bold', fontSize: 14 },
  sectionDivider: { width: '100%', paddingHorizontal: 20, paddingTop: 30, paddingBottom: 10, backgroundColor: 'white' },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#111827', textTransform: 'uppercase', letterSpacing: 1 },
  columnWrapper: { justifyContent: 'space-between', paddingHorizontal: 15 },
  productCard: { width: COLUMN_WIDTH, height: CARD_HEIGHT, backgroundColor: '#FFFFFF', borderRadius: 15, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#F3F4F6' },
  imageWrapper: { position: 'relative', width: '100%', height: 160 },
  productImg: { width: '100%', height: '100%', backgroundColor: '#F9FAFB' },
  soldOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  soldBadgeText: { color: 'white', fontSize: 14, fontWeight: '900', backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, letterSpacing: 1, transform: [{ rotate: '-10deg' }], borderWidth: 2, borderColor: 'white' },
  productInfo: { padding: 12 },
  productPrice: { fontSize: 17, fontWeight: '900', color: '#111827' },
  productTitle: { fontSize: 14, color: '#374151', marginTop: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  productLocation: { fontSize: 12, color: '#4B5563', marginLeft: 4 },
  empty: { padding: 40, alignItems: 'center' },
  emptyTxt: { color: '#9CA3AF', textAlign: 'center' }
});
