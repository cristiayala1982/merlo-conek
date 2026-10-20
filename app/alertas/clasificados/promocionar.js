import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, StatusBar, ActivityIndicator, Alert, Modal, Clipboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { subirArchivoConRuta } from '../../../services/firebaseService';

export default function ClasificadosPromocionar() {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [oficio, setOficio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paso, setPaso] = useState(1); // 1: Info, 2: Pago
  const [comprobanteUri, setComprobanteUri] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const ALIAS_PAGO = "alfil.idea.angulo";
  const PRECIO_PLAN = "$ 1.000";

  useEffect(() => {
    if (!postId) {
      setLoading(false);
      return;
    }
    const fetchOficio = async () => {
      try {
        const snap = await getDoc(doc(db, 'clasificados', postId));
        if (snap.exists()) setOficio({ id: snap.id, ...snap.data() });
        setLoading(false);
      } catch (e) { console.log(e); setLoading(false); }
    };
    fetchOficio();
  }, [postId]);

  const handleSubirComprobante = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setComprobanteUri(result.assets[0].uri);
  };

  const handleFinalizar = async () => {
    if (!comprobanteUri) {
      Alert.alert("Falta comprobante", "Por favor sube una captura del comprobante de transferencia.");
      return;
    }

    try {
      setEnviando(true);
      const uid = auth.currentUser.uid;

      // 1. Subir imagen del comprobante
      const storagePath = `pagos_clasificados/${uid}/${Date.now()}.jpg`;
      const urlComprobante = await subirArchivoConRuta(comprobanteUri, 'foto', storagePath);

      // 2. Crear solicitud
      await addDoc(collection(db, 'solicitudes_publicidad'), {
        vendedorId: uid,
        vendedorNombre: auth.currentUser.displayName || 'Profesional de Conek',
        productoId: oficio.id,
        productoTitulo: oficio.titulo,
        productoFoto: oficio.fotosServicio?.[0] || oficio.fotoServicio || null,
        planId: 'impulso_oficio',
        planTitulo: 'Impulsar Servicio',
        nivelSolicitado: 1,
        tipoContenido: 'clasificado',
        comprobanteUrl: urlComprobante,
        estado: 'pendiente_verificacion',
        createdAt: serverTimestamp()
      });

      // 3. Marcar pendiente
      await updateDoc(doc(db, 'clasificados', oficio.id), {
        publicidadPendiente: true
      });

      Alert.alert(
        "¡Recibido!",
        "Tu comprobante ha sido enviado. Revisaremos el pago y activaremos tu impulso a la brevedad.",
        [{ text: "OK", onPress: () => router.replace('/alertas/clasificados/nuevo') }]
      );

    } catch (e) {
      console.log(e);
      Alert.alert("Error", "No se pudo procesar la solicitud.");
    } finally {
      setEnviando(false);
    }
  };

  const copiarAlias = () => {
    Clipboard.setString(ALIAS_PAGO);
    Alert.alert("Copiado", "El alias ha sido copiado al portapapeles.");
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#10B981" size="large" /></View>;
  if (!oficio) return <View style={styles.center}><Text>Anuncio no encontrado</Text></View>;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => paso === 1 ? router.back() : setPaso(1)} style={styles.backBtn}>
          <Ionicons name={paso === 1 ? "close" : "arrow-back"} size={26} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{paso === 1 ? "Impulsar Oficio" : "Realizar Pago"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {paso === 1 ? (
          <>
            <View style={styles.previewCard}>
              <Ionicons name="rocket" size={32} color="#10B981" />
              <View style={styles.previewInfo}>
                <Text style={styles.previewTitle} numberOfLines={1}>{oficio.titulo}</Text>
                <Text style={styles.previewPrice}>Plan Profesional</Text>
              </View>
            </View>

            <View style={styles.infoPlanCard}>
                <Text style={styles.planTitle}>Plan Impulsar</Text>
                <Text style={styles.planPrice}>{PRECIO_PLAN}</Text>
                <View style={styles.divider} />
                <View style={styles.benefitRow}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={styles.benefitText}>Aparece primero en la lista de oficios</Text>
                </View>
                <View style={styles.benefitRow}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={styles.benefitText}>Recuadro destacado con borde verde</Text>
                </View>
                <View style={styles.benefitRow}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={styles.benefitText}>Más llamadas y consultas por chat</Text>
                </View>
            </View>

            <TouchableOpacity style={styles.btnContinuar} onPress={() => setPaso(2)}>
                <Text style={styles.btnContinuarText}>Continuar al Pago</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.pagoContainer}>
            <View style={styles.pagoCard}>
                <Text style={styles.pagoLabel}>Transferir a este Alias:</Text>
                <TouchableOpacity style={styles.aliasBox} onPress={copiarAlias}>
                    <Text style={styles.aliasTxt}>{ALIAS_PAGO}</Text>
                    <Ionicons name="copy-outline" size={20} color="#10B981" />
                </TouchableOpacity>
                <Text style={styles.montoTxt}>Monto: <Text style={{fontWeight:'900'}}>{PRECIO_PLAN}</Text></Text>
            </View>

            <Text style={styles.instrucciones}>
                Subí una captura del comprobante para activar tu impulso.
            </Text>

            <TouchableOpacity style={styles.uploadBtn} onPress={handleSubirComprobante}>
                {comprobanteUri ? (
                    <Image source={{ uri: comprobanteUri }} style={styles.comprobantePreview} />
                ) : (
                    <View style={styles.uploadPlaceholder}>
                        <Ionicons name="camera-outline" size={40} color="#10B981" />
                        <Text style={styles.uploadTxt}>Subir Comprobante</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.btnFinalizar, (!comprobanteUri || enviando) && { opacity: 0.5 }]}
                onPress={handleFinalizar}
                disabled={!comprobanteUri || enviando}
            >
                {enviando ? <ActivityIndicator color="white" /> : <Text style={styles.btnFinalizarText}>Enviar Comprobante</Text>}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  backBtn: { padding: 5 },
  scroll: { padding: 20 },
  previewCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 15, padding: 15, marginBottom: 25 },
  previewInfo: { marginLeft: 15 },
  previewTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  previewPrice: { fontSize: 13, color: '#10B981', fontWeight: '800', marginTop: 2 },
  infoPlanCard: { padding: 25, borderRadius: 20, backgroundColor: 'white', borderWidth: 2, borderColor: '#10B981', marginBottom: 30, elevation: 2 },
  planTitle: { fontSize: 20, fontWeight: '900', color: '#111827', textAlign: 'center' },
  planPrice: { fontSize: 24, fontWeight: '900', color: '#10B981', textAlign: 'center', marginTop: 5 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 20 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  benefitText: { marginLeft: 12, fontSize: 14, color: '#4B5563', fontWeight: '600' },
  btnContinuar: { backgroundColor: '#10B981', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  btnContinuarText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  pagoContainer: { alignItems: 'center' },
  pagoCard: { width: '100%', backgroundColor: '#F0FDF4', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#DCFCE7', marginBottom: 20 },
  pagoLabel: { fontSize: 14, color: '#6B7280', marginBottom: 10, textAlign: 'center' },
  aliasBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#10B981', gap: 10 },
  aliasTxt: { fontSize: 18, fontWeight: '900', color: '#10B981' },
  montoTxt: { fontSize: 16, color: '#1F2937', marginTop: 15, textAlign: 'center' },
  instrucciones: { fontSize: 14, color: '#4B5563', textAlign: 'center', lineHeight: 20, marginBottom: 25 },
  uploadBtn: { width: '100%', height: 200, borderRadius: 20, backgroundColor: '#F3F4F6', borderStyle: 'dashed', borderWidth: 2, borderColor: '#10B981', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  uploadPlaceholder: { alignItems: 'center' },
  uploadTxt: { marginTop: 10, color: '#10B981', fontWeight: 'bold' },
  comprobantePreview: { width: '100%', height: '100%', resizeMode: 'contain' },
  btnFinalizar: { backgroundColor: '#10B981', width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnFinalizarText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});