import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, NativeModules, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { subirArchivoConRuta, obtenerPerfilUsuario } from '../../services/firebaseService';
import VistaPrevia from '../../components/camara/VistaPrevia';

export default function NuevaHuellita() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [misAvisos, setMisAvisos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [perfil, setPerfil] = useState(null);

  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState('perdido'); // 'perdido', 'encontrado', 'adopcion'
  const [especie, setEspecie] = useState('Perro');
  const [sexo, setSexo] = useState('Macho');
  const [descripcion, setDescripcion] = useState('');
  const [barrio, setBarrio] = useState('');
  const [fotosUris, setFotosUris] = useState([]);
  const [archivoCapturado, setArchivoCapturado] = useState(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubPerfil = obtenerPerfilUsuario(uid, setPerfil);
    const q = query(collection(db, 'mascotas'), where('userId', '==', uid), orderBy('createdAt', 'desc'));
    const unsubAvisos = onSnapshot(q, (snap) => {
      setMisAvisos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCargando(false);
    });
    return () => { unsubPerfil(); unsubAvisos(); };
  }, []);

  const abrirCamaraOGaleria = async () => {
    if (fotosUris.length >= 4) { Alert.alert("Límite", "Máximo 4 fotos."); return; }
    try {
      if (Platform.OS !== 'android') {
        const ImagePicker = require('expo-image-picker');
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7 });
        if (!result.canceled) setArchivoCapturado({ tipo: 'foto', uri: result.assets[0].uri });
        return;
      }
      const modulo = NativeModules.HistoriasLabNative;
      Alert.alert("Agregar foto", "¿Desde dónde?", [
        { text: "Cámara", onPress: async () => { if (modulo?.abrirCamaraHistorias) { const ruta = await modulo.abrirCamaraHistorias(true); if (ruta) setArchivoCapturado({ tipo: 'foto', uri: `file://${ruta}` }); } } },
        { text: "Galería", onPress: async () => { const ImagePicker = require('expo-image-picker'); const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 }); if (!result.canceled) setArchivoCapturado({ tipo: 'foto', uri: result.assets[0].uri }); } },
        { text: "Cancelar", style: "cancel" }
      ]);
    } catch (error) { console.log(error); }
  };

  const handleMediaEditada = (texto, uri) => {
    setFotosUris(prev => [...prev, uri]);
    setArchivoCapturado(null);
  };

  const handlePublicar = async () => {
    if (!descripcion || !barrio) { Alert.alert("Faltan datos", "Por favor indica el barrio y una descripción."); return; }
    if (fotosUris.length === 0) { Alert.alert("Falta foto", "Sube al menos una foto de la mascota."); return; }

    setEnviando(true);
    try {
      const uid = auth.currentUser.uid;
      const promesas = fotosUris.map((uri, i) => subirArchivoConRuta(uri, 'foto', `mascotas/${uid}/${Date.now()}_${i}.jpg`));
      const urls = await Promise.all(promesas);

      await addDoc(collection(db, 'mascotas'), {
        nombre: nombre.trim(),
        estado,
        especie,
        sexo,
        descripcion: descripcion.trim(),
        barrio: barrio.trim(),
        fotos: urls,
        userId: uid,
        userName: perfil?.nombre || 'Protector',
        userPhoto: perfil?.fotoUrl || null,
        localidad: perfil?.localidad || 'Merlo',
        provincia: perfil?.provincia || 'Buenos Aires',
        createdAt: serverTimestamp()
      });

      Alert.alert("¡Publicado!", "Tu aviso ya está en la sección de Huellitas.");
      router.back();
    } catch (e) { console.log(e); Alert.alert("Error", "No se pudo publicar."); }
    finally { setEnviando(false); }
  };

  const confirmarEliminar = (id) => {
    Alert.alert("Eliminar", "¿Borrar este aviso?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => deleteDoc(doc(db, 'mascotas', id)) }
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="close" size={32} color="#333" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Publicar en Huellitas</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>¿Qué pasó?</Text>
        <View style={styles.pickerRow}>
          <SelectorBtn label="Se perdió" active={estado === 'perdido'} onPress={() => setEstado('perdido')} color="#EF4444" />
          <SelectorBtn label="Lo encontré" active={estado === 'encontrado'} onPress={() => setEstado('encontrado')} color="#3B82F6" />
          <SelectorBtn label="Adopción" active={estado === 'adopcion'} onPress={() => setEstado('adopcion')} color="#10B981" />
        </View>

        <Text style={styles.label}>Fotos (Máximo 4)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
          {fotosUris.map((uri, index) => (
             <View key={index} style={styles.photoBox}>
                <Image source={{ uri }} style={styles.thumbnail} />
                <TouchableOpacity style={styles.removeBtn} onPress={() => setFotosUris(prev => prev.filter((_, i) => i !== index))}>
                   <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
             </View>
          ))}
          {fotosUris.length < 4 && (
            <TouchableOpacity style={styles.addPhoto} onPress={abrirCamaraOGaleria}>
              <Ionicons name="camera" size={30} color="#9CA3AF" />
              <Text style={{ fontSize: 10, color: '#9CA3AF' }}>Subir</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <TextInput style={styles.input} placeholder="Nombre de la mascota (si lo sabes)" value={nombre} onChangeText={setNombre} />

        <View style={styles.pickerRow}>
           <View style={{ flex: 1 }}>
              <Text style={styles.label}>Especie</Text>
              <TextInput style={styles.input} placeholder="Perro, Gato, etc." value={especie} onChangeText={setEspecie} />
           </View>
           <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.label}>Sexo</Text>
              <TextInput style={styles.input} placeholder="Macho, Hembra" value={sexo} onChangeText={setSexo} />
           </View>
        </View>

        <Text style={styles.label}>¿En qué barrio?</Text>
        <TextInput style={styles.input} placeholder="Ej: Parque San Martín" value={barrio} onChangeText={setBarrio} />

        <Text style={styles.label}>Descripción y Señas Particulares</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Ej: Tenía collar azul, es miedoso, renguea un poco..."
          multiline
          value={descripcion}
          onChangeText={setDescripcion}
        />

        <TouchableOpacity style={[styles.btnPublicar, enviando && { opacity: 0.5 }]} onPress={handlePublicar} disabled={enviando}>
          {enviando ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Publicar Aviso</Text>}
        </TouchableOpacity>

        {misAvisos.length > 0 && (
          <View style={{ marginTop: 40 }}>
            <Text style={styles.label}>Mis avisos publicados</Text>
            {misAvisos.map(item => (
              <View key={item.id} style={styles.itemMio}>
                <Image source={{ uri: item.fotos?.[0] }} style={styles.itemMioThumb} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.itemMioTitle}>{item.nombre || item.especie}</Text>
                  <Text style={styles.itemMioSub}>{item.estado.toUpperCase()}</Text>
                </View>
                <TouchableOpacity onPress={() => confirmarEliminar(item.id)}>
                   <Ionicons name="trash-outline" size={24} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!archivoCapturado} animationType="slide">
        {archivoCapturado && <VistaPrevia archivo={archivoCapturado} onDescartar={() => setArchivoCapturado(null)} onPublicar={handleMediaEditada} />}
      </Modal>
    </View>
  );
}

function SelectorBtn({ label, active, onPress, color }) {
  return (
    <TouchableOpacity style={[styles.selBtn, active && { backgroundColor: color, borderColor: color }]} onPress={onPress}>
      <Text style={[styles.selBtnTxt, active && { color: 'white' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  backBtn: { padding: 5 },
  scroll: { padding: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8, marginTop: 15 },
  pickerRow: { flexDirection: 'row', gap: 10 },
  selBtn: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  selBtnTxt: { fontSize: 12, fontWeight: '800', color: '#6B7280' },
  photosScroll: { flexDirection: 'row', marginBottom: 10 },
  photoBox: { width: 80, height: 80, borderRadius: 10, marginRight: 10, position: 'relative' },
  thumbnail: { width: '100%', height: '100%', borderRadius: 10 },
  removeBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: 'white', borderRadius: 10 },
  addPhoto: { width: 80, height: 80, borderRadius: 10, borderStyle: 'dashed', borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 15 },
  textArea: { height: 100, textAlignVertical: 'top' },
  btnPublicar: { backgroundColor: '#10B981', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 30, elevation: 3 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  itemMio: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#F9FAFB', borderRadius: 12, marginBottom: 10 },
  itemMioThumb: { width: 40, height: 40, borderRadius: 6 },
  itemMioTitle: { fontSize: 14, fontWeight: 'bold' },
  itemMioSub: { fontSize: 10, color: '#9CA3AF' }
});
