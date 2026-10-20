import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, BackHandler, NativeModules, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../../firebaseConfig';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { subirArchivoConRuta, obtenerPerfilUsuario } from '../../../services/firebaseService';
import VistaPrevia from '../../../components/camara/VistaPrevia';
import { Modal } from 'react-native';

export default function NuevoClasificado() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [misOficios, setMisOficios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [perfil, setPerfil] = useState(null);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [barrio, setBarrio] = useState('');
  const [fotoUri, setFotoUri] = useState(null);
  const [textoSobreMedia, setTextoSobreMedia] = useState('');
  const [archivoCapturado, setArchivoCapturado] = useState(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      router.replace('/(tabs)/home');
      return;
    }

    const unsubPerfil = obtenerPerfilUsuario(uid, setPerfil);
    const q = query(collection(db, 'clasificados'), where('userId', '==', uid));
    const unsubOficios = onSnapshot(q, (snap) => {
      setMisOficios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCargando(false);
    });

    return () => {
      unsubPerfil();
      unsubOficios();
    };
  }, []);

  const abrirCamaraOGaleria = async () => {
    try {
      if (Platform.OS !== 'android') {
        const ImagePicker = require('expo-image-picker');
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });
        if (!result.canceled) setArchivoCapturado({ tipo: 'foto', uri: result.assets[0].uri });
        return;
      }

      const modulo = NativeModules.HistoriasLabNative;
      Alert.alert("Agregar foto", "¿Desde dónde quieres elegir la imagen?", [
        {
          text: "Cámara",
          onPress: async () => {
            if (modulo?.abrirCamaraHistorias) {
              const ruta = await modulo.abrirCamaraHistorias(true);
              if (ruta) setArchivoCapturado({ tipo: 'foto', uri: `file://${ruta}` });
            }
          }
        },
        {
          text: "Galería",
          onPress: async () => {
            const ImagePicker = require('expo-image-picker');
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
            if (!result.canceled) setArchivoCapturado({ tipo: 'foto', uri: result.assets[0].uri });
          }
        },
        { text: "Cancelar", style: "cancel" }
      ]);
    } catch (error) { console.log(error); }
  };

  const handleMediaEditada = (texto, uri) => {
    setFotoUri(uri);
    setTextoSobreMedia(texto);
    setArchivoCapturado(null);
  };

  const handlePublicar = async () => {
    if (!titulo || !descripcion || !barrio) {
      Alert.alert("Campos incompletos", "Por favor completá todos los campos.");
      return;
    }
    if (misOficios.length >= 5) {
      Alert.alert("Límite alcanzado", "Ya tenés 5 publicaciones. Borrá una para subir otra.");
      return;
    }

    setEnviando(true);
    try {
      const uid = auth.currentUser?.uid;
      let finalFotoUrl = null;
      if (fotoUri) {
        finalFotoUrl = await subirArchivoConRuta(fotoUri, 'foto', `clasificados/${uid}/${Date.now()}.jpg`);
      }

      await addDoc(collection(db, 'clasificados'), {
        userId: uid,
        userName: perfil?.nombre || 'Usuario',
        userPhoto: perfil?.fotoUrl || null,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        barrio: barrio.trim(),
        fotoServicio: finalFotoUrl,
        textoSobreMedia: textoSobreMedia,
        provincia: perfil?.provincia || '',
        localidad: perfil?.localidad || '',
        createdAt: serverTimestamp()
      });

      setTitulo(''); setDescripcion(''); setBarrio(''); setFotoUri(null); setTextoSobreMedia('');
      Alert.alert("¡Éxito!", "Tu oficio ha sido publicado.");
    } catch (e) { Alert.alert("Error", "No se pudo publicar."); }
    finally { setEnviando(false); }
  };

  const confirmarEliminar = (id) => {
    Alert.alert("Eliminar", "¿Borrar este anuncio?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => deleteDoc(doc(db, 'clasificados', id)) }
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Publicar Oficio</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : null}
        style={{ flex: 1 }}
      >
        <FlatList
          data={misOficios}
          keyExtractor={item => item.id}
          ListHeaderComponent={
            <View style={styles.content}>
              <View style={styles.userSection}>
                {perfil?.fotoUrl ? (
                  <Image source={{ uri: perfil.fotoUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}><Ionicons name="person" size={20} color="#9CA3AF" /></View>
                )}
                <View>
                  <Text style={styles.userName}>{perfil?.nombre || 'Usuario'}</Text>
                  <Text style={styles.userSub}>{perfil?.localidad || 'Merlo'}</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>
                {misOficios.length >= 5 ? "Límite alcanzado (5/5)" : "Detalles del servicio"}
              </Text>

              {misOficios.length < 5 ? (
                <View style={styles.form}>
                  <TouchableOpacity style={styles.mediaPicker} onPress={abrirCamaraOGaleria}>
                    {fotoUri ? (
                      <View style={styles.previewWrap}>
                        <Image source={{ uri: fotoUri }} style={styles.previewImg} />
                        {textoSobreMedia ? <Text style={styles.overlayText} numberOfLines={2}>{textoSobreMedia}</Text> : null}
                        <TouchableOpacity style={styles.removeImg} onPress={() => {setFotoUri(null); setTextoSobreMedia('');}}>
                          <Ionicons name="close-circle" size={24} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.pickerPlaceholder}>
                        <Ionicons name="camera-outline" size={32} color="#6B7280" />
                        <Text style={styles.pickerTxt}>Agregar foto del trabajo</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TextInput
                    style={styles.input}
                    placeholder="¿Qué hacés? (ej: Plomero Matrículado)"
                    placeholderTextColor="#9CA3AF"
                    value={titulo}
                    onChangeText={setTitulo}
                  />
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Descripción y contacto..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    value={descripcion}
                    onChangeText={setDescripcion}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Barrio (ej: Pompeya)"
                    placeholderTextColor="#9CA3AF"
                    value={barrio}
                    onChangeText={setBarrio}
                  />

                  <TouchableOpacity
                    style={[styles.btnPublicar, enviando && { opacity: 0.6 }]}
                    onPress={handlePublicar}
                    disabled={enviando}
                  >
                    {enviando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Publicar Ahora</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.limitBox}>
                  <Ionicons name="warning" size={20} color="#B45309" />
                  <Text style={styles.limitTxt}>Ya tenés 5 anuncios. Borrá uno de la lista de abajo para publicar otro.</Text>
                </View>
              )}

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Tus anuncios actuales ({misOficios.length}/5)</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.oficioItem}>
              {item.fotoServicio && <Image source={{ uri: item.fotoServicio }} style={styles.itemThumb} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.oficioTitle}>{item.titulo}</Text>
                <Text style={styles.oficioBarrio}>{item.barrio}</Text>
              </View>
              <TouchableOpacity onPress={() => confirmarEliminar(item.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          keyboardShouldPersistTaps="handled"
        />
      </KeyboardAvoidingView>

      <Modal visible={!!archivoCapturado} animationType="slide">
        {archivoCapturado && (
          <VistaPrevia
            archivo={archivoCapturado}
            onDescartar={() => setArchivoCapturado(null)}
            onPublicar={handleMediaEditada}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  backBtn: { padding: 4 },
  content: { padding: 16 },
  userSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  userSub: { fontSize: 12, color: '#6B7280' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#374151', marginBottom: 15 },
  form: { gap: 12 },
  mediaPicker: { width: '100%', height: 160, backgroundColor: '#F3F4F6', borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, borderColor: '#D1D5DB', overflow: 'hidden' },
  pickerPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  pickerTxt: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  previewWrap: { flex: 1, position: 'relative' },
  previewImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  overlayText: { position: 'absolute', bottom: 10, left: 10, right: 10, color: 'white', fontWeight: 'bold', fontSize: 14, textAlign: 'center', textShadowColor: 'black', textShadowRadius: 3, backgroundColor: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 4 },
  removeImg: { position: 'absolute', top: 8, right: 8, backgroundColor: 'white', borderRadius: 12 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 15, color: '#111827' },
  textArea: { height: 100, textAlignVertical: 'top' },
  btnPublicar: { backgroundColor: '#059669', height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 2 },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  limitBox: { flexDirection: 'row', backgroundColor: '#FFFBEB', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FEF3C7', alignItems: 'center', gap: 10 },
  limitTxt: { flex: 1, color: '#B45309', fontSize: 14, lineHeight: 20 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 25 },
  oficioItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F3F4F6', gap: 12 },
  itemThumb: { width: 50, height: 50, borderRadius: 8 },
  oficioTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  oficioBarrio: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  deleteBtn: { padding: 8 }
});
