import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, StatusBar, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';
import { obtenerPerfilUsuario } from '../../services/firebaseService';

const PROVINCIAS_ARGENTINA = [
  "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Ciudad Autónoma de Buenos Aires",
  "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
  "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
].sort();

const BARRIOS_MERLO = [
  "Merlo Centro", "San Antonio de Padua", "Libertad", "Mariano Acosta",
  "Parque San Martín", "Pontevedra", "Pompeya", "Barrio Argentino",
  "Lago del Bosque", "El Jagüel", "Mazzini"
].sort();

const CATEGORIAS = ["Electrónica", "Vehículos", "Hogar", "Ropa", "Deportes", "Servicios", "Otros"].sort();

export default function MarketVender() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  // Estados del Formulario
  const [titulo, setTitulo] = useState('');
  const [precio, setPrecio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('');

  // Ubicación Obligatoria
  const [provincia, setProvincia] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [barrio, setBarrio] = useState('');

  // Modales
  const [modalProvVisible, setModalProvVisible] = useState(false);
  const [modalLocVisible, setModalLocVisible] = useState(false);
  const [modalBarrioVisible, setModalBarrioVisible] = useState(false);
  const [modalCatVisible, setModalCatVisible] = useState(false);
  const [localidades, setLocalidades] = useState([]);
  const [cargandoLoc, setCargandoLoc] = useState(false);

  useEffect(() => {
    // Intentamos pre-cargar la ubicación desde el perfil para ahorrar tiempo al usuario
    const uid = auth.currentUser?.uid;
    if (uid) {
      obtenerPerfilUsuario(uid, (data) => {
        if (data?.provincia) setProvincia(data.provincia);
        if (data?.localidad) setLocalidad(data.localidad);
        if (data?.barrio) setBarrio(data.barrio);
      });
    }
  }, []);

  useEffect(() => {
    if (provincia) cargarLocalidades(provincia);
  }, [provincia]);

  const cargarLocalidades = async (prov) => {
    try {
      setCargandoLoc(true);
      const response = await fetch(`https://apis.datos.gob.ar/georef/api/localidades?provincia=${encodeURIComponent(prov)}&max=1000&campos=nombre`);
      const data = await response.json();
      if (data.localidades) setLocalidades(data.localidades.map(l => l.nombre).sort());
    } catch (e) { console.log(e); } finally { setCargandoLoc(false); }
  };

  const handlePublicar = () => {
    if (!titulo || !precio || !categoria || !provincia || !localidad || !barrio) {
      Alert.alert("Campos obligatorios", "Por favor completa todos los campos de ubicación y los datos del producto.");
      return;
    }
    Alert.alert("Éxito", "Tu producto ha sido publicado en el Market.");
    router.back();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={30} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>¿Qué estás vendiendo?</Text>
        <TouchableOpacity onPress={handlePublicar}>
           <Text style={styles.publicarTxt}>Publicar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* FOTOS */}
        <TouchableOpacity style={styles.addPhotoBtn}>
           <Ionicons name="camera-outline" size={40} color="#FF6600" />
           <Text style={styles.addPhotoTxt}>Agregar fotos</Text>
        </TouchableOpacity>

        <View style={styles.form}>
           <TextInput
             placeholder="Título del producto"
             style={styles.inputGrande}
             value={titulo}
             onChangeText={setTitulo}
           />

           <View style={styles.row}>
              <View style={[styles.inputBox, { flex: 1 }]}>
                 <Text style={styles.label}>Precio ($)</Text>
                 <TextInput
                  placeholder="0.00"
                  keyboardType="numeric"
                  style={styles.input}
                  value={precio}
                  onChangeText={setPrecio}
                 />
              </View>
              <TouchableOpacity style={[styles.inputBox, { flex: 1, marginLeft: 10 }]} onPress={() => setModalCatVisible(true)}>
                 <Text style={styles.label}>Categoría</Text>
                 <Text style={[styles.val, !categoria && {color: '#B0B0B0'}]}>{categoria || "Elegir..."}</Text>
              </TouchableOpacity>
           </View>

           <TextInput
             placeholder="Descripción (estado, detalles, etc.)"
             style={[styles.inputGrande, { height: 100, textAlignVertical: 'top' }]}
             multiline
             value={descripcion}
             onChangeText={setDescripcion}
           />

           <Text style={styles.sectionTitle}>Ubicación del Producto (Obligatorio)</Text>

           <SelectorItem label="Provincia" value={provincia} onPress={() => setModalProvVisible(true)} icon="map-outline" />
           <SelectorItem label="Localidad" value={localidad} onPress={() => setModalLocVisible(true)} icon="location-outline" disabled={!provincia} />
           <SelectorItem label="Barrio / Zona" value={barrio} onPress={() => {
              if (localidad === 'Merlo') setModalBarrioVisible(true);
              else Alert.prompt("Barrio", "Escribe tu zona:", (text) => setBarrio(text));
           }} icon="home-outline" disabled={!localidad} />

        </View>
      </ScrollView>

      {/* MODALES */}
      <SelectorModal visible={modalProvVisible} onClose={() => setModalProvVisible(false)} data={PROVINCIAS_ARGENTINA} onSelect={(i) => { setProvincia(i); setLocalidad(''); setBarrio(''); setModalProvVisible(false); }} titulo="Provincia" />
      <SelectorModal visible={modalLocVisible} onClose={() => setModalLocVisible(false)} data={localidades} onSelect={(i) => { setLocalidad(i); setBarrio(''); setModalLocVisible(false); }} titulo="Localidad" cargando={cargandoLoc} />
      <SelectorModal visible={modalBarrioVisible} onClose={() => setModalBarrioVisible(false)} data={BARRIOS_MERLO} onSelect={(i) => { setBarrio(i); setModalBarrioVisible(false); }} titulo="Barrio de Merlo" />
      <SelectorModal visible={modalCatVisible} onClose={() => setModalCatVisible(false)} data={CATEGORIAS} onSelect={(i) => { setCategoria(i); setModalCatVisible(false); }} titulo="Categoría" />

    </View>
  );
}

