import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, StatusBar } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { HaloUserIcon } from '../../components/icons/HaloIcons';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { obtenerPerfilUsuario } from '../../services/firebaseService';

export default function MarketCalificaciones() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [calificaciones, setCalificaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usuario, setUsuario] = useState(null);
  const [miPerfil, setMiPerfil] = useState(null);

  const targetId = userId || auth.currentUser?.uid;

  useEffect(() => {
    if (!targetId) return;

    // Cargar mi perfil para la cabecera
    const miUid = auth.currentUser?.uid;
    if (miUid) obtenerPerfilUsuario(miUid, setMiPerfil);

    // Cargar info del usuario
    const fetchUser = async () => {
        const uSnap = await getDoc(doc(db, 'usuarios', targetId));
        if (uSnap.exists()) setUsuario(uSnap.data());
    };
    fetchUser();

    // Cargar calificaciones
    const q = query(
      collection(db, 'usuarios', targetId, 'calificaciones_market'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCalificaciones(data);
      setLoading(false);
    });

    return () => unsub();
  }, [targetId]);

  const renderCalificacion = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(s => (
                <Ionicons key={s} name={s <= item.estrellas ? "star" : "star-outline"} size={16} color="#FFB800" />
            ))}
        </View>
        <Text style={styles.fecha}>{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Reciente'}</Text>
      </View>
      <Text style={styles.comentario}>{item.comentario || "Sin comentarios."}</Text>
      <Text style={styles.comprador}>— {item.compradorNombre || 'Usuario'}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* HEADER RÁPIDO */}
      <View style={[styles.navBar, { paddingTop: insets.top }]}>
        <View style={styles.navContent}>
          <TouchableOpacity onPress={() => router.replace('/(marketplace)')} style={styles.navIconBtn}>
            <Ionicons name="home" size={28} color="#FF6600" />
          </TouchableOpacity>

          <Text style={styles.navTitle}>Calificaciones</Text>

          <TouchableOpacity onPress={() => router.push('/(marketplace)/marketPerfil')} style={styles.navProfileBtn}>
            {miPerfil?.fotoUrl ? (
              <Image source={{ uri: miPerfil.fotoUrl }} style={styles.navAvatar} />
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
          data={calificaciones}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.summary}>
                <Text style={styles.summaryTitle}>Reputación de {usuario?.nombre}</Text>
                <View style={styles.bigStarsRow}>
                    <Text style={styles.ratingNum}>{usuario?.reputacion?.toFixed(1) || '0.0'}</Text>
                    <Ionicons name="star" size={24} color="#FFB800" />
                </View>
                <Text style={styles.totalSales}>{usuario?.totalVentas || 0} ventas concretadas</Text>
            </View>
          }
          renderItem={renderCalificacion}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="star-outline" size={60} color="#EEE" />
              <Text style={styles.emptyTxt}>Aún no tiene calificaciones.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // ESTILOS NAV BAR RÁPIDA
  navBar: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
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
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  backBtn: { padding: 5 },
  summary: { alignItems: 'center', padding: 30, backgroundColor: '#FFFBF5', marginBottom: 20 },
  summaryTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  bigStarsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  ratingNum: { fontSize: 32, fontWeight: '900', color: '#111827' },
  totalSales: { fontSize: 14, color: '#6B7280', marginTop: 5 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  starsRow: { flexDirection: 'row', gap: 2 },
  fecha: { fontSize: 12, color: '#9CA3AF' },
  comentario: { fontSize: 15, color: '#374151', lineHeight: 22 },
  comprador: { fontSize: 13, color: '#6B7280', marginTop: 10, fontStyle: 'italic' },
  empty: { alignItems: 'center', marginTop: 50 },
  emptyTxt: { color: '#9CA3AF', marginTop: 15, fontSize: 16 }
});
