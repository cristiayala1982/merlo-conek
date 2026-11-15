import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, NativeModules, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, Modal, FlatList, KeyboardAvoidingView } from 'react-native';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { actualizarPerfilUsuario } from '../services/firebaseService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showToast } from '../components/utilidades/CustomToast';
import CamaraInterna from '../components/camara/CamaraInterna';
import { obtenerPartidosDeProvincia, obtenerLocalidadesDePartido } from '../constants/geografiaArgentina';

const PROVINCIAS_ARGENTINA = [
  "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Ciudad Autónoma de Buenos Aires",
  "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
  "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
].sort();

export default function EditarPerfil() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Estados del perfil
  const [nombre, setNombre] = useState('');
  const [bio, setBio] = useState('');
  const [profesion, setProfesion] = useState('');
  const [provincia, setProvincia] = useState('');
  const [partido, setPartido] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [link, setLink] = useState('');
  const [instagram, setInstagram] = useState('');
  const [musica, setMusica] = useState('');
  const [familia, setFamilia] = useState('');
  const [hobbies, setHobbies] = useState('');

  const [fotoUrl, setFotoUrl] = useState(null);
  const [portadaUrl, setPortadaUrl] = useState(null);

  // Estados para cámara interna
  const [camaraVisible, setCamaraVisible] = useState(false);
  const [camaraTipo, setCamaraTipo] = useState('foto');

  // Estados para selectores
  const [modalProvVisible, setModalProvVisible] = useState(false);
  const [modalPartVisible, setModalPartVisible] = useState(false);
  const [modalLocVisible, setModalLocVisible] = useState(false);

  const [partidos, setPartidos] = useState([]);
  const [localidades, setLocalidades] = useState([]);
  const [cargandoPart, setCargandoPart] = useState(false);
  const [cargandoLoc, setCargandoLoc] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    getDoc(doc(db, 'usuarios', uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setNombre(data.nombre || '');
        setBio(data.bio || '');
        setProfesion(data.profesion || '');
        setProvincia(data.provincia || '');
        // Migración limpia: si no tiene 'partido' pero tiene 'localidad', cargamos 'localidad' en 'partido'
        setPartido(data.partido || data.localidad || data.ciudad || '');
        setLocalidad(data.localidadInterna || '');
        setLink(data.link || '');
        setInstagram(data.instagram || '');
        setMusica(data.musica || '');
        setFamilia(data.familia || '');
        setHobbies(data.hobbies || '');
        setFotoUrl(data.fotoUrl || null);
        setPortadaUrl(data.portadaUrl || null);
      }
      setCargando(false);
    }).catch(err => {
      console.error(err);
      setCargando(false);
    });
  }, []);

  // Cargar Partidos cuando cambia la provincia
  useEffect(() => {
    setPartido('');
    setLocalidad('');
    if (provincia) cargarPartidos(provincia);
  }, [provincia]);



  const cargarPartidos = (prov) => {
    setPartidos(obtenerPartidosDeProvincia(prov));
  };

  const cargarLocalidades = (part, prov) => {
    setLocalidades(obtenerLocalidadesDePartido(part, prov));
  };

  // Cargar Localidades cuando cambia el partido
  useEffect(() => {
    if (partido && provincia) {
      cargarLocalidades(partido, provincia);
    }
  }, [partido, provincia]);

  const handlePickImage = (tipo) => {
    setCamaraTipo(tipo);
    setCamaraVisible(true);
  };

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      Alert.alert("Campo obligatorio", "El nombre es necesario.");
      return;
    }

    try {
      setGuardando(true);
      const datos = {
        nombre: nombre.trim(),
        bio: bio.trim(),
        profesion: profesion.trim(),
        provincia: provincia || '',
        partido: partido || '',
        localidad: localidad || '', // Mantenemos por compatibilidad
        localidadInterna: localidad || '', // Guardamos la zona específica
        link: link.trim(),
        instagram: instagram.trim(),
        musica: musica.trim(),
        familia: familia.trim(),
        hobbies: hobbies.trim(),
        fotoUri: (fotoUrl && !fotoUrl.startsWith('http')) ? fotoUrl : undefined,
        portadaUri: (portadaUrl && !portadaUrl.startsWith('http')) ? portadaUrl : undefined
      };

      await actualizarPerfilUsuario(datos);
      showToast("¡Perfil actualizado!", "success");
      router.replace('/(tabs)/perfil');
    } catch (error) {
      Alert.alert("Error", "No se pudieron guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator size="large" color="#FF6600" /></View>;

  // --- LÓGICA DE ETIQUETAS DINÁMICAS ---
  const isBsAs = provincia === 'Buenos Aires';
  const labelPartido = isBsAs ? 'Partido' : 'Departamento';
  const labelLocalidad = isBsAs ? 'Localidad' : 'Municipio';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/perfil')} style={styles.backBtn}>
          <Ionicons name="close-outline" size={32} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Perfil</Text>
        <TouchableOpacity onPress={handleGuardar} disabled={guardando} style={[styles.saveBtn, guardando && { opacity: 0.7 }]}>
          {guardando ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Imágenes */}
        <View style={styles.imagesSection}>
          <TouchableOpacity style={styles.portadaPlaceholder} onPress={() => handlePickImage('portada')} activeOpacity={0.9}>
            {portadaUrl ? <Image source={{ uri: portadaUrl }} style={styles.portadaImg} /> : (
              <View style={styles.portadaEmpty}><Ionicons name="image-outline" size={34} color="#999" /><Text style={styles.imgLabel}>Agregar foto de portada</Text></View>
            )}
            <View style={styles.cameraIconBadgePortada}><Ionicons name="camera" size={18} color="#FFF" /></View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarWrapper} onPress={() => handlePickImage('foto')} activeOpacity={0.9}>
            <View style={styles.avatarCircle}>{fotoUrl ? <Image source={{ uri: fotoUrl }} style={styles.avatarImg} /> : <Ionicons name="person" size={50} color="#CCC" />}</View>
            <View style={styles.editIconBadge}><Ionicons name="camera" size={16} color="#FFF" /></View>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
           <Text style={styles.sectionTitle}>Información pública</Text>
           <Input label="Nombre" value={nombre} onChange={setNombre} icon="person-outline" />
           <Input label="Biografía" value={bio} onChange={setBio} icon="document-text-outline" multiline />
           <Input label="Profesión" value={profesion} onChange={setProfesion} icon="briefcase-outline" />

           <Text style={styles.sectionTitle}>Ubicación Oficial (Comunidad & Market)</Text>

           {/* SELECTOR DE PROVINCIA */}
           <TouchableOpacity style={styles.selectorBtn} onPress={() => setModalProvVisible(true)}>
             <View style={styles.selectorLabelRow}>
               <Ionicons name="map-outline" size={16} color="#FF6600" />
               <Text style={styles.selectorLabel}>Provincia</Text>
             </View>
             <View style={styles.selectorValueRow}>
               <Text style={[styles.selectorValue, !provincia && {color: '#B0B0B0'}]}>{provincia || "Selecciona una provincia..."}</Text>
               <Ionicons name="chevron-down" size={18} color="#CCC" />
             </View>
           </TouchableOpacity>

           {/* SELECTOR DE PARTIDO */}
           <TouchableOpacity
             style={[styles.selectorBtn, !provincia && { opacity: 0.5 }]}
             onPress={() => provincia && setModalPartVisible(true)}
             disabled={!provincia}
           >
             <View style={styles.selectorLabelRow}>
               <Ionicons name="business-outline" size={16} color="#FF6600" />
               <Text style={styles.selectorLabel}>{labelPartido}</Text>
             </View>
             <View style={styles.selectorValueRow}>
               <Text style={[styles.selectorValue, !partido && {color: '#B0B0B0'}]}>{partido || (provincia ? `Selecciona un ${labelPartido.toLowerCase()}...` : "Elige primero una provincia")}</Text>
               <Ionicons name="chevron-down" size={18} color="#CCC" />
             </View>
           </TouchableOpacity>

           {/* SELECTOR DE LOCALIDAD (Opcional) */}
           <TouchableOpacity
             style={[styles.selectorBtn, !partido && { opacity: 0.5 }]}
             onPress={() => partido && setModalLocVisible(true)}
             disabled={!partido}
           >
             <View style={styles.selectorLabelRow}>
               <Ionicons name="location-outline" size={16} color="#FF6600" />
               <Text style={styles.selectorLabel}>{labelLocalidad} / Zona (Opcional)</Text>
             </View>
             <View style={styles.selectorValueRow}>
               <Text style={[styles.selectorValue, !localidad && {color: '#B0B0B0'}]}>{localidad || (partido ? `Selecciona un ${labelLocalidad.toLowerCase()}...` : `Elige primero un ${labelPartido.toLowerCase()}`)}</Text>
               <Ionicons name="chevron-down" size={18} color="#CCC" />
             </View>
           </TouchableOpacity>

           <Text style={styles.sectionTitle}>Redes y Contacto</Text>
           <Input label="Enlace / Web" value={link} onChange={setLink} icon="link-outline" placeholder="https://..." />
           <Input label="Instagram" value={instagram} onChange={setInstagram} icon="logo-instagram" placeholder="@usuario" />

           <Text style={styles.sectionTitle}>Intereses y Vida</Text>
           <Input label="Música favorita" value={musica} onChange={setMusica} icon="musical-notes-outline" />
           <Input label="Situación familiar" value={familia} onChange={setFamilia} icon="heart-outline" />
           <Input label="Hobbies" value={hobbies} onChange={setHobbies} icon="bicycle-outline" />
        </View>
      </ScrollView>

      {/* MODAL SELECTOR PROVINCIAS */}
      <SelectorModal
        visible={modalProvVisible}
        onClose={() => setModalProvVisible(false)}
        data={PROVINCIAS_ARGENTINA}
        onSelect={(item) => { setProvincia(item); setLocalidad(''); setModalProvVisible(false); }}
        titulo="Selecciona Provincia"
      />

      {/* MODAL SELECTOR PARTIDOS */}
      <SelectorModal
        visible={modalPartVisible}
        onClose={() => setModalPartVisible(false)}
        data={partidos}
        cargando={cargandoPart}
        onSelect={(item) => { setPartido(item); setLocalidad(''); setModalPartVisible(false); }}
        titulo={isBsAs ? `Partidos de ${provincia}` : `Departamentos de ${provincia}`}
      />

      {/* MODAL SELECTOR LOCALIDADES */}
      <SelectorModal
        visible={modalLocVisible}
        onClose={() => setModalLocVisible(false)}
        data={localidades}
        cargando={cargandoLoc}
        onSelect={(item) => { setLocalidad(item); setModalLocVisible(false); }}
        titulo={isBsAs ? `Localidades de ${partido}` : `Municipios de ${partido}`}
      />

      {/* MODAL CÁMARA INTERNA DE FOTOS */}
      <Modal
        visible={camaraVisible}
        animationType="slide"
        transparent={false}
        statusBarTranslucent={true}
        onRequestClose={() => setCamaraVisible(false)}
      >
        <CamaraInterna
          visible={camaraVisible}
          onCerrar={() => setCamaraVisible(false)}
          onFotoCapturada={(uri) => {
            if (camaraTipo === 'foto') setFotoUrl(uri);
            else setPortadaUrl(uri);
            setCamaraVisible(false);
          }}
        />
      </Modal>
    </View>
    </KeyboardAvoidingView>
  );
}

