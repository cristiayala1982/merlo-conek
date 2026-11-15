import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, arrayRemove, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VistaPrevia from '../../../components/camara/VistaPrevia';
import { procesarImagenCompleta } from '../../../components/camaraFotos/OptimizadorImagenes';
import SelectorFotoClasificados from '../../../components/camaraFotos/SelectorFotoClasificados';
import { showToast } from '../../../components/utilidades/CustomToast';
import { auth, db } from '../../../firebaseConfig';
import { formatearFechaVencimiento } from '../../../services/dateUtils';
import { enviarReporte } from '../../../services/firebase/reportService';
import { crearNotificacionModeracion, obtenerPerfilUsuario, subirArchivoConRuta, borrarArchivoPorUrl } from '../../../services/firebaseService';
import { evaluarImagenSensible } from '../../../services/imageModerationService';
import { obtenerPartidosDeProvincia, obtenerLocalidadesDePartido } from '../../../constants/geografiaArgentina';

const { width } = Dimensions.get('window');

const PROVINCIAS_ARGENTINA = [
  "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Ciudad Autónoma de Buenos Aires",
  "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
  "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
].sort();

export default function NuevoClasificado() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { editId } = useLocalSearchParams();

  const [misOficios, setMisOficios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [perfil, setPerfil] = useState(null);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fotosUris, setFotosUris] = useState([]);
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
  const [tabActiva, setTabActiva] = useState('publicar');
  const [misGuardados, setMisGuardados] = useState([]);
  const prevProvinciaRef = useRef(null);
  const perfilInicialCargadoRef = useRef(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { router.replace('/(tabs)/home'); return; }

    const unsubPerfil = obtenerPerfilUsuario(uid, (data) => {
        setPerfil(data);
        if (!perfilInicialCargadoRef.current) {
            perfilInicialCargadoRef.current = true;
            if (!editId) {
                if (data?.provincia) setProvincia(data.provincia);
                if (data?.partido) setPartido(data.partido);
                else if (data?.localidad) setPartido(data.localidad);
                if (data?.localidadInterna) setLocalidad(data.localidadInterna);
            }
        }
    });

    if (editId) {
        getDoc(doc(db, 'clasificados', editId)).then(snap => {
            if (snap.exists()) {
                const item = snap.data();
                setEditandoId(snap.id);
                setTitulo(item.titulo || '');
                setDescripcion(item.descripcion || '');
                setBarrio(item.barrio || '');
                setProvincia(item.provincia || '');
                setPartido(item.partido || item.localidad || '');
                setLocalidad(item.localidad || '');
                setFotosUris(item.fotosServicio || (item.fotoServicio ? [item.fotoServicio] : []));
                setCoords(item.coords || null);
            }
        });
    }

    const q = query(collection(db, 'clasificados'), where('userId', '==', uid), orderBy('createdAt', 'desc'));
    const unsubOficios = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(item => item.status !== 'rechazado' && item.status !== 'rechazado_visto');
      setMisOficios(data);
      setCargando(false);
    });

    const qGuardados = query(collection(db, 'clasificados'), where('likes', 'array-contains', uid));
    const unsubGuardados = onSnapshot(qGuardados, (snap) => setMisGuardados(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubPerfil(); unsubOficios(); unsubGuardados(); };
  }, [editId]);

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
    if (!titulo || !descripcion || !provincia || !partido || !localidad) {
      Alert.alert("Faltan datos", "Indica Título, Descripción y Ubicación completa.");
      return;
    }
    if (fotosUris.length === 0) { Alert.alert("Falta foto", "Sube al menos una foto del servicio."); return; }

    if (!editandoId && misOficios.length >= 5) {
      Alert.alert("Límite alcanzado", "Ya tenés 5 publicaciones activas.");
      return;
    }

    setEnviando(true);
    try {
      const uid = auth.currentUser.uid;
      const urls = [];
      const urlsLQ = [];
      let estadoModeracion = 'ready';
      let evaluacionClasificado = null;

      // Evaluar únicamente la Foto Principal (Portada #1) para ahorrar 75% de cuota de la nube
      if (fotosUris.length > 0 && !fotosUris[0].startsWith('http')) {
        try {
          const { uriPrincipal } = await procesarImagenCompleta(fotosUris[0], "CLASIFICADOS");
          evaluacionClasificado = await evaluarImagenSensible(uriPrincipal || fotosUris[0]);

          if (evaluacionClasificado.accion === 'PENDIENTE_REVISION' || evaluacionClasificado.accion === 'ERROR' || evaluacionClasificado.accion === 'BLOQUEAR') {
            estadoModeracion = 'pendiente_revision';
          }
        } catch (errEval) {
          console.log("Error evaluando moderación en Clasificados:", errEval);
          estadoModeracion = 'pendiente_revision';
        }
      }

      for (let i = 0; i < fotosUris.length; i++) {
          const uri = fotosUris[i];
          if (uri.startsWith('http')) {
              urls.push(uri);
              urlsLQ.push(null);
          } else {
              const { uriPrincipal, uriLQ } = await procesarImagenCompleta(uri, "CLASIFICADOS");

              const finalUrl = await subirArchivoConRuta(uriPrincipal, 'foto', `clasificados/${uid}/${Date.now()}_${i}.jpg`);
              urls.push(finalUrl);

              if (uriLQ) {
                  const finalUrlLQ = await subirArchivoConRuta(uriLQ, 'foto', `clasificados/${uid}/${Date.now()}_lq_${i}.jpg`);
                  urlsLQ.push(finalUrlLQ);
              } else {
                  urlsLQ.push(null);
              }
          }
      }

      const data = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        barrio: barrio.trim(),
        provincia, partido, localidad, coords,
        fotosServicio: urls,
        thumbnailLqUrls: urlsLQ,
        userId: uid,
        userName: perfil?.nombre || 'Usuario',
        userPhoto: perfil?.fotoUrl || null,
        status: estadoModeracion,
        updatedAt: serverTimestamp()
      };

      if (editandoId) {
        // LÓGICA DE LIMPIEZA DE IMÁGENES HUÉRFANAS (STORAGE/R2)
        const docSnapViejo = await getDoc(doc(db, 'clasificados', editandoId));
        if (docSnapViejo.exists()) {
            const dataAnterior = docSnapViejo.data();
            const fotosViejas = dataAnterior.fotosServicio || [];
            const fotosLQViejas = dataAnterior.thumbnailLqUrls || [];

            // Si una foto vieja ya NO está en el nuevo array (urls), significa que el usuario la borró.
            // Entonces, vamos a R2 y la pulverizamos para no dejar basura.
            for (let i = 0; i < fotosViejas.length; i++) {
                const fotoViejaUrl = fotosViejas[i];
                const fotoLQViejaUrl = fotosLQViejas[i];

                if (fotoViejaUrl && !urls.includes(fotoViejaUrl)) {
                    console.log("[STORAGE] Borrando foto huérfana de clasificado editado:", fotoViejaUrl);
                    await borrarArchivoPorUrl(fotoViejaUrl).catch(e => console.log('Error borrando foto huérfana:', e));

                    if (fotoLQViejaUrl) {
                         await borrarArchivoPorUrl(fotoLQViejaUrl).catch(e => console.log('Error borrando foto LQ huérfana:', e));
                    }
                }
            }
        }

        await updateDoc(doc(db, 'clasificados', editandoId), data);
        if (estadoModeracion === 'pendiente_revision') {
          await enviarReporte({
            tipo: 'clasificados_moderacion_automatica',
            idContenido: editandoId,
            idPost: editandoId,
            idAutor: uid,
            motivo: 'Imagen principal en Clasificados requiere revisión por moderación automática',
            extraData: {
              url: urls[0] || null,
              thumbnailUrl: urlsLQ[0] || null,
              userName: perfil?.nombre || 'Usuario',
              userPhotoUrl: perfil?.fotoUrl || null,
              seccion: 'clasificados',
              titulo: titulo.trim(),
              puntajeSensibilidad: evaluacionClasificado?.puntaje || 0,
              detalles: evaluacionClasificado?.detalles || {},
              errorModeracion: evaluacionClasificado?.accion === 'ERROR' ? evaluacionClasificado.motivo : null,
              collectionName: 'clasificados',
              fotosServicio: urls
            }
          });
          try {
            await crearNotificacionModeracion({
              paraUserId: uid,
              tipo: 'clasificado_en_revision',
              postId: editandoId,
              collectionName: 'clasificados',
              texto: 'Tu anuncio en Clasificados está en revisión por nuestro equipo de moderación.'
            });
          } catch (eNotif) { console.error('Error al crear notificación de revisión de Clasificados:', eNotif); }
          showToast('Tu publicación está en revisión por nuestro equipo de moderación.', 'review');
        } else {
          Alert.alert("¡Éxito!", "Anuncio actualizado.");
        }
      } else {
        const docRef = await addDoc(collection(db, 'clasificados'), { ...data, createdAt: serverTimestamp() });
        if (estadoModeracion === 'pendiente_revision') {
          await enviarReporte({
            tipo: 'clasificados_moderacion_automatica',
            idContenido: docRef.id,
            idPost: docRef.id,
            idAutor: uid,
            motivo: 'Imagen principal en Clasificados requiere revisión por moderación automática',
            extraData: {
              url: urls[0] || null,
              thumbnailUrl: urlsLQ[0] || null,
              userName: perfil?.nombre || 'Usuario',
              userPhotoUrl: perfil?.fotoUrl || null,
              seccion: 'clasificados',
              titulo: titulo.trim(),
              puntajeSensibilidad: evaluacionClasificado?.puntaje || 0,
              detalles: evaluacionClasificado?.detalles || {},
              errorModeracion: evaluacionClasificado?.accion === 'ERROR' ? evaluacionClasificado.motivo : null,
              collectionName: 'clasificados',
              fotosServicio: urls
            }
          });
          try {
            await crearNotificacionModeracion({
              paraUserId: uid,
              tipo: 'clasificado_en_revision',
              postId: docRef.id,
              collectionName: 'clasificados',
              texto: 'Tu anuncio en Clasificados está en revisión por nuestro equipo de moderación.'
            });
          } catch (eNotif) { console.error('Error al crear notificación de revisión de Clasificados:', eNotif); }
          showToast('Tu publicación está en revisión por nuestro equipo de moderación.', 'review');
        } else {
          Alert.alert("¡Éxito!", "Oficio publicado.", [
            { text: "OK", onPress: () => limpiarFormulario() },
            { text: "🚀 Impulsar", onPress: () => router.replace({ pathname: '/alertas/clasificados/promocionar', params: { postId: docRef.id } }) }
          ]);
        }
      }
      limpiarFormulario();
    } catch (e) { Alert.alert("Error", "No se pudo publicar."); }
    finally { setEnviando(false); }
  };

  const limpiarFormulario = () => {
    setTitulo(''); setDescripcion(''); setBarrio(''); setFotosUris([]); setEditandoId(null);
    setProvincia(''); setPartido(''); setLocalidad(''); setCoords(null);
  };

  const handleEditPress = (item) => {
    setEditandoId(item.id);
    setTitulo(item.titulo || '');
    setDescripcion(item.descripcion || '');
    setBarrio(item.barrio || '');
    setProvincia(item.provincia || '');
    setPartido(item.partido || item.localidad || '');
    setLocalidad(item.localidad || '');
    setFotosUris(item.fotosServicio || (item.fotoServicio ? [item.fotoServicio] : []));
    setCoords(item.coords || null);
  };

  const confirmarEliminar = (id) => {
    Alert.alert("Eliminar", "¿Seguro que quieres borrar este anuncio?", [
      { text: "No" },
      { text: "Sí, borrar", style: "destructive", onPress: async () => {
          try {
            const docSnap = await getDoc(doc(db, 'clasificados', id));
            if (docSnap.exists()) {
              const data = docSnap.data();
              const todasLasFotos = [
                ...(data.fotosServicio || []),
                ...(data.thumbnailLqUrls || []),
                data.fotoServicio,
                data.thumbnailUrl,
                data.url
              ].filter(Boolean);

              for (const f of todasLasFotos) {
                await borrarArchivoPorUrl(f);
              }
            }
            await deleteDoc(doc(db, 'clasificados', id));
            if (editandoId === id) limpiarFormulario();
          } catch (e) { Alert.alert("Error", "No se pudo eliminar."); }
      }}
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="close" size={32} color="#111827" /></TouchableOpacity>
        <Text style={styles.headerTitle}>{editandoId ? 'Editar Anuncio' : 'Mis Clasificados'}</Text>
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
               <Text style={styles.sectionTitle}>{editandoId ? "Editando anuncio" : "Detalles del servicio"}</Text>
               {editandoId && <TouchableOpacity onPress={limpiarFormulario}><Text style={styles.cancelEdit}>Cancelar edición</Text></TouchableOpacity>}
            </View>

            {(misOficios.length < 5 || editandoId) ? (
              <View style={styles.form}>
                <View style={styles.multiMediaSection}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosScroll}>
                    {fotosUris.map((uri, index) => (
                      <View key={index} style={styles.photoContainer}>
                        <Image source={{ uri }} style={styles.thumbnail} />
                        <TouchableOpacity style={styles.removeBadge} onPress={() => setFotosUris(p => p.filter((_, i) => i !== index))}><Ionicons name="close-circle" size={22} color="#EF4444" /></TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                  {fotosUris.length < 4 && <SelectorFotoClasificados onFotoSeleccionada={(u) => setArchivoCapturado({tipo:'foto', uri:u})} fotosActualesCount={fotosUris.length} cerrarCamara={cerrarCamara} />}
                </View>

                <TextInput style={styles.input} placeholder="¿Qué hacés? (ej: Plomero)" value={titulo} onChangeText={setTitulo} />
                <TextInput style={[styles.input, styles.textArea]} placeholder="Descripción y contacto..." multiline value={descripcion} onChangeText={setDescripcion} />

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
                <TextInput style={styles.input} placeholder="Barrio (Ej: Pompeya) - Opcional" value={barrio} onChangeText={setBarrio} />

                <View style={[styles.gpsBtnArea, coords && styles.gpsBtnActive]}>
                   <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} onPress={handleGetGPS} disabled={obteniendoGPS}>
                      {obteniendoGPS ? <ActivityIndicator color={coords ? "white" : "#059669"} /> : (
                        <>
                          <Ionicons name={coords ? "location" : "location-outline"} size={22} color={coords ? "white" : "#059669"} />
                          <Text style={[styles.gpsBtnText, coords && {color:'white'}]}>{coords ? "GPS Capturado ✅" : "Adjuntar GPS (Opcional)"}</Text>
                        </>
                      )}
                   </TouchableOpacity>
                   {coords && !obteniendoGPS && <TouchableOpacity onPress={() => setCoords(null)} style={styles.gpsDelete}><Ionicons name="close-circle" size={24} color="white" /></TouchableOpacity>}
                </View>

                <TouchableOpacity style={[styles.btnPublicar, enviando && { opacity: 0.6 }, editandoId && { backgroundColor: '#3B82F6' }]} onPress={handlePublicar} disabled={enviando}>
                  {enviando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>{editandoId ? 'Guardar Cambios' : 'Publicar Ahora'}</Text>}
                </TouchableOpacity>
              </View>
            ) : <View style={styles.limitBox}><Ionicons name="warning" size={20} color="#B45309" /><Text style={styles.limitTxt}>Ya tenés 5 anuncios.</Text></View>}

            {misOficios.length > 0 && (
              <View style={{ marginTop: 40 }}>
                <Text style={styles.label}>Mis anuncios</Text>
                {misOficios.map(item => {
                  const ahora = Date.now();
                  const vence = item.vencimientoPremium?.toMillis ? item.vencimientoPremium.toMillis() : (item.vencimientoPremium || 0);
                  const estaVencido = item.esPremium && ahora >= vence;
                  const esVigente = item.esPremium && ahora < vence;

                  return (
                    <TouchableOpacity key={item.id} style={styles.cardMio} onPress={() => router.push({ pathname: '/alertas/clasificados/detalle', params: { postId: item.id } })}>
                      <View style={styles.cardMioTop}>
                        <View style={styles.imageColumn}>
                          <Image source={{ uri: item.fotosServicio?.[0] }} style={styles.itemThumb} />
                          {esVigente && (
                            <View style={[styles.statusBadgeFull, { backgroundColor: '#FF6600' }]}>
                              <Text style={styles.statusBadgeText}>IMPULSADO</Text>
                            </View>
                          )}
                          {estaVencido && (
                            <View style={[styles.statusBadgeFull, { backgroundColor: '#EF4444' }]}>
                              <Text style={styles.statusBadgeText}>IMPULSO VENCIDO</Text>
                            </View>
                          )}
                        </View>

                        <View style={{ flex: 1, marginLeft: 10, justifyContent: 'center' }}>
                          <Text style={styles.oficioTitle} numberOfLines={1}>{item.titulo}</Text>
                          <View style={styles.locationRowMini}>
                            <Ionicons name="location" size={14} color="#6B7280" />
                            <Text style={styles.userSub}>{item.localidad}</Text>
                          </View>
                        </View>

                        <View style={styles.actionsColumn}>
                          <TouchableOpacity onPress={() => handleEditPress(item)} style={styles.actionBtnIcon}>
                            <Ionicons name="create-outline" size={20} color="#059669" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => confirmarEliminar(item.id)} style={styles.actionBtnIcon}>
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {(item.publicidadPendiente || item.status === 'pendiente_revision') && (
                        <View style={styles.pendingBadgePill}>
                          <Ionicons name="time-outline" size={14} color="#D97706" />
                          <Text style={styles.pendingBadgeTextPill}>En Revisión ⏳</Text>
                        </View>
                      )}

                      {item.esPremium && item.vencimientoPremium && (
                        <View style={styles.vencimientoRow}>
                           <Ionicons name="calendar-outline" size={12} color={estaVencido ? "#EF4444" : "#6B7280"} />
                           <Text style={[styles.vencimientoTxt, estaVencido && { color: '#EF4444', fontWeight: 'bold' }]}>
                             {estaVencido ? 'Venció el ' : 'Vence el '}
                             {formatearFechaVencimiento(item.vencimientoPremium)}
                           </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        ) : (
          <FlatList data={misGuardados} keyExtractor={item => item.id} contentContainerStyle={styles.listGuardados} renderItem={({ item }) => (
            <TouchableOpacity style={styles.cardMio} onPress={() => router.push({ pathname: '/alertas/clasificados/detalle', params: { postId: item.id } })}>
                <Image source={{ uri: item.fotosServicio?.[0] }} style={styles.itemThumb} />
                <View style={{ flex: 1 }}><Text style={styles.oficioTitle}>{item.titulo}</Text><Text style={styles.userSub}>{item.localidad}</Text></View>
                <TouchableOpacity onPress={async () => { await updateDoc(doc(db,'clasificados',item.id),{likes:arrayRemove(auth.currentUser.uid)}); }}><Ionicons name="heart" size={26} color="#FF6600" /></TouchableOpacity>
            </TouchableOpacity>
          )} />
        )}
      </KeyboardAvoidingView>

      <SelectorModal visible={modalProvVisible} onClose={()=>setModalProvVisible(false)} data={PROVINCIAS_ARGENTINA} onSelect={(i)=>{setProvincia(i);setPartido('');setLocalidad('');setModalProvVisible(false);}} titulo="Provincia" />
      <SelectorModal visible={modalPartVisible} onClose={()=>setModalPartVisible(false)} data={partidos} onSelect={(i)=>{setPartido(i);setLocalidad('');setModalPartVisible(false);}} titulo={provincia === 'Buenos Aires' ? "Partido" : "Departamento"} cargando={cargandoPart} />
      <SelectorModal visible={modalLocVisible} onClose={()=>setModalLocVisible(false)} data={localidades} onSelect={(i)=>{setLocalidad(i);setModalLocVisible(false);}} titulo={provincia === 'Buenos Aires' ? "Localidad" : "Municipio"} cargando={cargandoLoc} />

      <Modal visible={!!archivoCapturado} animationType="slide">{archivoCapturado && <VistaPrevia archivo={archivoCapturado} onDescartar={() => setArchivoCapturado(null)} onPublicar={(t, u) => {setFotosUris(p => [...p, u].slice(0,4)); setArchivoCapturado(null); setCerrarCamara((current) => current + 1);}} />}</Modal>
    </View>
  );
}

function SelectorItem({ label, value, onPress, disabled }) {
  return (<TouchableOpacity style={[styles.locationSelector, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}><Text style={styles.locationSelectorTxt}>{label}: {value || "Seleccionar..."}</Text><Ionicons name="chevron-down" size={16} color="#6B7280" /></TouchableOpacity>);
}

function SelectorModal({ visible, onClose, data, onSelect, titulo, cargando }) {
  const [search, setSearch] = useState('');
  const filtrados = data.filter(i => i.toLowerCase().includes(search.toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" transparent><View style={styles.selModalOverlay}><View style={styles.selModalContent}>
    <View style={styles.selModalHeader}><Text style={styles.selModalTitle}>{titulo}</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#333" /></TouchableOpacity></View>
    <View style={styles.selModalSearch}><Ionicons name="search" size={18} color="#999" /><TextInput placeholder="Buscar..." style={styles.selModalSearchInput} value={search} onChangeText={setSearch} /></View>
    {cargando ? <ActivityIndicator color="#059669" style={{margin: 20}} /> : <FlatList data={filtrados} keyExtractor={(item, index) => `${item}-${index}`} renderItem={({item}) => (<TouchableOpacity style={styles.selModalItem} onPress={() => { onSelect(item); setSearch(''); }}><Text style={styles.selModalItemText}>{item}</Text></TouchableOpacity>)} contentContainerStyle={{ paddingBottom: 60 }} />}
    </View></View></Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  backBtn: { padding: 4 },
  scroll: { padding: 20, paddingBottom: 350 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#374151' },
  cancelEdit: { color: '#EF4444', fontWeight: '700', fontSize: 13 },
  form: { gap: 12 }, label: { fontSize: 14, fontWeight: 'bold', color: '#374151' },
  multiMediaSection: { marginBottom: 10 }, photosScroll: { gap: 10, paddingRight: 20 },
  photoContainer: { width: 100, height: 100, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  thumbnail: { width: '100%', height: '100%' },
  removeBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: 'white', borderRadius: 11 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 15 },
  textArea: { height: 100, textAlignVertical: 'top' },
  btnPublicar: { backgroundColor: '#059669', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 30, elevation: 3 },
  btnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  cardMio: { backgroundColor: '#F9FAFB', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6', elevation: 1, overflow: 'hidden' },
  cardMioTop: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  itemThumb: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#EEE' },
  oficioTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  userSub: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  locationRowMini: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  pendingBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginHorizontal: 12,
    marginBottom: 10,
    gap: 6,
    alignSelf: 'flex-start',
  },
  pendingBadgeTextPill: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
  },
  pendingBadgeFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEDD5',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#FFB800',
    gap: 6
  },
  pendingBadgeTextFull: {
    fontSize: 10,
    fontWeight: '900',
    color: '#B45309',
    letterSpacing: 0.5
  },
  actionsColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 10
  },
  actionBtnIcon: {
    padding: 6,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F3F4F6'
  },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#059669' },
  tabText: { fontSize: 14, fontWeight: 'bold', color: '#6B7280' },
  tabTextActive: { color: '#059669' },
  listGuardados: { padding: 16 },
  gpsBtnArea: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#059669', marginTop: 20, backgroundColor: 'white' },
  gpsBtnActive: { backgroundColor: '#059669' },
  gpsBtnText: { marginLeft: 10, color: '#059669', fontWeight: 'bold' },
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
  imageColumn: {
    alignItems: 'center',
    width: 95
  },
  statusBadgeFull: {
    marginTop: 4,
    paddingVertical: 3,
    width: '100%',
    borderRadius: 4,
    alignItems: 'center'
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center'
  },
  vencimientoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12
  },
  vencimientoTxt: {
    fontSize: 14,
    color: '#4B5563'
  }
});
