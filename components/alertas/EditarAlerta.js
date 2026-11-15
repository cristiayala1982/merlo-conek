import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebaseConfig';
import { borrarArchivoPorUrl, subirArchivoConRuta } from '../../services/firebase/storageService';
import SelectorFotoComunidad from '../camaraFotos/SelectorFotoComunidad';
import VistaPrevia from '../camara/VistaPrevia';
import { obtenerLocalidadesDePartido } from '../../constants/geografiaArgentina';

export default function EditarAlerta({ visible, post, onClose }) {
  const [nuevoTexto, setNuevoTexto] = useState(post?.texto || '');
  const [nuevoBarrio, setNuevoBarrio] = useState(post?.barrio || '');
  const [tipoAlerta, setTipoAlerta] = useState(post?.tipo || 'Alerta');
  const [localidad, setLocalidad] = useState(post?.localidad || '');
  const [partido, setPartido] = useState(post?.partido || post?.ciudad || 'Merlo');
  const [provincia, setProvincia] = useState(post?.provincia || 'Buenos Aires');

  const [guardando, setGuardando] = useState(false);
  const [nuevaMedia, setNuevaMedia] = useState(null);
  const [mediaEliminada, setMediaEliminada] = useState(false);
  const [archivoCapturado, setArchivoCapturado] = useState(null); // Para el modal de VistaPrevia

  // Modales Ubicación
  const [modalLocVisible, setModalLocVisible] = useState(false);
  const [localidades, setLocalidades] = useState([]);
  const [cargandoLoc, setCargandoLoc] = useState(false);

  useEffect(() => {
    if (visible && post) {
        setNuevoTexto(post.texto || '');
        setNuevoBarrio(post.barrio || '');
        setTipoAlerta(post.tipo || 'Alerta');
        setLocalidad(post.localidad || '');
        setPartido(post.partido || post.ciudad || 'Merlo');
        setProvincia(post.provincia || 'Buenos Aires');
    }
  }, [visible, post]);

  const cargarLocalidades = (part, prov) => {
    setLocalidades(obtenerLocalidadesDePartido(part, prov));
  };

  useEffect(() => {
    if (partido && provincia) cargarLocalidades(partido, provincia);
  }, [partido, provincia]);

  const handleConfirmarVistaPrevia = async (textoPreview, uriEditada) => {
    setNuevaMedia({
      uri: uriEditada || archivoCapturado.uri,
      tipo: archivoCapturado.tipo
    });
    setMediaEliminada(false);
    setArchivoCapturado(null);
  };

  const handleGuardar = async () => {
    if (!nuevoBarrio.trim() || !localidad) {
      Alert.alert("Datos faltantes", "Por favor completa la ubicación.");
      return;
    }

    try {
      setGuardando(true);
      const alertId = post.id || post.postId;
      const alertRef = doc(db, 'alertas_comunitarias', alertId);
      const updates = {
        texto: nuevoTexto.trim(),
        barrio: nuevoBarrio.trim(),
        localidad: localidad,
        tipo: tipoAlerta,
        updatedAt: serverTimestamp()
      };

      // Lógica de limpieza y subida de archivos a R2
      if (nuevaMedia || mediaEliminada) {
        // 1. Borrar archivos viejos
        if (post?.url) await borrarArchivoPorUrl(post.url).catch(() => {});
        if (post?.thumbnailUrl) await borrarArchivoPorUrl(post.thumbnailUrl).catch(() => {});
        if (post?.thumbnailLqUrl) await borrarArchivoPorUrl(post.thumbnailLqUrl).catch(() => {});

        if (mediaEliminada && !nuevaMedia) {
          updates.url = null;
          updates.thumbnailUrl = null;
          updates.thumbnailLqUrl = null;
        }
      }

      if (nuevaMedia) {
        const mediaPath = `alertas/${post.userId}/${alertId}/image_${Date.now()}.jpg`;
        updates.url = await subirArchivoConRuta(nuevaMedia.uri, 'foto', mediaPath);

        // Generar miniatura LQ
        try {
          const manipResult = await ImageManipulator.manipulateAsync(
            nuevaMedia.uri,
            [{ resize: { width: 150 } }],
            { compress: 0.1, format: ImageManipulator.SaveFormat.JPEG }
          );
          const thumbLQPath = `alertas/${post.userId}/${alertId}/thumb_lq_${Date.now()}.jpg`;
          updates.thumbnailLqUrl = await subirArchivoConRuta(manipResult.uri, 'foto', thumbLQPath);
        } catch (e) {
          console.log("Error generando LQ en editor de alerta:", e);
        }
      }

      await updateDoc(alertRef, updates);
      Alert.alert('Éxito', 'Aviso actualizado correctamente');
      onClose(true);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo actualizar el aviso');
    } finally {
      setGuardando(false);
    }
  };

  const tieneMediaOriginal = post?.url && !mediaEliminada;
  const mostrarMedia = nuevaMedia ? nuevaMedia.uri : (tieneMediaOriginal ? post.url : null);

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 60 : 35 }]}>
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 50 }]}
            keyboardShouldPersistTaps="always"
          >

            <View style={styles.alertHeaderMinimal}>
              <View style={{ justifyContent: 'center' }}>
                <Text style={styles.mainEditTitle}>Editando Aviso</Text>
              </View>
              <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                <TouchableOpacity onPress={() => onClose(false)}>
                  <Text style={styles.cancelLinkText}>CANCELAR EDICIÓN</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20 }}>
              <View style={styles.lockedBadgeLarge}>
                <Ionicons name="lock-closed" size={12} color="#6B7280" />
                <Text style={styles.lockedBadgeTextLarge}>{partido}</Text>
              </View>
            </View>

            {/* TIPO SELECTOR */}
            <View style={styles.tipoSelectorRow}>
              <TouchableOpacity
                style={[styles.tipoBtn, tipoAlerta === 'Alerta' && styles.tipoBtnAlertaActive]}
                onPress={() => setTipoAlerta('Alerta')}
              >
                <Ionicons name="megaphone" size={20} color={tipoAlerta === 'Alerta' ? '#FFF' : '#EF4444'} />
                <Text style={[styles.tipoBtnText, tipoAlerta === 'Alerta' && styles.tipoBtnTextActive]}>ALERTA</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tipoBtn, tipoAlerta === 'General' && styles.tipoBtnGeneralActive]}
                onPress={() => setTipoAlerta('General')}
              >
                <Ionicons name="business" size={20} color={tipoAlerta === 'General' ? '#FFF' : '#3B82F6'} />
                <Text style={[styles.tipoBtnText, tipoAlerta === 'General' && styles.tipoBtnTextActive]}>GENERAL</Text>
              </TouchableOpacity>
            </View>

            {/* UBICACIÓN */}
            <View style={styles.locRowCompact}>
              <TouchableOpacity style={styles.locSelectCompact} onPress={() => setModalLocVisible(true)}>
                <Text style={styles.locLabelCompact}>{provincia === 'Buenos Aires' ? 'Localidad' : 'Municipio'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                  <Text style={styles.locValueCompact} numberOfLines={1}>{localidad || "Seleccionar..."}</Text>
                  <Ionicons name="chevron-down" size={14} color="#9CA3AF" />
                </View>
              </TouchableOpacity>

              <View style={styles.barrioInputCompact}>
                <Text style={styles.locLabelCompact}>Barrio</Text>
                <TextInput
                  placeholder="Ej: Pompeya"
                  style={styles.barrioTextInput}
                  value={nuevoBarrio}
                  onChangeText={setNuevoBarrio}
                />
              </View>
            </View>

            {/* DESCRIPCIÓN */}
            <Text style={styles.labelSection}>Contenido</Text>
            <TextInput
              style={styles.alertInputMain}
              placeholder="¿Qué está pasando?"
              multiline
              value={nuevoTexto}
              onChangeText={setNuevoTexto}
            />

            {/* MEDIA */}
            <Text style={styles.labelSection}>Contenido</Text>
            <View style={styles.alertMediaSection}>
              {mostrarMedia ? (
                <View style={styles.mediaPreviewContainer}>
                  <Image source={{ uri: mostrarMedia }} style={styles.mediaPreview} contentFit="cover" />
                  <TouchableOpacity style={styles.removeMediaBtn} onPress={() => {setNuevaMedia(null); setMediaEliminada(true);}}>
                    <Ionicons name="close-circle" size={32} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <SelectorFotoComunidad
                  onFotoSeleccionada={(uri) => {setArchivoCapturado({uri, tipo:'foto'});}}
                  fotosActualesCount={0}
                />
              )}
            </View>

            <TouchableOpacity
              style={[styles.alertSaveBtn, guardando && { opacity: 0.5 }]}
              onPress={handleGuardar}
              disabled={guardando}
            >
              {guardando ? <ActivityIndicator color="white" /> : <Text style={styles.alertSaveBtnTxt}>GUARDAR CAMBIOS</Text>}
            </TouchableOpacity>

          </ScrollView>
        </View>

        <SelectorModal
            visible={modalLocVisible}
            onClose={() => setModalLocVisible(false)}
            data={localidades}
            cargando={cargandoLoc}
            onSelect={(item) => { setLocalidad(item); setModalLocVisible(false); }}
            titulo={provincia === 'Buenos Aires' ? `Localidades de ${partido}` : `Municipios de ${partido}`}
        />
      </KeyboardAvoidingView>

      <Modal visible={!!archivoCapturado} animationType="slide">
        {archivoCapturado && (
          <VistaPrevia
             archivo={archivoCapturado}
             onDescartar={() => setArchivoCapturado(null)}
             onPublicar={handleConfirmarVistaPrevia}
          />
        )}
      </Modal>
    </Modal>
  );
}

