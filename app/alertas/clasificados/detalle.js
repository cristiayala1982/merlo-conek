import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Dimensions, Linking, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../firebaseConfig';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SelectorCompartir from '../../../components/compartir/SelectorCompartir';
import { getClasificadoPayload, clearClasificadoPayload } from '../../../services/clasificadosState';

const { width } = Dimensions.get('window');

export default function ClasificadoDetalleScreen() {
  const { postId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const payload = getClasificadoPayload();

  // PRIORIDAD INMEDIATA: Si tenemos el payload, cargamos sin esperar al loading
  const [item, setItem] = useState(payload || null);
  const [loading, setLoading] = useState(!payload);
  const [fotoActiva, setFotoActiva] = useState(0);
  const [mostrarCompartir, setMostrarCompartir] = useState(false);

  const miUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!postId) return;

    const unsub = onSnapshot(doc(db, 'clasificados', postId), (snap) => {
      if (snap.exists()) {
        setItem({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    });

    return () => {
      unsub();
      clearClasificadoPayload();
    };
  }, [postId]);

  const irAlChat = () => {
    if (!item) return;
    const mensajePrevia = `[CLASIFICADOS] ¡Hola! Vi tu anuncio: "${item.titulo}"`;
    router.push({ pathname: '/chats', params: { userId: item.userId, prefilledMsg: mensajePrevia } });
  };

  const abrirMapaExterno = () => {
    if (!item?.coords) return;
    const { latitude, longitude } = item.coords;
    const label = encodeURIComponent(`Servicio: ${item.titulo}`);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`
    });
    Linking.openURL(url).catch(() => Alert.alert("Error", "No se pudo abrir el mapa."));
  };

  if (loading && !item) return <View style={styles.center}><ActivityIndicator size="large" color="#059669" /></View>;
  if (!item) return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={60} color="#CCC" />
      <Text style={styles.errorTxt}>El anuncio ya no está disponible.</Text>
      <TouchableOpacity style={styles.btnVolver} onPress={() => router.back()}><Text style={styles.btnVolverTxt}>Volver</Text></TouchableOpacity>
    </View>
  );

  const fotos = item.fotosServicio || [item.fotoServicio];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}><Ionicons name="arrow-back" size={28} color="#111827" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle del Servicio</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.carouselContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => setFotoActiva(Math.round(e.nativeEvent.contentOffset.x / width))}
            scrollEventThrottle={16}
          >
            {fotos.filter(Boolean).map((f, i) => (
              <View key={i} style={styles.carouselPage}>
                <Image
                  source={{ uri: f }}
                  placeholder={{ uri: item.thumbnailLqUrls?.[i] || null }}
                  placeholderContentFit="cover"
                  style={styles.carouselImage}
                  contentFit="cover"
                  transition={200}
                />
              </View>
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
              {item.userPhoto ? (
                <Image source={{ uri: item.userPhoto }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}><Ionicons name="person" size={24} color="#9CA3AF" /></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{item.userName}</Text>
                <Text style={styles.userLoc}>{item.provincia}, {item.partido}, {item.localidad}{item.barrio ? ` (${item.barrio})` : ''}</Text>
              </View>
              <View style={styles.actionsRow}>
                {item.userId !== miUid && <TouchableOpacity style={styles.btnChatCompact} onPress={irAlChat}><Ionicons name="chatbubble-ellipses" size={26} color="#FFF" /></TouchableOpacity>}
                <TouchableOpacity style={styles.btnShare} onPress={() => setMostrarCompartir(true)}><Ionicons name="share-social" size={24} color="#059669" /></TouchableOpacity>
              </View>
           </View>

           <View style={styles.titleRowDetail}>
              <Text style={styles.tituloDetail}>{item.titulo}</Text>
              {item.publicidadPendiente && item.userId === miUid && (
                <View style={styles.detailPendingBadge}>
                  <Ionicons name="time" size={12} color="#B45309" />
                  <Text style={styles.detailPendingBadgeText}>ESPERANDO APROBACIÓN</Text>
                </View>
              )}
           </View>
           <View style={styles.detailDivider} />
           <Text style={styles.descripcionDetail}>{item.descripcion}</Text>

           {item.coords && (
             <TouchableOpacity style={styles.mapBtn} onPress={abrirMapaExterno}>
               <View style={styles.mapIconBg}><Ionicons name="map" size={20} color="white" /></View>
               <View><Text style={styles.mapBtnTitle}>Ver ubicación del servicio</Text><Text style={styles.mapBtnSub}>Abrir en Google Maps</Text></View>
               <Ionicons name="chevron-forward" size={20} color="#CCC" style={{ marginLeft: 'auto' }} />
             </TouchableOpacity>
           )}

           <View style={styles.infoInfoBox}>
             <Ionicons name="information-circle-outline" size={20} color="#059669" />
             <Text style={styles.infoInfoText}>Merlo Conek facilita el contacto. El acuerdo del servicio es responsabilidad de las partes.</Text>
           </View>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <SelectorCompartir
        visible={mostrarCompartir}
        onClose={() => setMostrarCompartir(false)}
        contenido={{ id: item.id, tipo: 'clasificado', titulo: item.titulo, imagen: fotos[0], subTitulo: item.userName }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  closeBtn: { padding: 4 },
  carouselContainer: { width, height: 350, backgroundColor: '#F3F4F6', position: 'relative' },
  carouselPage: { width, height: 350 }, carouselImage: { width: '100%', height: '100%' },
  dotsRow: { position: 'absolute', bottom: 15, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 24, backgroundColor: '#FFF' },
  content: { padding: 20 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 25 },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#059669' },
  avatarPlaceholder: { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  userName: { fontSize: 18, fontWeight: '900', color: '#111827' },
  userLoc: { fontSize: 14, color: '#6B7280', fontWeight: '700' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnChatCompact: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center', elevation: 3 },
  btnShare: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#059669', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  titleRowDetail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  tituloDetail: { fontSize: 24, fontWeight: '900', color: '#111827' },
  detailPendingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEDD5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#FFB800' },
  detailPendingBadgeText: { fontSize: 10, fontWeight: '900', color: '#B45309', marginLeft: 4 },
  detailDivider: { height: 4, width: 40, backgroundColor: '#059669', borderRadius: 2, marginBottom: 15 },
  descripcionDetail: { fontSize: 16, color: '#374151', lineHeight: 24, marginBottom: 20 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 15, borderRadius: 15, gap: 15, marginBottom: 20, borderWidth: 1, borderColor: '#EEE' },
  mapIconBg: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center' },
  mapBtnTitle: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  mapBtnSub: { fontSize: 12, color: '#6B7280' },
  infoInfoBox: { flexDirection: 'row', backgroundColor: '#F0FDF4', padding: 15, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#059669', gap: 10 },
  infoInfoText: { flex: 1, fontSize: 13, color: '#065F46', lineHeight: 18, fontStyle: 'italic' },
  errorTxt: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginTop: 20 },
  btnVolver: { marginTop: 20, backgroundColor: '#059669', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  btnVolverTxt: { color: 'white', fontWeight: 'bold' }
});
