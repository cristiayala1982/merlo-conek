import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, arrayRemove, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VistaPrevia from '../../components/camara/VistaPrevia';
import { procesarImagenCompleta } from '../../components/camaraFotos/OptimizadorImagenes';
import SelectorFotoHuellitas from '../../components/camaraFotos/SelectorFotoHuellitas';
import { auth, db } from '../../firebaseConfig';
import { obtenerPerfilUsuario, subirArchivoConRuta, borrarArchivoPorUrl } from '../../services/firebaseService';
import { obtenerPartidosDeProvincia, obtenerLocalidadesDePartido } from '../../constants/geografiaArgentina';

const { width } = Dimensions.get('window');

const PROVINCIAS_ARGENTINA = [
  "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Ciudad Autónoma de Buenos Aires",
  "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
  "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
].sort();

export default function NuevaHuellita() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { editId } = useLocalSearchParams();

  const [misAvisos, setMisAvisos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [perfil, setPerfil] = useState(null);

  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState('perdido'); // 'perdido', 'encontrado', 'adopcion'
  const [especie, setEspecie] = useState('');
  const [sexo, setSexo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fotosUris, setFotosUris] = useState([]);
  const [fotosLQUris, setFotosLQUris] = useState([]);
  const [archivoCapturado, setArchivoCapturado] = useState(null);
  const [cerrarCamara, setCerrarCamara] = useState(0);

  // UBICACIÓN (Jerarquía 4 niveles)
  const [provincia, setProvincia] = useState('');
  const [partido, setPartido] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [barrio, setBarrio] = useState('');

  const [modalProvVisible, setModalProvVisible] = useState(false);
  const [modalPartVisible, setModalPartVisible] = useState(false);
  const [modalLocVisible, setModalLocVisible] = useState(false);

  const [partidos, setPartidos] = useState([]);
  const [localidades, setLocalidades] = useState([]);
  const [cargandoPart, setCargandoPart] = useState(false);
  const [cargandoLoc, setCargandoLoc] = useState(false);

  const [coords, setCoords] = useState(null);
  const [obteniendoGPS, setObteniendoGPS] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [tabActiva, setTabActiva] = useState('publicar'); // 'publicar' o 'guardados'
  const [misGuardados, setMisGuardados] = useState([]);
  const prevProvinciaRef = useRef(null);
  const perfilInicialCargadoRef = useRef(false);

  useEffect(() => {
    if (editId) {
      const cargarAvisoAEditar = async () => {
        try {
          const snap = await getDoc(doc(db, 'mascotas', editId));
          if (snap.exists()) {
            const item = { id: snap.id, ...snap.data() };
            setEditandoId(item.id);
            setNombre(item.nombre || '');
            setEstado(item.estado || 'perdido');
            setEspecie(item.especie || 'Perro');
            setSexo(item.sexo || 'Macho');
            setDescripcion(item.descripcion || '');
            setFotosUris(item.fotos || []);
            setFotosLQUris(item.thumbnailLqUrls || []);
            setProvincia(item.provincia || '');
            setPartido(item.partido || item.localidad || ''); // Fallback data vieja
            setLocalidad(item.localidad || '');
            setBarrio(item.barrio || '');
            setCoords(item.coords || null);
            setTabActiva('publicar');
          }
        } catch (e) { console.log(e); }
      };
      cargarAvisoAEditar();
    }
  }, [editId]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubPerfil = obtenerPerfilUsuario(uid, (data) => {
        setPerfil(data);
        if (!perfilInicialCargadoRef.current) {
            perfilInicialCargadoRef.current = true;
            if (!editId && !editandoId) {
                if (data?.provincia) setProvincia(data.provincia);
                if (data?.partido) setPartido(data.partido);
                else if (data?.localidad) setPartido(data.localidad);
            }
        }
    });

    const q = query(collection(db, 'mascotas'), where('userId', '==', uid), orderBy('createdAt', 'desc'));
    const unsubAvisos = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const ahora = Date.now();
      const tiempoExpiracionMs = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos para prueba APK

      data.forEach(async (aviso) => {
        const creadoEn = aviso.createdAt?.toMillis ? aviso.createdAt.toMillis() : aviso.createdAt;
        if (creadoEn && (ahora - creadoEn > tiempoExpiracionMs)) {
          try {
            const todasLasFotos = [
              ...(aviso.fotos || []),
              ...(aviso.thumbnailLqUrls || []),
              aviso.foto,
              aviso.url
            ].filter(Boolean);
            for (const f of todasLasFotos) {
              await borrarArchivoPorUrl(f).catch(() => {});
            }
            await deleteDoc(doc(db, 'mascotas', aviso.id));
            console.log(`[HUELLITAS AUTO-BORRADO NUEVO] Aviso ${aviso.id} expirado a los 5 min y fotos eliminadas de R2.`);
          } catch (e) { console.log("Error borrando aviso expirado de huellitas:", e); }
        }
      });

      setMisAvisos(data.filter(a => {
        const creadoEn = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt;
        return !creadoEn || (ahora - creadoEn <= tiempoExpiracionMs);
      }));
      setCargando(false);
    });

    const qGuardados = query(collection(db, 'mascotas'), where('likes', 'array-contains', uid));
    const unsubGuardados = onSnapshot(qGuardados, (snap) => {
      setMisGuardados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubPerfil(); unsubAvisos(); unsubGuardados(); };
  }, []);

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

  const handleGetGPS = async () => {
    try {
      setObteniendoGPS(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert("Permiso denegado", "Se necesita permiso de ubicación."); return; }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    } catch (e) { Alert.alert("Error GPS", "No se pudo obtener la ubicación."); } finally { setObteniendoGPS(false); }
  };

  const handlePublicar = async () => {
    if (!descripcion || !provincia || !partido || !localidad) { Alert.alert("Faltan datos", "Indica Provincia, Partido y Localidad."); return; }
    if (fotosUris.length === 0) { Alert.alert("Falta foto", "Sube al menos una foto."); return; }

    if (!editandoId && misAvisos.length >= 5) {
      Alert.alert("Límite alcanzado", "Ya tenés 5 avisos publicados.");
      return;
    }

    setEnviando(true);
    try {
      const uid = auth.currentUser.uid;
      const urls = [];
      const urlsLQ = [];

      for (let i = 0; i < fotosUris.length; i++) {
          const uri = fotosUris[i];
          if (uri.startsWith('http')) {
              urls.push(uri);
              urlsLQ.push(fotosLQUris[i] || null);
          } else {
              // OPTIMIZACIÓN CENTRALIZADA
              const { uriPrincipal, uriLQ } = await procesarImagenCompleta(uri, "HUELLITAS");

              const finalUrl = await subirArchivoConRuta(uriPrincipal, 'foto', `mascotas/${uid}/${Date.now()}_${i}.jpg`);
              urls.push(finalUrl);

              if (uriLQ) {
                  const finalUrlLQ = await subirArchivoConRuta(uriLQ, 'foto', `mascotas/${uid}/${Date.now()}_lq_${i}.jpg`);
                  urlsLQ.push(finalUrlLQ);
              } else {
                  urlsLQ.push(null);
              }
          }
      }

      const data = {
        nombre: nombre.trim(),
        estado,
        especie,
        sexo,
        descripcion: descripcion.trim(),
        fotos: urls,
        thumbnailLqUrls: urlsLQ, // Nueva propiedad
        provincia,
        partido,
        localidad,
        barrio: barrio.trim(),
        coords,
        userId: uid,
        userName: perfil?.nombre || 'Protector',
        userPhoto: perfil?.fotoUrl || null,
      };

      if (editandoId) {
        // LÓGICA DE LIMPIEZA DE IMÁGENES HUÉRFANAS (STORAGE/R2)
        const docSnapViejo = await getDoc(doc(db, 'mascotas', editandoId));
        if (docSnapViejo.exists()) {
            const dataAnterior = docSnapViejo.data();
            const fotosViejas = dataAnterior.fotos || [];
            const fotosLQViejas = dataAnterior.thumbnailLqUrls || [];

            for (let i = 0; i < fotosViejas.length; i++) {
                const fotoViejaUrl = fotosViejas[i];
                const fotoLQViejaUrl = fotosLQViejas[i];

                if (fotoViejaUrl && !urls.includes(fotoViejaUrl)) {
                    console.log("[STORAGE] Borrando foto huérfana de mascota editada:", fotoViejaUrl);
                    await borrarArchivoPorUrl(fotoViejaUrl).catch(e => console.log('Error borrando foto huérfana:', e));

                    if (fotoLQViejaUrl) {
                         await borrarArchivoPorUrl(fotoLQViejaUrl).catch(e => console.log('Error borrando foto LQ huérfana:', e));
                    }
                }
            }
        }

        await updateDoc(doc(db, 'mascotas', editandoId), { ...data, updatedAt: serverTimestamp() });
        Alert.alert("¡Actualizado!", "Aviso modificado.");
      } else {
        await addDoc(collection(db, 'mascotas'), { ...data, createdAt: serverTimestamp() });
        Alert.alert("¡Publicado!", "Tu aviso ya está en Huellitas.");
      }

      limpiarFormulario();
      setTabActiva('publicar');
    } catch (e) { Alert.alert("Error", "No se pudo publicar."); }
    finally { setEnviando(false); }
  };

  const limpiarFormulario = () => {
    setNombre(''); setEstado('perdido'); setEspecie(''); setSexo(''); setDescripcion(''); setFotosUris([]); setFotosLQUris([]);
    setEditandoId(null); setProvincia(''); setPartido(''); setLocalidad(''); setBarrio(''); setCoords(null);
  };

  const confirmarEliminar = (petId) => {
    Alert.alert(
      "Eliminar aviso",
      "¿Estás seguro de que quieres borrar este aviso de Huellitas? No podrás recuperarlo.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const docSnap = await getDoc(doc(db, 'mascotas', petId));
              if (docSnap.exists()) {
                const data = docSnap.data();
                const todasLasFotos = [
                  ...(data.fotos || []),
                  ...(data.thumbnailLqUrls || []),
                  data.foto,
                  data.url
                ].filter(Boolean);
                for (const f of todasLasFotos) {
                  await borrarArchivoPorUrl(f);
                }
              }
              await deleteDoc(doc(db, 'mascotas', petId));
              if (editandoId === petId) limpiarFormulario();
            } catch (e) {
              Alert.alert("Error", "No se pudo eliminar el aviso.");
            }
          }
        }
      ]
    );
  };

  const handleEditPress = (item) => {
    setEditandoId(item.id);
    setNombre(item.nombre || '');
    setEstado(item.estado || 'perdido');
    setEspecie(item.especie || '');
    setSexo(item.sexo || '');
    setDescripcion(item.descripcion || '');
    setFotosUris(item.fotos || []);
    setFotosLQUris(item.thumbnailLqUrls || []);
    setProvincia(item.provincia || '');
    setPartido(item.partido || item.localidad || '');
    setLocalidad(item.localidad || '');
    setBarrio(item.barrio || '');
    setCoords(item.coords || null);
    setTabActiva('publicar');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="close" size={32} color="#333" /></TouchableOpacity>
        <Text style={styles.headerTitle}>{editandoId ? 'Editar Aviso' : 'Mis Huellitas'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, tabActiva === 'publicar' && styles.tabActive]} onPress={() => setTabActiva('publicar')}><Text style={[styles.tabText, tabActiva === 'publicar' && styles.tabTextActive]}>Publicar</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tabActiva === 'guardados' && styles.tabActive]} onPress={() => setTabActiva('guardados')}><Text style={[styles.tabText, tabActiva === 'guardados' && styles.tabTextActive]}>Mis Guardados</Text></TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        {tabActiva === 'publicar' ? (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.sectionHeader}>
               <Text style={styles.sectionTitle}>{editandoId ? "Editando aviso" : "Detalles de la mascota"}</Text>
               {editandoId && <TouchableOpacity onPress={limpiarFormulario}><Text style={styles.cancelEdit}>Cancelar edición</Text></TouchableOpacity>}
            </View>

            {(misAvisos.length < 5 || editandoId) ? (
              <>
                <Text style={styles.label}>¿Qué pasó?</Text>
                <View style={styles.gridBotones}>
                  <View style={styles.filaBotones}>
                    <SelectorBtn label="Se perdió" active={estado === 'perdido'} onPress={() => setEstado('perdido')} color="#EF4444" />
                    <SelectorBtn label="Visto" active={estado === 'encontrado'} onPress={() => setEstado('encontrado')} color="#3B82F6" />
                  </View>
                  <View style={styles.filaBotones}>
                    <SelectorBtn label="Adopción" active={estado === 'adopcion'} onPress={() => setEstado('adopcion')} color="#10B981" />
                    <SelectorBtn label="Reencuentro" active={estado === 'reencuentro'} onPress={() => setEstado('reencuentro')} color="#8B5CF6" />
                  </View>
                </View>

                <Text style={styles.label}>Fotos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                  {fotosUris.map((uri, index) => (
                    <View key={index} style={styles.photoBox}>
                        <Image source={{ uri }} style={styles.thumbnail} />
                        <TouchableOpacity style={styles.removeBtn} onPress={() => {
                          setFotosUris(prev => prev.filter((_, i) => i !== index));
                          setFotosLQUris(prev => prev.filter((_, i) => i !== index));
                        }}><Ionicons name="close-circle" size={22} color="#EF4444" /></TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
                {fotosUris.length < 4 && <SelectorFotoHuellitas onFotoSeleccionada={(uri) => setArchivoCapturado({ tipo: 'foto', uri })} fotosActualesCount={fotosUris.length} cerrarCamara={cerrarCamara} />}

                <TextInput style={styles.input} placeholder="Nombre (opcional)" value={nombre} onChangeText={setNombre} />
                <View style={styles.pickerRow}>
                  <View style={{ flex: 1 }}><Text style={styles.label}>Especie</Text><TextInput style={styles.input} placeholder="Perro, Gato..." value={especie} onChangeText={setEspecie} /></View>
                  <View style={{ flex: 1, marginLeft: 15 }}><Text style={styles.label}>Sexo</Text><TextInput style={styles.input} placeholder="M/H" value={sexo} onChangeText={setSexo} /></View>
                </View>

                <Text style={styles.label}>Descripción</Text>
                <TextInput style={[styles.input, styles.textArea]} placeholder="Señas particulares..." multiline value={descripcion} onChangeText={setDescripcion} />

                <Text style={styles.label}>Ubicación</Text>
                {(() => {
                  const isBsAs = provincia === 'Buenos Aires';
                  const labelPartido = isBsAs ? 'Partido' : 'Departamento';
                  const labelLocalidad = isBsAs ? 'Localidad' : 'Municipio';

                  return (
                    <>
                      <SelectorItem label="Provincia" value={provincia} onPress={() => setModalProvVisible(true)} />
                      <SelectorItem label={labelPartido} value={partido} onPress={() => setModalPartVisible(true)} disabled={!provincia} />
                      <SelectorItem label={labelLocalidad} value={localidad} onPress={() => setModalLocVisible(true)} disabled={!partido} />
                    </>
                  );
                })()}
                <TextInput style={[styles.input, {marginTop: 10}]} placeholder="Barrio (Ej: Pompeya) - Opcional" value={barrio} onChangeText={setBarrio} />

                <View style={[styles.gpsBtnArea, coords && styles.gpsBtnActive]}>
                   <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} onPress={handleGetGPS} disabled={obteniendoGPS}>
                      {obteniendoGPS ? <ActivityIndicator color={coords ? "white" : "#10B981"} /> : (
                        <>
                          <Ionicons name={coords ? "location" : "location-outline"} size={22} color={coords ? "white" : "#10B981"} />
                          <Text style={[styles.gpsBtnText, coords && {color:'white'}]}>{coords ? "GPS Capturado ✅" : "Adjuntar GPS (Opcional)"}</Text>
                        </>
                      )}
                   </TouchableOpacity>
                   {coords && !obteniendoGPS && <TouchableOpacity onPress={() => setCoords(null)} style={styles.gpsDelete}><Ionicons name="close-circle" size={24} color="white" /></TouchableOpacity>}
                </View>

                <TouchableOpacity style={[styles.btnPublicar, enviando && { opacity: 0.5 }, editandoId && { backgroundColor: '#3B82F6' }]} onPress={handlePublicar} disabled={enviando}>
                  {enviando ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>{editandoId ? 'Guardar Cambios' : 'Publicar Aviso'}</Text>}
                </TouchableOpacity>

                <Text style={{ textAlign: 'center', color: '#6B7280', fontSize: 11, marginTop: 12, paddingHorizontal: 10, fontWeight: '600' }}>
                  ⚠️ La venta de animales está estrictamente prohibida en la app y resultará en la baja de la cuenta.
                </Text>
              </>
            ) : <View style={styles.limitBox}><Ionicons name="warning" size={20} color="#B45309" /><Text style={styles.limitTxt}>Ya tenés 5 avisos.</Text></View>}

            {misAvisos.length > 0 && (
              <View style={{ marginTop: 40 }}>
                <Text style={styles.label}>Mis avisos</Text>
                {misAvisos.map(item => (
                  <TouchableOpacity key={item.id} style={styles.itemMio} onPress={() => router.push({ pathname: '/huellitas/detalle', params: { petId: item.id } })}>
                    <Image source={{ uri: item.fotos?.[0] }} style={styles.itemMioThumb} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.itemMioTitle}>{item.nombre || item.especie}</Text>
                      <View style={[styles.miniStatus, { backgroundColor: item.estado === 'perdido' ? '#FEE2E2' : '#DBEAFE' }]}><Text style={[styles.miniStatusTxt, { color: item.estado === 'perdido' ? '#B91C1C' : '#1E40AF' }]}>{item.estado.toUpperCase()}</Text></View>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                      <TouchableOpacity onPress={() => handleEditPress(item)} style={{ marginRight: 15 }}><Ionicons name="create-outline" size={24} color="#3B82F6" /></TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmarEliminar(item.id)}><Ionicons name="trash-outline" size={24} color="#EF4444" /></TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        ) : (
          <FlatList data={misGuardados} keyExtractor={item => item.id} contentContainerStyle={styles.listGuardados} renderItem={({ item }) => (
            <TouchableOpacity style={styles.itemMio} onPress={() => router.push({ pathname: '/huellitas/detalle', params: { petId: item.id } })}>
              <Image source={{ uri: item.fotos?.[0] }} style={styles.itemMioThumb} />
              <View style={{ flex: 1, marginLeft: 10 }}><Text style={styles.itemMioTitle}>{item.nombre || item.especie}</Text><Text style={styles.itemMioSub}>{item.localidad}, {item.barrio}</Text></View>
              <TouchableOpacity onPress={async () => { await updateDoc(doc(db,'mascotas',item.id),{likes:arrayRemove(auth.currentUser.uid)}); }}><Ionicons name="heart" size={26} color="#FF6600" /></TouchableOpacity>
            </TouchableOpacity>
          )} />
        )}
      </KeyboardAvoidingView>

      <SelectorModal visible={modalProvVisible} onClose={() => setModalProvVisible(false)} data={PROVINCIAS_ARGENTINA} onSelect={(i) => {setProvincia(i); setPartido(''); setLocalidad(''); setModalProvVisible(false);}} titulo="Provincia" />
      <SelectorModal visible={modalPartVisible} onClose={() => setModalPartVisible(false)} data={partidos} onSelect={(i) => {setPartido(i); setLocalidad(''); setModalPartVisible(false);}} titulo={provincia === 'Buenos Aires' ? "Partido" : "Departamento"} cargando={cargandoPart} />
      <SelectorModal visible={modalLocVisible} onClose={() => setModalLocVisible(false)} data={localidades} onSelect={(i) => {setLocalidad(i); setModalLocVisible(false);}} titulo={provincia === 'Buenos Aires' ? "Localidad" : "Municipio"} cargando={cargandoLoc} />

      <Modal visible={!!archivoCapturado} animationType="slide">
        {archivoCapturado && (
          <VistaPrevia
            archivo={archivoCapturado}
            onDescartar={() => setArchivoCapturado(null)}
            onPublicar={(texto, uri) => {
              setFotosUris((prev) => [...prev, uri].slice(0, 4));
              setArchivoCapturado(null);
              setCerrarCamara((current) => current + 1);
            }}
          />
        )}
      </Modal>
    </View>
  );
}

function SelectorModal({ visible, onClose, data, onSelect, titulo, cargando }) {
  const [search, setSearch] = useState('');
  const filtrados = data.filter(i => i.toLowerCase().includes(search.toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" transparent><View style={styles.selModalOverlay}><View style={styles.selModalContent}>
    <View style={styles.selModalHeader}><Text style={styles.selModalTitle}>{titulo}</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#333" /></TouchableOpacity></View>
    <View style={styles.selModalSearch}><Ionicons name="search" size={18} color="#999" /><TextInput placeholder="Buscar..." style={styles.selModalSearchInput} value={search} onChangeText={setSearch} /></View>
    {cargando ? <ActivityIndicator color="#10B981" style={{margin: 20}} /> : <FlatList data={filtrados} keyExtractor={(item, index) => `${item}-${index}`} renderItem={({item}) => (<TouchableOpacity style={styles.selModalItem} onPress={() => { onSelect(item); setSearch(''); }}><Text style={styles.selModalItemText}>{item}</Text></TouchableOpacity>)} contentContainerStyle={{ paddingBottom: 60 }} />}
    </View></View></Modal>
  );
}

function SelectorBtn({ label, active, onPress, color }) {
  return (<TouchableOpacity style={[styles.selBtn, active && { backgroundColor: color, borderColor: color }]} onPress={onPress}><Text style={[styles.selBtnTxt, active && { color: 'white' }]}>{label}</Text></TouchableOpacity>);
}

function SelectorItem({ label, value, onPress, disabled }) {
  return (<TouchableOpacity style={[styles.locationSelector, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}><Text style={styles.locationSelectorTxt}>{label}: {value || "Seleccionar..."}</Text><Ionicons name="chevron-down" size={16} color="#6B7280" /></TouchableOpacity>);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  backBtn: { padding: 5 },
  scroll: { padding: 20, paddingBottom: 350 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8, marginTop: 15 },
  gridBotones: { gap: 10 }, filaBotones: { flexDirection: 'row', gap: 10 },
  pickerRow: { flexDirection: 'row', gap: 10 },
  selBtn: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  selBtnTxt: { fontSize: 12, fontWeight: '800', color: '#6B7280' },
  photosScroll: { flexDirection: 'row', marginBottom: 10 },
  photoBox: { width: 80, height: 80, borderRadius: 10, marginRight: 10, position: 'relative' },
  thumbnail: { width: '100%', height: '100%', borderRadius: 10 },
  removeBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: 'white', borderRadius: 10 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 5 },
  textArea: { height: 100, textAlignVertical: 'top' },
  btnPublicar: { backgroundColor: '#10B981', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 30, elevation: 3 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  limitBox: { flexDirection: 'row', backgroundColor: '#FFFBEB', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FEF3C7', alignItems: 'center', gap: 10, marginTop: 20 },
  limitTxt: { flex: 1, color: '#B45309', fontSize: 14, lineHeight: 20 },
  itemMio: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F9FAFB', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6', elevation: 1 },
  itemMioThumb: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#EEE' },
  itemMioTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  miniStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  miniStatusTxt: { fontSize: 9, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#374151' },
  cancelEdit: { color: '#EF4444', fontWeight: '700', fontSize: 13 },
  gpsBtnArea: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#10B981', marginTop: 20, backgroundColor: 'white' },
  gpsBtnActive: { backgroundColor: '#10B981' },
  gpsBtnText: { marginLeft: 10, color: '#10B981', fontWeight: 'bold' },
  gpsDelete: { paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.3)' },
  locationSelector: { flex: 1, height: 48, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 10 },
  locationSelectorTxt: { fontSize: 14, fontWeight: '600', color: '#111827' },
  selModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  selModalContent: { backgroundColor: 'white', height: '80%', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20 },
  selModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  selModalTitle: { fontSize: 18, fontWeight: 'bold' },
  selModalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, height: 46 },
  selModalSearchInput: { flex: 1, marginLeft: 10 },
  selModalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  selModalItemText: { fontSize: 16, color: '#333' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#10B981' },
  tabText: { fontSize: 14, fontWeight: 'bold', color: '#6B7280' },
  tabTextActive: { color: '#10B981' },
  listGuardados: { padding: 16 }
});
