import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, BackHandler, NativeModules } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { subirArchivoConRuta, obtenerPerfilUsuario } from '../../services/firebaseService';
import VistaPrevia from '../camara/VistaPrevia';

export default function PublicarOficioModal({ visible, onClose }) {
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

  // MANEJO DEL BOTÓN FÍSICO DE ATRÁS (ANDROID)
  useEffect(() => {
    if (!visible) return;
    const backAction = () => {
      if (archivoCapturado) {
        setArchivoCapturado(null);
        return true;
      }
      onClose();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [visible, onClose, archivoCapturado]);

  useEffect(() => {
    if (!visible) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // Obtener perfil para la foto de la cabecera
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
  }, [visible]);

  const abrirCamaraOGaleria = async () => {
    try {
      if (Platform.OS !== 'android') {
        const ImagePicker = require('expo-image-picker');
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false, // Estabilidad
          aspect: [1, 1],
          quality: 0.7,
        });
        if (!result.canceled) {
          setArchivoCapturado({ tipo: 'foto', uri: result.assets[0].uri });
        }
        return;
      }

      const modulo = NativeModules.HistoriasLabNative;

      Alert.alert(
        "Agregar foto",
        "¿Desde dónde quieres elegir la imagen?",
        [
          {
            text: "Cámara",
            onPress: async () => {
              if (modulo && modulo.abrirCamaraHistorias) {
                const rutaCrudaAndroid = await modulo.abrirCamaraHistorias(true, false);
                if (rutaCrudaAndroid) {
                  setArchivoCapturado({ tipo: 'foto', uri: `file://${rutaCrudaAndroid}` });
                }
              } else {
                Alert.alert("Error", "Módulo de cámara no disponible.");
              }
            }
          },
          {
            text: "Galería",
            onPress: async () => {
              const ImagePicker = require('expo-image-picker');
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false, // Estabilidad
                quality: 0.7,
              });
              if (!result.canceled) {
                setArchivoCapturado({ tipo: 'foto', uri: result.assets[0].uri });
              }
            }
          },
          { text: "Cancelar", style: "cancel" }
        ]
      );
    } catch (error) {
      console.log('Error al abrir cámara/galería:', error);
    }
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
        finalFotoUrl = await subirArchivoConRuta(
          fotoUri,
          'foto',
          `clasificados/${uid}/${Date.now()}.jpg`
        );
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

      setTitulo('');
      setDescripcion('');
      setBarrio('');
      setFotoUri(null);
      setTextoSobreMedia('');
      Alert.alert("¡Éxito!", "Tu oficio ha sido publicado correctamente.");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "No se pudo publicar. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const confirmarEliminar = (id) => {
    Alert.alert(
      "Eliminar publicación",
      "¿Estás seguro de que querés borrar este anuncio?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => eliminarOficio(id) }
      ]
    );
  };

  const eliminarOficio = async (id) => {
    try {
      await deleteDoc(doc(db, 'clasificados', id));
    } catch (e) {
      Alert.alert("Error", "No se pudo eliminar.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
          style={styles.modalContent}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -500} // Valor truco para Android Modals
        >
          <View style={styles.header}>
            <View style={styles.headerUserRow}>
              {perfil?.fotoUrl ? (
                <Image source={{ uri: perfil.fotoUrl }} style={styles.headerAvatar} />
              ) : (
                <View style={[styles.headerAvatar, { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="person" size={16} color="#9CA3AF" />
                </View>
              )}
              <Text style={styles.headerTitle}>Mis Clasificados</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {cargando ? (
            <ActivityIndicator size="large" color="#059669" style={{ margin: 20 }} />
          ) : (
            <FlatList
              data={misOficios}
              keyExtractor={item => item.id}
              style={{ flex: 1 }} // Obligamos a la lista a ocupar el espacio disponible
              ListHeaderComponent={
                <View style={styles.formContainer}>
                  <Text style={styles.sectionTitle}>
                    {misOficios.length >= 5 ? "Límite de 5 alcanzado" : "Publicar nuevo oficio"}
                  </Text>
                  {misOficios.length < 5 ? (
                    <>
                      <View style={styles.mediaSection}>
                        {fotoUri ? (
                          <View style={styles.previewContainer}>
                            <Image source={{ uri: fotoUri }} style={styles.previewImage} />
                            {textoSobreMedia ? (
                              <View style={styles.overlayTextContainer}>
                                <Text style={styles.overlayText}>{textoSobreMedia}</Text>
                              </View>
                            ) : null}
                            <TouchableOpacity style={styles.removeImage} onPress={() => {setFotoUri(null); setTextoSobreMedia('');}}>
                              <Ionicons name="close-circle" size={24} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity style={styles.bigImageSelector} onPress={abrirCamaraOGaleria}>
                            <Ionicons name="camera-outline" size={32} color="#6B7280" />
                            <Text style={styles.imageSelectorText}>Agregar foto (Cámara o Galería)</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="¿Qué hacés? (ej: Plomero Matrículado)"
                        placeholderTextColor="#9CA3AF"
                        value={titulo}
                        onChangeText={setTitulo}
                        maxLength={50}
                        blurOnSubmit={false}
                      />
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Descripción de tu servicio y contacto..."
                        placeholderTextColor="#9CA3AF"
                        multiline
                        numberOfLines={3}
                        value={descripcion}
                        onChangeText={setDescripcion}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Tu barrio"
                        placeholderTextColor="#9CA3AF"
                        value={barrio}
                        onChangeText={setBarrio}
                        maxLength={30}
                      />
                      <TouchableOpacity
                        style={[styles.btnPublicar, enviando && { opacity: 0.7 }]}
                        onPress={handlePublicar}
                        disabled={enviando}
                      >
                        {enviando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Publicar ahora</Text>}
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={styles.limitBox}>
                      <Ionicons name="warning-outline" size={20} color="#B45309" />
                      <Text style={styles.limitText}>Tenés 5 anuncios activos. Borrá uno de abajo para publicar otro.</Text>
                    </View>
                  )}
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Tus publicaciones ({misOficios.length}/5)</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.oficioItem}>
                  {item.fotoServicio && <Image source={{ uri: item.fotoServicio }} style={styles.itemThumb} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.oficioTitle}>{item.titulo}</Text>
                    <Text style={styles.oficioBarrio} numberOfLines={1}>{item.barrio}</Text>
                  </View>
                  <TouchableOpacity onPress={() => confirmarEliminar(item.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No tenés anuncios publicados aún.</Text>}
              contentContainerStyle={{ paddingBottom: 60 }}
              keyboardShouldPersistTaps="always"
            />
          )}
        </KeyboardAvoidingView>
      </View>

      <Modal visible={!!archivoCapturado} animationType="slide">
        {archivoCapturado && (
          <VistaPrevia
            archivo={archivoCapturado}
            onDescartar={() => setArchivoCapturado(null)}
            onPublicar={handleMediaEditada}
          />
        )}
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '90%', paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerUserRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  closeBtn: { padding: 4 },
  formContainer: { paddingTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 12 },
  mediaSection: { marginBottom: 15 },
  bigImageSelector: { width: '100%', height: 100, backgroundColor: '#F3F4F6', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 8 },
  imageSelectorText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  previewContainer: { width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  overlayTextContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', padding: 20 },
  overlayText: { color: 'white', fontSize: 20, fontWeight: 'bold', textAlign: 'center', textShadowColor: 'black', textShadowRadius: 4, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 10, borderRadius: 8 },
  removeImage: { position: 'absolute', top: 8, right: 8, backgroundColor: 'white', borderRadius: 12 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 14, color: '#111827' },
  textArea: { height: 80, textAlignVertical: 'top' },
  btnPublicar: { backgroundColor: '#059669', height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  btnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 20 },
  oficioItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6', gap: 10 },
  itemThumb: { width: 45, height: 45, borderRadius: 6 },
  oficioTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  oficioBarrio: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  deleteBtn: { padding: 8 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 20, fontSize: 14 },
  limitBox: { flexDirection: 'row', backgroundColor: '#FFFBEB', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FEF3C7', alignItems: 'center' },
  limitText: { flex: 1, color: '#B45309', fontSize: 13, marginLeft: 8, lineHeight: 18 }
});
