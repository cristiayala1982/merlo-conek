import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VistaPrevia from '../../components/camara/VistaPrevia';
import { procesarImagenCompleta } from '../../components/camaraFotos/OptimizadorImagenes';
import SelectorFotoMarket from '../../components/camaraFotos/SelectorFotoMarket';
import { showToast } from '../../components/utilidades/CustomToast';
import { db } from '../../firebaseConfig';
import { actualizarProductoMarket } from '../../services/firebaseService';
import { obtenerPartidosDeProvincia, obtenerLocalidadesDePartido } from '../../constants/geografiaArgentina';

const PROVINCIAS_ARGENTINA = [
  "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Ciudad Autónoma de Buenos Aires",
  "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
  "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
].sort();

const CATEGORIAS = ["Electrónica", "Vehículos", "Hogar", "Ropa", "Deportes", "Servicios", "Otros"].sort();

export default function MarketEditar() {
  const router = useRouter();
  const { productId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [loadingData, setLoadingData] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [progresoPct, setProgresoPct] = useState(0);

  const [fotos, setFotos] = useState([]);
  const [fotosLQ, setFotosLQ] = useState([]);
  const [titulo, setTitulo] = useState('');
  const [precio, setPrecio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [archivoCapturado, setArchivoCapturado] = useState(null);
  const [cerrarCamara, setCerrarCamara] = useState(0);

  // Ubicación
  const [provincia, setProvincia] = useState('');
  const [partido, setPartido] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [barrio, setBarrio] = useState('');
  const [direccion, setDireccion] = useState('');
  const [coords, setCoords] = useState(null);

  // Modales
  const [modalProvVisible, setModalProvVisible] = useState(false);
  const [modalPartVisible, setModalPartVisible] = useState(false);
  const [modalLocVisible, setModalLocVisible] = useState(false);
  const [modalCatVisible, setModalCatVisible] = useState(false);
  const [partidos, setPartidos] = useState([]);
  const [localidades, setLocalidades] = useState([]);
  const [cargandoPart, setCargandoPart] = useState(false);
  const [cargandoLoc, setCargandoLoc] = useState(false);
  const [obteniendoGPS, setObteniendoGPS] = useState(false);
  const prevProvinciaRef = useRef(null);

  const formatPrecio = (text) => {
    const num = String(text).replace(/[^0-9]/g, '');
    if (!num) return '';
    return parseInt(num, 10).toLocaleString('es-AR');
  };

  const handlePrecioChange = (text) => {
    setPrecio(formatPrecio(text));
  };

  const handleGetGPS = async () => {
    try {
      setObteniendoGPS(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permiso denegado", "Se necesita permiso de ubicación.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    } catch (e) {
      Alert.alert("Error GPS", "No se pudo obtener la ubicación.");
    } finally { setObteniendoGPS(false); }
  };

  useEffect(() => { if (productId) cargarProducto(); }, [productId]);

  const cargarProducto = async () => {
    try {
      const snap = await getDoc(doc(db, 'productos_market', productId));
      if (snap.exists()) {
        const data = snap.data();
        setTitulo(data.titulo);
        setPrecio(data.precio ? formatPrecio(data.precio) : '');
        setDescripcion(data.descripcion);
        setCategoria(data.categoria);
        setWhatsapp(data.whatsapp || '');
        setProvincia(data.provincia);
        setPartido(data.partido || data.localidad); // Fallback data vieja
        setLocalidad(data.localidad);
        setBarrio(data.barrio || '');
        setDireccion(data.direccion || '');
        setCoords(data.coords || null);
        setFotos(data.fotos || []);
        setFotosLQ(data.thumbnailLqUrls || []);
      }
      setLoadingData(false);
    } catch (e) { Alert.alert("Error", "No se pudo cargar."); router.back(); }
  };

  useEffect(() => {
    if (prevProvinciaRef.current && prevProvinciaRef.current !== provincia) {
      setPartido('');
      setLocalidad('');
    }
    prevProvinciaRef.current = provincia;

    if (provincia) cargarPartidos(provincia);
  }, [provincia]);

  useEffect(() => {
    if (partido && provincia) cargarLocalidades(partido, provincia);
  }, [partido, provincia]);

  const cargarPartidos = (prov) => setPartidos(obtenerPartidosDeProvincia(prov));

  const cargarLocalidades = (part, prov) => setLocalidades(obtenerLocalidadesDePartido(part, prov));

  const handleGuardarCambios = async () => {
    if (guardando) return;

    // Limpiamos los puntos del precio antes de validar y guardar
    const precioLimpio = precio.replace(/\./g, '');

    if (fotos.length === 0) { Alert.alert("Falta foto", "Sube al menos una imagen."); return; }
    if (!titulo.trim() || !precioLimpio || !categoria || !provincia || !partido || !localidad) {
      Alert.alert("Faltan datos", "Provincia, Partido y Localidad son obligatorios.");
      return;
    }

    try {
      setGuardando(true);

      const optimizedFotos = [];
      const optimizedLQ = [];

      for (let i = 0; i < fotos.length; i++) {
          const uri = fotos[i];
          if (uri.startsWith('http')) {
              optimizedFotos.push(uri);
              optimizedLQ.push(fotosLQ[i] || null);
          } else {
              const { uriPrincipal, uriLQ } = await procesarImagenCompleta(uri, "MARKET-EDITAR");
              optimizedFotos.push(uriPrincipal);
              optimizedLQ.push(uriLQ);
          }
      }

      const resultado = await actualizarProductoMarket({
        id: productId,
        fotos: optimizedFotos,
        fotosLQ: optimizedLQ,
        titulo: titulo.trim(), precio: precioLimpio, descripcion: descripcion.trim(),
        categoria, whatsapp: whatsapp.trim(), provincia, partido, localidad,
        barrio: barrio.trim(), direccion: direccion.trim(), coords,
        onProgress: (p) => setProgresoPct(p)
      });
      if (resultado?.estado === 'pendiente_revision') {
        showToast('Tu producto está en revisión por nuestro equipo de moderación.', 'review');
        router.back();
        return;
      }
      Alert.alert("¡Éxito!", "Cambios guardados.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) { Alert.alert("Error", "No se pudo guardar."); } finally { setGuardando(false); }
  };

  if (loadingData) return <View style={styles.center}><ActivityIndicator color="#FF6600" size="large" /></View>;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} disabled={guardando}><Ionicons name="close" size={30} color={guardando ? "#CCC" : "#333"} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Publicación</Text>
        <TouchableOpacity onPress={handleGuardarCambios} disabled={guardando}><Text style={[styles.publicarTxt, guardando && { color: '#CCC' }]}>Guardar</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.photosSection}>
           <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
              {fotos.map((uri, index) => (
                <View key={index} style={styles.photoWrapper}>
                  <Image source={{ uri }} style={styles.photoPreview} />
                  <TouchableOpacity style={styles.removePhotoBtn} onPress={() => {
  setFotos(f => f.filter((_, i) => i !== index));
  setFotosLQ(f => f.filter((_, i) => i !== index));
}}><Ionicons name="close-circle" size={24} color="#FF4444" /></TouchableOpacity>
                </View>
              ))}
           </ScrollView>
           {fotos.length < 4 && <SelectorFotoMarket onFotoSeleccionada={(uri) => setArchivoCapturado({tipo:'foto', uri})} fotosActualesCount={fotos.length} cerrarCamara={cerrarCamara} />}
        </View>
        <View style={styles.form}>
           <TextInput placeholder="Título" style={styles.inputGrande} value={titulo} onChangeText={setTitulo} />
           <View style={styles.row}>
              <View style={[styles.inputBox, { flex: 1 }]}><Text style={styles.label}>Precio ($)</Text><TextInput placeholder="0" keyboardType="numeric" style={styles.input} value={precio} onChangeText={handlePrecioChange} /></View>
              <TouchableOpacity style={[styles.inputBox, { flex: 1, marginLeft: 10 }]} onPress={() => setModalCatVisible(true)}><Text style={styles.label}>Categoría</Text><Text style={styles.val}>{categoria || "Elegir..."}</Text></TouchableOpacity>
           </View>
           <TextInput placeholder="Descripción" style={[styles.inputGrande, { height: 80 }]} multiline value={descripcion} onChangeText={setDescripcion} />

           <View style={styles.inputBoxManual}>
              <Text style={[styles.label, { fontSize: 13, color: '#4B5563' }]}>WhatsApp de contacto</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                  <Ionicons name="logo-whatsapp" size={24} color="#25D366" style={{ marginRight: 10 }} />
                  <TextInput
                      placeholder="Ej: 1122334455"
                      keyboardType="phone-pad"
                      style={[styles.input, { flex: 1, fontSize: 17, fontWeight: '600' }]}
                      value={whatsapp}
                      onChangeText={setWhatsapp}
                  />
              </View>
              <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 8, fontWeight: '500' }}>* Aparecerá un botón de contacto directo si impulsas tu producto.</Text>
           </View>

           <Text style={styles.sectionTitle}>Ubicación</Text>
           {(() => {
             const isBsAs = provincia === 'Buenos Aires';
             const labelPartido = isBsAs ? 'Partido' : 'Departamento';
             const labelLocalidad = isBsAs ? 'Localidad' : 'Municipio';

             return (
               <>
                 <SelectorItem label="Provincia" value={provincia} onPress={() => setModalProvVisible(true)} icon="map-outline" />
                 <SelectorItem label={labelPartido} value={partido} onPress={() => setModalPartVisible(true)} icon="business-outline" disabled={!provincia} />
                 <SelectorItem label={labelLocalidad} value={localidad} onPress={() => setModalLocVisible(true)} icon="location-outline" disabled={!partido} />
               </>
             );
           })()}
           <View style={styles.inputBoxManual}><Text style={styles.label}>Barrio (Opcional)</Text><TextInput placeholder="Ej: Pompeya" style={styles.input} value={barrio} onChangeText={setBarrio} /></View>

           <View style={[styles.gpsBtn, coords && styles.gpsBtnActive]}>
              <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                  onPress={handleGetGPS}
                  disabled={obteniendoGPS}
              >
                  {obteniendoGPS ? (
                    <ActivityIndicator color={coords ? "white" : "#FF6600"} />
                  ) : (
                    <>
                      <Ionicons name={coords ? "location" : "location-outline"} size={22} color={coords ? "white" : "#FF6600"} />
                      <Text style={[styles.gpsBtnText, coords && { color: 'white' }]}>
                        {coords ? "Ubicación Capturada ✅" : "Adjuntar Ubicación GPS"}
                      </Text>
                    </>
                  )}
              </TouchableOpacity>

              {coords && !obteniendoGPS && (
                  <TouchableOpacity
                      onPress={() => setCoords(null)}
                      style={{ paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.3)' }}
                  >
                      <Ionicons name="close-circle" size={26} color="white" />
                  </TouchableOpacity>
              )}
           </View>
        </View>
      </ScrollView>

      <Modal visible={guardando} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#FF6600" />
            <Text style={styles.loadingTitle}>Guardando...</Text>
            {progresoPct > 0 && (
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progresoPct}%` }]} />
              </View>
            )}
            <Text style={styles.loadingSub}>Por favor espera un momento</Text>
          </View>
        </View>
      </Modal>

      <SelectorModal visible={modalProvVisible} onClose={() => setModalProvVisible(false)} data={PROVINCIAS_ARGENTINA} onSelect={(i) => { setProvincia(i); setPartido(''); setLocalidad(''); setModalProvVisible(false); }} titulo="Elegir Provincia" />
      <SelectorModal visible={modalPartVisible} onClose={() => setModalPartVisible(false)} data={partidos} onSelect={(i) => { setPartido(i); setLocalidad(''); setModalPartVisible(false); }} titulo={provincia === 'Buenos Aires' ? "Elegir Partido" : "Elegir Departamento"} cargando={cargandoPart} />
      <SelectorModal visible={modalLocVisible} onClose={() => setModalLocVisible(false)} data={localidades} onSelect={(i) => { setLocalidad(i); setModalLocVisible(false); }} titulo={provincia === 'Buenos Aires' ? "Elegir Localidad" : "Elegir Municipio"} cargando={cargandoLoc} />
      <SelectorModal visible={modalCatVisible} onClose={() => setModalCatVisible(false)} data={CATEGORIAS} onSelect={(i) => { setCategoria(i); setModalCatVisible(false); }} titulo="Categoría" />
      <Modal visible={!!archivoCapturado} animationType="slide">{archivoCapturado && <VistaPrevia archivo={archivoCapturado} onDescartar={() => setArchivoCapturado(null)} onPublicar={(t, u) => {setFotos(p => [...p, u].slice(0,4)); setArchivoCapturado(null); setCerrarCamara(current => current + 1);}} />}</Modal>
    </View>
  );
}

function SelectorItem({ label, value, onPress, icon, disabled }) {
  return (
    <TouchableOpacity style={[styles.selector, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={20} color="#FF6600" />
      <View style={{ flex: 1, marginLeft: 12 }}><Text style={styles.label}>{label}</Text><Text style={styles.val}>{value || "Seleccionar..."}</Text></View>
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
          {cargando ? <ActivityIndicator color="#FF6600" style={{margin: 20}} /> : <FlatList data={filtrados} keyExtractor={(i, idx) => `${i}-${idx}`} renderItem={({item}) => (<TouchableOpacity style={styles.modalItem} onPress={() => { onSelect(item); setSearch(''); }}><Text style={styles.modalItemText}>{item}</Text></TouchableOpacity>)} />}
      </View></View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  publicarTxt: { color: '#FF6600', fontWeight: 'bold', fontSize: 16 },
  scrollContent: { paddingBottom: 350 },
  photosSection: { marginVertical: 20 },
  photoWrapper: { position: 'relative', width: 120, height: 160, marginRight: 15 },
  photoPreview: { width: '100%', height: '100%', borderRadius: 15, backgroundColor: '#EEE' },
  removePhotoBtn: { position: 'absolute', top: 5, right: 5, backgroundColor: 'white', borderRadius: 12 },
  form: { paddingHorizontal: 20 },
  inputGrande: { fontSize: 18, fontWeight: '700', color: '#111827', borderBottomWidth: 1, borderBottomColor: '#EEE', paddingVertical: 10, marginBottom: 15 },
  row: { flexDirection: 'row', marginBottom: 15 },
  inputBox: { backgroundColor: '#F9FAFB', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#EEE' },
  label: { fontSize: 10, color: '#9CA3AF', fontWeight: 'bold', textTransform: 'uppercase' },
  input: { fontSize: 15, color: '#111827', marginTop: 2 },
  val: { fontSize: 15, color: '#111827', marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#374151', marginVertical: 15, textTransform: 'uppercase' },
  selector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#EEE' },
  inputBoxManual: { backgroundColor: '#F9FAFB', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#EEE', marginBottom: 10 },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#FF6600',
    backgroundColor: '#FFF',
    marginVertical: 15,
    elevation: 2
  },
  gpsBtnActive: {
    backgroundColor: '#FF6600',
  },
  gpsBtnText: {
    marginLeft: 10,
    color: '#FF6600',
    fontWeight: '900',
    fontSize: 15
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100
  },
  loadingCard: {
    backgroundColor: 'white',
    padding: 25,
    borderRadius: 25,
    alignItems: 'center',
    width: '80%',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20
  },
  loadingTitle: { fontSize: 18, fontWeight: '900', color: '#111827', marginTop: 15 },
  loadingSub: { fontSize: 13, color: '#6B7280', marginTop: 5, fontWeight: '500' },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    marginTop: 20,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF6600',
    borderRadius: 3
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', height: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 17, fontWeight: 'bold' },
  modalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, marginBottom: 10 },
  modalSearchInput: { flex: 1, height: 40, marginLeft: 8 },
  modalItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalItemText: { fontSize: 15 }
});
