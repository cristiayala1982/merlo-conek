import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { actualizarPost } from '../../services/firebaseService';

export default function EditarPost({ visible, post, onClose }) {
  const [nuevoTexto, setNuevoTexto] = useState(post?.texto || '');
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    try {
      setGuardando(true);
      await actualizarPost(post.id || post.postId, nuevoTexto);
      Alert.alert('Éxito', 'Publicación actualizada');
      onClose(true); // true significa que se guardó
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el post');
    } finally {
      setGuardando(false);
    }
  };

  const esImagen = post?.tipo === 'foto';
  const esVideo = post?.tipo === 'video';
  const thumb = post?.thumbnailUrl || post?.url;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onClose(false)}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Editar Publicación</Text>
          <TouchableOpacity onPress={handleGuardar} disabled={guardando}>
            {guardando ? (
              <ActivityIndicator size="small" color="#FF6600" />
            ) : (
              <Text style={styles.saveBtn}>Guardar</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Vista previa de la media */}
          <View style={styles.mediaPreview}>
            {esImagen || esVideo ? (
              <Image source={{ uri: thumb }} style={styles.image} />
            ) : (
              <View style={styles.noMedia}>
                <Ionicons name="text-outline" size={40} color="#CCC" />
              </View>
            )}
            {esVideo && (
              <View style={styles.videoBadge}>
                <Ionicons name="play" size={16} color="#FFF" />
              </View>
            )}
          </View>

          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={styles.input}
            value={nuevoTexto}
            onChangeText={setNuevoTexto}
            multiline
            placeholder="Escribe algo..."
            editable={!guardando}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  saveBtn: { color: '#FF6600', fontWeight: 'bold', fontSize: 16 },
  content: { padding: 20 },
  mediaPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  noMedia: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  videoBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 5,
    borderRadius: 5,
  },
  label: { fontSize: 14, color: '#666', marginBottom: 8, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#FAFAFA',
  },
});
