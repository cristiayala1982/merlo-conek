import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDoc } from 'firebase/firestore';

export default function PublicarOficioModal({ visible, onClose }) {
  const [misOficios, setMisOficios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [barrio, setBarrio] = useState('');

  useEffect(() => {
    if (!visible) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const q = query(collection(db, 'clasificados'), where('userId', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      setMisOficios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCargando(false);
    });

    return () => unsub();
  }, [visible]);

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
      const userSnap = await getDoc(doc(db, 'usuarios', uid));
      const userData = userSnap.exists() ? userSnap.data() : {};

      await addDoc(collection(db, 'clasificados'), {
        userId: uid,
        userName: userData.nombre || 'Usuario',
        userPhoto: userData.fotoUrl || null,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        barrio: barrio.trim(),
        provincia: userData.provincia || '',
        localidad: userData.localidad || '',
        createdAt: serverTimestamp()
      });

      setTitulo('');
      setDescripcion('');
      setBarrio('');
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
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContent}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Mis Clasificados</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {cargando ? (
            <ActivityIndicator size="large" color="#059669" style={{ margin: 20 }} />
          ) : (
            <FlatList
              data={misOficios}
              keyExtractor={item => item.id}
              ListHeaderComponent={
                <View style={styles.formContainer}>
                  <Text style={styles.sectionTitle}>
                    {misOficios.length >= 5 ? "Límite de 5 alcanzado" : "Publicar nuevo oficio"}
                  </Text>

                  {misOficios.length < 5 ? (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder="¿Qué hacés? (ej: Plomero Matrículado)"
                        value={titulo}
                        onChangeText={setTitulo}
                        maxLength={50}
                      />
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Descripción de tu servicio y contacto..."
                        multiline
                        numberOfLines={3}
                        value={descripcion}
                        onChangeText={setDescripcion}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Tu barrio"
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
                      <Text style={styles.limitText}>
                        Tenés 5 anuncios activos. Para publicar uno nuevo, borrá uno de la lista de abajo.
                      </Text>
                    </View>
                  )}

                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Tus publicaciones ({misOficios.length}/5)</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.oficioItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.oficioTitle}>{item.titulo}</Text>
                    <Text style={styles.oficioBarrio} numberOfLines={1}>{item.barrio}</Text>
                  </View>
                  <TouchableOpacity onPress={() => confirmarEliminar(item.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No tenés anuncios publicados aún.</Text>
              }
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
    paddingHorizontal: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  closeBtn: { padding: 4 },
  formContainer: { paddingTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 12 },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 14
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  btnPublicar: {
    backgroundColor: '#059669',
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4
  },
  btnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 20 },
  oficioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6'
  },
  oficioTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  oficioBarrio: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  deleteBtn: { padding: 8 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 20, fontSize: 14 },
  limitBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    alignItems: 'center'
  },
  limitText: { flex: 1, color: '#B45309', fontSize: 13, marginLeft: 8, lineHeight: 18 }
});
