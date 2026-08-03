import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MarketPromocionar() {
  const router = useRouter();
  const { productId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [planSeleccionado, setPlanSeleccionado] = useState(null);

  useEffect(() => {
    if (!productId) return;
    const fetchProd = async () => {
      try {
        const snap = await getDoc(doc(db, 'productos_market', productId));
        if (snap.exists()) setProducto({ id: snap.id, ...snap.data() });
        setLoading(false);
      } catch (e) { console.log(e); setLoading(false); }
    };
    fetchProd();
  }, [productId]);

  const planes = [
    {
      id: 'bronce',
      titulo: 'Plan Bronce',
      sub: 'Gratuito',
      beneficios: ['Aparece en el muro', 'Búsqueda por categoría'],
      precio: 'GRATIS',
      color: '#CD7F32',
      nivel: 0
    },
    {
      id: 'oro',
      titulo: 'Plan Oro',
      sub: 'Destacado',
      beneficios: ['Prioridad sobre los gratis', 'Etiqueta de "Destacado"', 'Más visualizaciones'],
      precio: '$ Consultar',
      color: '#FFB800',
      nivel: 1
    },
    {
      id: 'platino',
      titulo: 'Plan Platino',
      sub: 'Ultra Visibilidad',
      beneficios: ['Máximo tamaño (1 columna)', 'Prioridad absoluta arriba de todos', 'Etiqueta "Premium"'],
      precio: '$ Consultar',
      color: '#374151',
      nivel: 2
    }
  ];

  const handleContinuar = () => {
    if (!planSeleccionado) {
      Alert.alert("Selecciona un plan", "Por favor elige uno de los planes para continuar.");
      return;
    }

    Alert.alert(
      "¡Excelente elección!",
      `Has seleccionado el ${planSeleccionado.titulo}. Para activar la publicidad, por favor realiza el pago en nuestra sección de Pagos y Reportes.\n\nUna vez verificado, tu anuncio será impulsado.`,
      [{ text: "Entendido", onPress: () => router.back() }]
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#FF6600" size="large" /></View>;
  if (!producto) return <View style={styles.center}><Text>Producto no encontrado</Text></TouchableOpacity>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promocionar</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Preview del Producto */}
        <View style={styles.previewCard}>
          <Image source={{ uri: producto.fotos[0] }} style={styles.previewImg} />
          <View style={styles.previewInfo}>
            <Text style={styles.previewTitle} numberOfLines={1}>{producto.titulo}</Text>
            <Text style={styles.previewPrice}>${producto.precio}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Elegí un plan para vender más rápido</Text>

        {planes.map((plan) => (
          <TouchableOpacity
            key={plan.id}
            style={[
                styles.planCard,
                planSeleccionado?.id === plan.id && { borderColor: plan.color, borderWidth: 2, backgroundColor: plan.color + '08' }
            ]}
            onPress={() => setPlanSeleccionado(plan)}
          >
            <View style={[styles.planHeader, { backgroundColor: plan.color }]}>
              <Text style={styles.planTitle}>{plan.titulo}</Text>
              <Text style={styles.planPrice}>{plan.precio}</Text>
            </View>
            <View style={styles.planBody}>
              <Text style={styles.planSub}>{plan.sub}</Text>
              {plan.beneficios.map((b, i) => (
                <View key={i} style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={16} color={plan.color} />
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.btnContinuar} onPress={handleContinuar}>
          <Text style={styles.btnContinuarText}>Continuar</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  backBtn: { padding: 5 },
  scroll: { padding: 20 },
  previewCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 15, padding: 10, marginBottom: 25 },
  previewImg: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#EEE' },
  previewInfo: { marginLeft: 15 },
  previewTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  previewPrice: { fontSize: 14, color: '#FF6600', fontWeight: '900', marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#111827', textAlign: 'center', marginBottom: 25 },
  planCard: { borderRadius: 20, backgroundColor: 'white', marginBottom: 20, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, borderWidth: 1, borderColor: '#F3F4F6' },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  planTitle: { color: 'white', fontWeight: '900', fontSize: 16, textTransform: 'uppercase' },
  planPrice: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  planBody: { padding: 20 },
  planSub: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 12 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  benefitText: { marginLeft: 10, fontSize: 13, color: '#6B7280' },
  btnContinuar: { backgroundColor: '#FF6600', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 20, marginBottom: 40 },
  btnContinuarText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
