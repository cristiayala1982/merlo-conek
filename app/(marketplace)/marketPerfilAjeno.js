import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, StatusBar } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { obtenerPerfilUsuario } from '../../services/firebaseService';

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

    // 1. Obtener datos del vendedor
    const unsubPerfil = obtenerPerfilUsuario(userId, (data) => {
      setPerfil(data);
    });

    // 2. Obtener sus productos activos
    const q = query(
      collection(db, 'productos_market'),
      where('vendedorId', '==', userId),
      where('estado', '==', 'activo'),
      orderBy('createdAt', 'desc')
    );

    const unsubProds = onSnapshot(q, (snap) => {
      setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubPerfil();
      unsubProds();
    };
  }, [userId]);

  const renderHeader = () => (
    <View style={styles.headerProfile}>
      <Image
        source={{ uri: perfil?.fotoUrl || 'https://picsum.photos/200' }}
        style={styles.avatar}
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
            if (userId === miUid) {
              router.push('/(tabs)/perfil');
            } else {
              router.push({ pathname: '/(tabs)/perfilAjeno', params: { userId } });
            }
          }}
        >
          <Ionicons name="person-circle-outline" size={20} color="#FF6600" />
          <Text style={styles.socialBtnText}>Ver Perfil Social</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionDivider}>
        <Text style={styles.sectionTitle}>Publicaciones Activas</Text>
      </View>
    </View>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator color="#FF6600" size="large" /></View>;

  return (
    <View style={styles.container}>
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
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.productCard}
            onPress={() => router.push({ pathname: '/(marketplace)/marketDetalle', params: { productId: item.id } })}
          >
            <Image source={{ uri: item.fotos[0] }} style={styles.productImg} />
            <Text style={styles.productPrice}>${item.precio}</Text>
            <Text style={styles.productTitle} numberOfLines={1}>{item.titulo}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>Este vendedor no tiene otros productos activos.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
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
  productCard: { width: '48%', marginBottom: 20, backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#F3F4F6' },
  productImg: { width: '100%', height: 150, backgroundColor: '#F9FAFB' },
  productPrice: { fontSize: 16, fontWeight: '900', color: '#111827', paddingHorizontal: 10, marginTop: 10 },
  productTitle: { fontSize: 13, color: '#4B5563', paddingHorizontal: 10, paddingBottom: 10 },
  empty: { padding: 40, alignItems: 'center' },
  emptyTxt: { color: '#9CA3AF', textAlign: 'center' }
});
