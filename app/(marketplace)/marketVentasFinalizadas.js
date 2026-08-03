import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MarketVentasFinalizadas() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

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

  const renderProducto = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/(marketplace)/marketDetalle', params: { productId: item.id } })}
    >
      <Image source={{ uri: item.fotos[0] }} style={styles.foto} />
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ventas Finalizadas</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#FF6600" size="large" /></View>
      ) : (
        <FlatList
          data={productos}
          keyExtractor={(item) => item.id}
          renderItem={renderProducto}
          contentContainerStyle={styles.list}
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