function SelectorItem({ label, value, onPress, icon, disabled }) {
  return (
    <TouchableOpacity style={[styles.selector, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={20} color="#FF6600" />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.val, !value && { color: '#B0B0B0' }]}>{value || `Seleccionar ${label.toLowerCase()}...`}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#CCC" />
    </TouchableOpacity>
  );
}

function SelectorModal({ visible, onClose, data, onSelect, titulo, cargando }) {
  const [search, setSearch] = useState('');
  const filtrados = data.filter(i => i.toLowerCase().includes(search.toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>{titulo}</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#333" /></TouchableOpacity></View>
          <View style={styles.modalSearch}><Ionicons name="search" size={18} color="#999" /><TextInput placeholder="Buscar..." style={styles.modalSearchInput} value={search} onChangeText={setSearch} /></View>
          {cargando ? <ActivityIndicator color="#FF6600" style={{margin: 20}} /> : (
            <FlatList data={filtrados} keyExtractor={(i, index) => `${i}-${index}`} renderItem={({item}) => (<TouchableOpacity style={styles.modalItem} onPress={() => { onSelect(item); setSearch(''); }}><Text style={styles.modalItemText}>{item}</Text></TouchableOpacity>)} />
          )}
      </View></View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  publicarTxt: { color: '#FF6600', fontWeight: 'bold', fontSize: 16 },
  scrollContent: { paddingBottom: 40 },
  addPhotoBtn: { height: 180, backgroundColor: '#FFFBF5', margin: 20, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, borderColor: '#FF6600', justifyContent: 'center', alignItems: 'center' },
  addPhotoTxt: { color: '#FF6600', fontWeight: 'bold', marginTop: 10 },
  form: { paddingHorizontal: 20 },
  inputGrande: { fontSize: 20, fontWeight: '700', color: '#111827', borderBottomWidth: 1, borderBottomColor: '#EEE', paddingVertical: 15, marginBottom: 20 },
  row: { flexDirection: 'row', marginBottom: 20 },
  inputBox: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 15, borderWidth: 1, borderColor: '#EEE' },
  label: { fontSize: 11, color: '#9CA3AF', fontWeight: 'bold', textTransform: 'uppercase' },
  input: { fontSize: 16, color: '#111827', fontWeight: '700', marginTop: 2 },
  val: { fontSize: 15, color: '#111827', fontWeight: '600', marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#374151', marginTop: 10, marginBottom: 20, textTransform: 'uppercase' },
  selector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 15, borderRadius: 18, marginBottom: 15, borderWidth: 1, borderColor: '#EEE' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', height: '80%', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15 },
  modalSearchInput: { flex: 1, height: 45, marginLeft: 10 },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalItemText: { fontSize: 16, color: '#333' }
});
