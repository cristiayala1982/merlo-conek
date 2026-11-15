import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, StatusBar, ActivityIndicator, Alert, Modal, Clipboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { subirArchivoConRuta } from '../../services/firebaseService';

export default function MarketPromocionar() {
  const router = useRouter();
  const { productId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [planSeleccionado, setPlanSeleccionado] = useState(null);
  const [paso, setPaso] = useState(1); // 1: Elegir plan, 2: Pago y comprobante
  const [comprobanteUri, setComprobanteUri] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const ALIAS_PAGO = "alfil.idea.angulo";

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }
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
      id: 'oro',
      titulo: 'Impulsar Publicación',
      sub: 'Más Visibilidad',
      beneficios: [
        'Prioridad sobre los anuncios comunes',
        'Etiqueta de "Destacado"',
        'Aparece en sugerencias'
      ],
      precio: '$ 1.000',
      color: '#FF6600',
      nivel: 1
    },
    {
      id: 'platino',
      titulo: 'Máximo Impulso',
      sub: 'Impacto Total',
      beneficios: [
        'Formato Gigante (Ancho completo)',
        'Prioridad absoluta arriba de todos',
        'Aparece primero en búsquedas'
      ],
      precio: '$ 2.500',
      color: '#FFB800',
      nivel: 2
    }
  ];

  const handleSeleccionarPlan = (plan) => {
    setPlanSeleccionado(plan);
    setPaso(2);
  };

  const handleSubirComprobante = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setComprobanteUri(result.assets[0].uri);
    }
  };

  const handleFinalizar = async () => {
    if (!comprobanteUri) {
      Alert.alert("Falta comprobante", "Por favor sube una captura del comprobante de transferencia.");
      return;
    }

    try {
      setEnviando(true);
      const uid = auth.currentUser.uid;

      // 1. Subir imagen del comprobante a Storage
      const storagePath = `pagos_publicidad/${uid}/${Date.now()}.jpg`;
      const urlComprobante = await subirArchivoConRuta(comprobanteUri, 'foto', storagePath);

      // 2. Crear solicitud en Firestore
      await addDoc(collection(db, 'solicitudes_publicidad'), {
        vendedorId: uid,
        vendedorNombre: auth.currentUser.displayName || 'Usuario de Conek',
        productoId: producto.id,
        productoTitulo: producto.titulo,
        productoFoto: producto.fotos[0],
        planId: planSeleccionado.id,
        planTitulo: planSeleccionado.titulo,
        nivelSolicitado: planSeleccionado.nivel,
        tipoContenido: 'market',
        comprobanteUrl: urlComprobante,
        estado: 'pendiente_verificacion',
        createdAt: serverTimestamp()
      });

      // 3. Marcar el producto como con publicidad pendiente para que el usuario vea el estado
      await updateDoc(doc(db, 'productos_market', producto.id), {
        publicidadPendiente: true
      });

      Alert.alert(
        "¡Recibido!",
        "Tu comprobante ha sido enviado. Revisaremos el pago y activaremos tu publicidad a la brevedad.",
        [{ text: "OK", onPress: () => router.replace('/(marketplace)/marketPerfil') }]
      );

    } catch (e) {
      console.log(e);
      Alert.alert("Error", "No se pudo enviar la solicitud. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const copiarAlias = () => {
    Clipboard.setString(ALIAS_PAGO);
    Alert.alert("Copiado", "El alias ha sido copiado al portapapeles.");
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#FF6600" size="large" /></View>;
  if (!producto) return <View style={styles.center}><Text>Producto no encontrado</Text></View>;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => paso === 1 ? router.back() : setPaso(1)} style={styles.backBtn}>
          <Ionicons name={paso === 1 ? "close" : "arrow-back"} size={26} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{paso === 1 ? "Impulsar Ventas" : "Realizar Pago"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {paso === 1 ? (
          <>
            <View style={styles.previewCard}>
              <Image source={{ uri: producto.fotos[0] }} style={styles.previewImg} />
              <View style={styles.previewInfo}>
                <Text style={styles.previewTitle} numberOfLines={1}>{producto.titulo}</Text>
                <Text style={styles.previewPrice}>${producto.precio}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Elegí un plan de impulso</Text>

            {planes.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[styles.planCard, { borderColor: plan.color }]}
                onPress={() => handleSeleccionarPlan(plan)}
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
          </>
        ) : (
          <View style={styles.pagoContainer}>
            <View style={styles.pagoCard}>
                <Text style={styles.pagoLabel}>Transferir a este Alias:</Text>
                <TouchableOpacity style={styles.aliasBox} onPress={copiarAlias}>
                    <Text style={styles.aliasTxt}>{ALIAS_PAGO}</Text>
                    <Ionicons name="copy-outline" size={20} color="#FF6600" />
                </TouchableOpacity>
                <Text style={styles.montoTxt}>Monto a pagar: <Text style={{fontWeight:'900'}}>{planSeleccionado.precio}</Text></Text>
            </View>

            <Text style={styles.instrucciones}>
                Una vez realizada la transferencia, subí aquí una captura de pantalla del comprobante para que podamos activarte el servicio.
            </Text>

            <TouchableOpacity style={styles.uploadBtn} onPress={handleSubirComprobante}>
                {comprobanteUri ? (
                    <Image source={{ uri: comprobanteUri }} style={styles.comprobantePreview} />
                ) : (
                    <View style={styles.uploadPlaceholder}>
                        <Ionicons name="camera-outline" size={40} color="#FF6600" />
                        <Text style={styles.uploadTxt}>Subir Comprobante</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.btnFinalizar, (!comprobanteUri || enviando) && { opacity: 0.5 }]}
                onPress={handleFinalizar}
                disabled={!comprobanteUri || enviando}
            >
                {enviando ? <ActivityIndicator color="white" /> : <Text style={styles.btnFinalizarText}>Enviar y Finalizar</Text>}
            </TouchableOpacity>
          </View>
        )}
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
  planCard: { borderRadius: 20, backgroundColor: 'white', marginBottom: 20, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, borderWidth: 1.5 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  planTitle: { color: 'white', fontWeight: '900', fontSize: 16, textTransform: 'uppercase' },
  planPrice: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  planBody: { padding: 20 },
  planSub: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 12 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  benefitText: { marginLeft: 10, fontSize: 13, color: '#6B7280' },
  pagoContainer: { alignItems: 'center' },
  pagoCard: { width: '100%', backgroundColor: '#FFFBF5', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#FFEDD5', marginBottom: 20 },
  pagoLabel: { fontSize: 14, color: '#6B7280', marginBottom: 10, textAlign: 'center' },
  aliasBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#FF6600', gap: 10 },
  aliasTxt: { fontSize: 18, fontWeight: '900', color: '#FF6600' },
  montoTxt: { fontSize: 16, color: '#1F2937', marginTop: 15, textAlign: 'center' },
  instrucciones: { fontSize: 14, color: '#4B5563', textAlign: 'center', lineHeight: 20, marginBottom: 25 },
  uploadBtn: { width: '100%', height: 200, borderRadius: 20, backgroundColor: '#F3F4F6', borderStyle: 'dashed', borderWidth: 2, borderColor: '#FF6600', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  uploadPlaceholder: { alignItems: 'center' },
  uploadTxt: { marginTop: 10, color: '#FF6600', fontWeight: 'bold' },
  comprobantePreview: { width: '100%', height: '100%', resizeMode: 'contain' },
  btnFinalizar: { backgroundColor: '#FF6600', width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnFinalizarText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
