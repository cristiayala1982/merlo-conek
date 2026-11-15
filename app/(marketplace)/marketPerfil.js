import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, StatusBar, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';
import { obtenerPerfilUsuario } from '../../services/firebaseService';

export default function MarketPerfil() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      const unsub = obtenerPerfilUsuario(uid, (data) => {
        setPerfil(data);
        setLoading(false);
      });
      return () => unsub();
    }
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#FF6600" size="large" /></View>;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Actividad en Market</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Info Usuario */}
        <View style={styles.userCard}>
          <Image source={{ uri: perfil?.fotoUrl || 'https://picsum.photos/200' }} style={styles.avatar} />
          <View style={styles.userText}>
            <Text style={styles.userName}>{perfil?.nombre}</Text>
            <Text style={styles.userStats}>Vendedor en {perfil?.partido || perfil?.localidad || perfil?.ciudad || 'Ubicación no especificada'}</Text>
          </View>
        </View>

        {/* Menú de opciones */}
        <View style={styles.menuSection}>
           <OptionItem
            icon="list-outline"
            title="Mis Publicaciones"
            subtitle="Cosas que tienes a la venta"
            onPress={() => router.push('/(marketplace)/marketMisPublicaciones')}
           />
           <OptionItem
            icon="heart-outline"
            title="Mis Guardados"
            subtitle="Productos que te gustaron"
            onPress={() => router.push('/(marketplace)/marketMisGuardados')}
           />
           <OptionItem
            icon="checkmark-circle-outline"
            title="Ventas Finalizadas"
            subtitle="Historial de lo que ya vendiste"
            onPress={() => router.push('/(marketplace)/marketVentasFinalizadas')}
           />
           <OptionItem
            icon="star-outline"
            title="Calificaciones"
            subtitle="Lo que dicen otros compradores"
            onPress={() => router.push({ pathname: '/(marketplace)/marketCalificaciones', params: { userId: auth.currentUser.uid } })}
           />
        </View>

        <TouchableOpacity
          style={styles.venderBtnBig}
          onPress={() => router.push('/(marketplace)/marketVender')}
        >
            <Ionicons name="add-circle" size={24} color="white" />
            <Text style={styles.venderBtnText}>Publicar algo nuevo</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

function OptionItem({ icon, title, subtitle, onPress }) {
    return (
        <TouchableOpacity style={styles.optionItem} onPress={onPress}>
            <View style={styles.optionIconBg}>
                <Ionicons name={icon} size={22} color="#FF6600" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{title}</Text>
                <Text style={styles.optionSub}>{subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  backBtn: { padding: 5 },
  userCard: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FFFBF5', margin: 15, borderRadius: 20 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EEE' },
  userText: { marginLeft: 15 },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  userStats: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  menuSection: { paddingHorizontal: 15 },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB'
  },
  optionIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  optionTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  optionSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  venderBtnBig: {
    margin: 20,
    backgroundColor: '#FF6600',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5
  },
  venderBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