function SelectorModal({ visible, onClose, data, onSelect, titulo, cargando }) {
    const [search, setSearch] = useState('');
    const filtrados = data.filter(i => i.toLowerCase().includes(search.toLowerCase()));
    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View style={styles.modalOverlay}><View style={styles.modalContent}>
                <View style={styles.modalHeaderInner}><Text style={styles.modalTitleInner}>{titulo}</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity></View>
                <TextInput placeholder="Buscar..." style={styles.searchInput} value={search} onChangeText={setSearch} />
                {cargando ? <ActivityIndicator color="#FF6600" style={{margin:20}} /> : (<FlatList data={filtrados} keyExtractor={(i,idx)=>`${i}-${idx}`} renderItem={({item}) => (<TouchableOpacity style={styles.listItem} onPress={()=>{onSelect(item); setSearch('');}}><Text>{item}</Text></TouchableOpacity>)} contentContainerStyle={{ paddingBottom: 60 }} />)}
            </View></View>
        </Modal>
    );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContainer: { flex: 1 },
  scrollContent: { padding: 20 },
  alertHeaderMinimal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cancelLinkText: { fontSize: 10, fontWeight: '800', color: '#EF4444', textTransform: 'uppercase' },
  lockedBadgeLarge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 5, borderWidth: 1, borderColor: '#E5E7EB' },
  lockedBadgeTextLarge: { fontSize: 14, fontWeight: '800', color: '#4B5563', textTransform: 'uppercase' },
  mainEditTitle: { fontSize: 22, fontWeight: '900', color: '#111827' },
  tipoSelectorRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  tipoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#F3F4F6', gap: 8, backgroundColor: '#F9FAFB' },
  tipoBtnAlertaActive: { borderColor: '#EF4444', backgroundColor: '#EF4444' },
  tipoBtnGeneralActive: { borderColor: '#3B82F6', backgroundColor: '#3B82F6' },
  tipoBtnText: { fontSize: 13, fontWeight: '900', color: '#6B7280' },
  tipoBtnTextActive: { color: '#FFF' },
  locRowCompact: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  locSelectCompact: { flex: 1, backgroundColor: '#F9FAFB', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', minHeight: 55, justifyContent: 'center' },
  locLabelCompact: { fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', textTransform: 'uppercase' },
  locValueCompact: { fontSize: 13, fontWeight: 'bold', color: '#111827', marginTop: 2 },
  barrioInputCompact: { flex: 1, backgroundColor: '#F9FAFB', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', minHeight: 55, justifyContent: 'center' },
  barrioTextInput: { fontSize: 13, fontWeight: 'bold', color: '#111827', padding: 0, marginTop: 2 },
  labelSection: { fontSize: 12, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
  alertInputMain: { fontSize: 16, backgroundColor: '#F9FAFB', padding: 15, borderRadius: 15, minHeight: 120, textAlignVertical: 'top', marginBottom: 15, borderWidth: 1, borderColor: '#F3F4F6', color: '#111827' },
  alertMediaSection: { marginBottom: 20 },
  mediaPreviewContainer: { position: 'relative', width: '100%', height: 250, borderRadius: 16, overflow: 'hidden' },
  mediaPreview: { width: '100%', height: '100%' },
  removeMediaBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'white', borderRadius: 20 },
  alertSaveBtn: { backgroundColor: '#3B82F6', padding: 18, borderRadius: 15, alignItems: 'center', elevation: 3 },
  alertSaveBtnTxt: { color: 'white', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', height: '65%', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20 },
  modalHeaderInner: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  modalTitleInner: { fontSize: 18, fontWeight: 'bold' },
  searchInput: { backgroundColor: '#F3F4F6', padding: 12, borderRadius: 10, marginBottom: 15 },
  listItem: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }
});