function SelectorModal({ visible, onClose, data, onSelect, titulo, cargando }) {
  const [search, setSearch] = useState('');

  // Escudo de seguridad por si data viene nulo o vacío
  const listaSegura = Array.isArray(data) ? data : [];
  const filtrados = listaSegura.filter(i => i && i.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{titulo}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#333" /></TouchableOpacity>
          </View>
          <View style={styles.modalSearch}>
             <Ionicons name="search" size={18} color="#999" />
             <TextInput
              placeholder="Buscar..."
              style={styles.modalSearchInput}
              value={search}
              onChangeText={setSearch}
             />
          </View>
          {cargando ? <ActivityIndicator color="#FF6600" style={{margin: 20}} /> : (
            <FlatList
              data={filtrados}
              keyExtractor={(item, index) => `${item}-${index}`} // Llave única combinada
              renderItem={({item}) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => {
                  onSelect(item);
                  setSearch('');
                }}>
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
              removeClippedSubviews={true}
              initialNumToRender={15}
              contentContainerStyle={{ paddingBottom: 60 }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function Input({ label, value, onChange, icon, multiline, placeholder }) {
  return (
    <View style={styles.inputContainer}>
      <View style={styles.labelRow}><Ionicons name={icon} size={16} color="#FF6600" /><Text style={styles.label}>{label}</Text></View>
      <TextInput style={[styles.input, multiline && { height: 100, textAlignVertical: 'top' }]} value={value} onChangeText={onChange} multiline={multiline} placeholder={placeholder || `Escribe tu ${label.toLowerCase()}...`} placeholderTextColor="#B0B0B0" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  backBtn: { padding: 4 },
  saveBtn: { backgroundColor: '#FF6600', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 450 },
  imagesSection: { alignItems: 'center', marginBottom: 65 },
  portadaPlaceholder: { width: '100%', height: 180, backgroundColor: '#F8F9FA', position: 'relative' },
  portadaImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  portadaEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#DDD', margin: 10, borderRadius: 10 },
  imgLabel: { color: '#999', fontSize: 12, marginTop: 8, fontWeight: '700' },
  cameraIconBadgePortada: { position: 'absolute', bottom: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },
  avatarWrapper: { position: 'absolute', bottom: -55, elevation: 5 },
  avatarCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#F3F4F6', borderWidth: 5, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  editIconBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: '#FF6600', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF' },
  form: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#FF6600', marginTop: 30, marginBottom: 15, textTransform: 'uppercase' },
  inputContainer: { marginBottom: 18 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  label: { marginLeft: 10, fontSize: 13, fontWeight: '800', color: '#374151' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 15, paddingVertical: 12, fontSize: 15, color: '#111827' },
  selectorBtn: { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 18 },
  selectorLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  selectorLabel: { marginLeft: 10, fontSize: 13, fontWeight: '800', color: '#374151' },
  selectorValueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectorValue: { fontSize: 15, color: '#111827', fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', height: '80%', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15 },
  modalSearchInput: { flex: 1, height: 45, marginLeft: 10 },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalItemText: { fontSize: 16, color: '#333' }
});
