import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../firebaseConfig';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function ClasificadoDetalleScreen() {
  const { postId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fotoActiva, setFotoActiva] = useState(0);

  useEffect(() => {
    if (!postId) return;
    const unsub = onSnapshot(doc(db, 'clasificados', postId), (snap) => {
      if (snap.exists()) setItem({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
    return () => unsub();
  }, [postId]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#059669" /></View>;
  if (!item) return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={60} color="#CCC" />
      <Text style={styles.errorTxt}>Este anuncio ya no está disponible.</Text>
      <TouchableOpacity style={styles.btnVolver} onPress={() => router.back()}><Text style={styles.btnVolverTxt}>Volver</Text></TouchableOpacity>
    </View>
  );

  const fotos = item.fotosServicio || [item.fotoServicio];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="arrow-back" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle del Clasificado</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.carouselContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => setFotoActiva(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {fotos.filter(Boolean).map((f, i) => (
              <Image key={i} source={{ uri: f }} style={styles.carouselImage} contentFit="cover" />
            ))}
          </ScrollView>
          {fotos.length > 1 && (
            <View style={styles.dotsRow}>
              {fotos.map((_, i) => <View key={i} style={[styles.dot, fotoActiva === i && styles.dotActive]} />)}
            </View>
          )}
        </View>

        <View style={styles.content}>
           <View style={styles.userRow}>
              <Image source={{ uri: item.userPhoto }} style={styles.avatar} />
              <View>
                <Text style={styles.userName}>{item.userName}</Text>
                <Text style={styles.userLoc}>{item.barrio}, {item.localidad}</Text>
              </View>
           </View>

           <Text style={styles.titulo}>{item.titulo}</Text>
           <View style={styles.divider} />
           <Text style={styles.descripcion}>{item.descripcion}</Text>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  carouselContainer: { width, height: 350, backgroundColor: '#F3F4F6' },
  carouselImage: { width, height: 350 },
  dotsRow: { position: 'absolute', bottom: 15, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 24, backgroundColor: '#FFF' },
  content: { padding: 20 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#059669' },
  userName: { fontSize: 18, fontWeight: '900', color: '#111827' },
  userLoc: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  titulo: { fontSize: 24, fontWeight: '900', color: '#111827', marginBottom: 10 },
  divider: { height: 4, width: 40, backgroundColor: '#059669', borderRadius: 2, marginBottom: 15 },
  descripcion: { fontSize: 16, color: '#374151', lineHeight: 24 },
  errorTxt: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginTop: 20 },
  btnVolver: { marginTop: 20, backgroundColor: '#059669', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  btnVolverTxt: { color: 'white', fontWeight: 'bold' }
});