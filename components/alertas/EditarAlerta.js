import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, NativeModules, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db, storage } from '../../firebaseConfig';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { deleteObject, ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage';

export default function EditarAlerta({ visible, post, onClose }) {
  const [nuevoTexto, setNuevoTexto] = useState(post?.texto || '');
  const [nuevoBarrio, setNuevoBarrio] = useState(post?.barrio || '');
  const [guardando, setGuardando] = useState(false);
  const [nuevaMedia, setNuevaMedia] = useState(null);
  const [mediaEliminada, setMediaEliminada] = useState(false);

  const abrirCamara = async () => {
    try {
      if (Platform.OS !== 'android') return;
      const modulo = NativeModules.HistoriasLabNative;
      if (!modulo) return;

      const rutaCruda = await modulo.abrirCamaraHistorias(false);
      if (rutaCruda) {
        setNuevaMedia({
          uri: `file://${rutaCruda}`,
          tipo: 'foto'
        });
        setMediaEliminada(false);
      }
    } catch (error) {
      console.log('Error camara editor:', error);
    }
  };

  const uriABlob = async (uri) => {
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onerror = () => reject(new TypeError('Error al cargar archivo local'));
      xhr.onload = () => resolve(xhr.response);
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  };

  const subirArchivo = async (uri, path) => {
    const blob = await uriABlob(uri);
    const storageRef = ref(storage, path);
    await uploadBytesResumable(storageRef, blob, {
      contentType: 'image/jpeg'
    });
    return await getDownloadURL(storageRef);
  };

  const handleGuardar = async () => {
    if (!nuevoBarrio.trim()) {
      Alert.alert("Dato requerido", "Por favor ingresa el nombre del barrio.");
      return;
    }

    try {
      setGuardando(true);
      const alertId = post.id || post.postId;
      const alertRef = doc(db, 'alertas_comunitarias', alertId);
      const updates = {
        texto: nuevoTexto,
        barrio: nuevoBarrio.trim(),
        updatedAt: serverTimestamp()
      };

      if (nuevaMedia || mediaEliminada) {
        if (post.url && post.url.includes('firebasestorage')) {
            // Intentar borrar si tenemos la URL. Idealmente tendríamos el storagePath.
            // Por ahora, solo actualizamos la URL en Firestore.
        }

        if (mediaEliminada && !nuevaMedia) {
          updates.url = null;
        }
      }

      if (nuevaMedia) {
        const mediaPath = `alertas/${post.userId}/${alertId}/image_${Date.now()}.jpg`;
        updates.url = await subirArchivo(nuevaMedia.uri, mediaPath);
      }

      await updateDoc(alertRef, updates);
      Alert.alert('Éxito', 'Aviso actualizado');
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onClose(false)}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Editar Aviso Vecinal</Text>
          <TouchableOpacity onPress={handleGuardar} disabled={guardando}>
            {guardando ? <ActivityIndicator size="small" color="#FF6600" /> : <Text style={styles.saveBtn}>Guardar</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.mediaContainer}>
            {mostrarMedia ? (
              <View style={styles.mediaPreview}>
                <Image source={{ uri: mostrarMedia }} style={styles.image} />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => { setNuevaMedia(null); setMediaEliminada(true); }}
                >
                  <Ionicons name="trash" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addMediaBtn} onPress={abrirCamara}>
                <Ionicons name="camera" size={40} color="#6B7280" />
                <Text style={styles.addMediaTxt}>Agregar foto</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.label}>Barrio</Text>
          <TextInput
            style={[styles.input, { minHeight: 45, fontWeight: 'bold' }]}
            value={nuevoBarrio}
            onChangeText={setNuevoBarrio}
            placeholder="Nombre del barrio..."
          />

          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={styles.input}
            value={nuevoTexto}
            onChangeText={setNuevoTexto}
            multiline
            placeholder="Escribe algo..."
            editable={!guardando}
          />

          {mostrarMedia && (
             <TouchableOpacity style={styles.changeBtn} onPress={abrirCamara}>
                <Ionicons name="refresh" size={18} color="#6B7280" />
                <Text style={styles.changeTxt}>Cambiar foto</Text>
             </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 17, fontWeight: 'bold' },
  saveBtn: { color: '#FF6600', fontWeight: 'bold', fontSize: 16 },
  content: { padding: 20 },
  mediaContainer: { marginBottom: 20 },
  mediaPreview: { width: '100%', height: 250, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  image: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(255,0,0,0.7)', padding: 8, borderRadius: 20 },
  addMediaBtn: { width: '100%', height: 200, borderWidth: 2, borderColor: '#EEE', borderStyle: 'dashed', borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  addMediaTxt: { marginTop: 10, color: '#6B7280', fontWeight: '600' },
  changeBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10, alignSelf: 'flex-end' },
  changeTxt: { marginLeft: 5, color: '#6B7280', fontWeight: '600' },
  label: { fontSize: 13, color: '#9CA3AF', marginBottom: 5, fontWeight: '900', marginTop: 15, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#EEE', borderRadius: 8, padding: 12, fontSize: 16, minHeight: 80, textAlignVertical: 'top', backgroundColor: '#FAFAFA' },
});
