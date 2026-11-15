import { Ionicons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImageManipulator from 'expo-image-manipulator';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, NativeModules, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../firebaseConfig';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { borrarArchivoPorUrl, subirArchivoConRuta } from '../../services/firebase/storageService';
import { comprimirVideoPro } from '../camara/compresor3';
import VistaPrevia from '../camara/VistaPrevia';

export default function EditarPost({ visible, post, onClose }) {
  const insets = useSafeAreaInsets();
  const [nuevoTexto, setNuevoTexto] = useState(post?.texto || '');
  const [guardando, setGuardando] = useState(false);
  const [nuevaMedia, setNuevaMedia] = useState(null); // { uri, tipo, thumbnailUri }
  const [mediaEliminada, setMediaEliminada] = useState(false);
  const [archivoCapturado, setArchivoCapturado] = useState(null); // Para el modal de VistaPrevia

  const abrirCamara = async () => {
    try {
      if (Platform.OS !== 'android') return;
      const modulo = NativeModules.HistoriasLabNative;
      if (!modulo) return;

      const rutaCruda = await modulo.abrirCamaraHistorias(false, false); // false = permite video
      if (rutaCruda) {
        const esVideo = rutaCruda.endsWith('.mp4');
        setArchivoCapturado({
          uri: `file://${rutaCruda}`,
          tipo: esVideo ? 'video' : 'foto',
          optimizado: false
        });
      }
    } catch (error) {
      console.log('Error camara editor:', error);
    }
  };

  const handleConfirmarVistaPrevia = async (textoPreview, uriEditada) => {
    // Cuando el usuario confirma en la vista previa
    let thumb = null;
    const uriDefinitiva = uriEditada || archivoCapturado.uri;

    if (archivoCapturado.tipo === 'video') {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(uriDefinitiva, { time: 100 });
        thumb = uri;
      } catch (e) {}
    }

    setNuevaMedia({
      uri: uriDefinitiva,
      tipo: archivoCapturado.tipo,
      thumbnailUri: thumb
    });
    setMediaEliminada(false);
    setArchivoCapturado(null);
  };

  const handleGuardar = async () => {
    try {
      setGuardando(true);
      const postId = post.id || post.postId;
      const postRef = doc(db, 'posts', postId);
      const updates = { texto: nuevoTexto, updatedAt: serverTimestamp() };

      // Lógica de limpieza y subida de archivos
      if (nuevaMedia || mediaEliminada) {
        // 1. Borrar archivos viejos del Storage usando URL para evitar que queden huérfanos
        if (post?.url) await borrarArchivoPorUrl(post.url).catch(() => {});
        if (post?.thumbnailUrl) await borrarArchivoPorUrl(post.thumbnailUrl).catch(() => {});
        if (post?.thumbnailLqUrl) await borrarArchivoPorUrl(post.thumbnailLqUrl).catch(() => {});

        if (mediaEliminada && !nuevaMedia) {
          updates.url = null;
          updates.thumbnailUrl = null;
          updates.thumbnailLqUrl = null;
          updates.storagePath = null;
          updates.thumbnailPath = null;
          updates.tipo = 'texto';
        }
      }

      if (nuevaMedia) {
        let uriFinal = nuevaMedia.uri;
        if (nuevaMedia.tipo === 'video') {
          try {
            uriFinal = await comprimirVideoPro(nuevaMedia.uri);
          } catch (e) {
            console.log("Error comprimiendo en editor, usando original");
          }
        }

        const basePath = `posts/${post.userId}/${postId}`;
        const mediaPath = nuevaMedia.tipo === 'video' ? `${basePath}/video_${Date.now()}.mp4` : `${basePath}/image_${Date.now()}.jpg`;

        updates.url = await subirArchivoConRuta(uriFinal, nuevaMedia.tipo, mediaPath);
        updates.storagePath = mediaPath;
        updates.tipo = nuevaMedia.tipo;

        // Generar miniatura LQ (ultra-ligera) si es necesario
        let thumbLQPath = null;
        let thumbPath = null;
        let finalThumbUrl = null;
        let finalThumbLqUrl = null;

        // Si es video, usamos el thumbnail generado. Si es foto, usamos la misma foto para comprimir
        const imgBaseParaThumb = nuevaMedia.tipo === 'video' ? nuevaMedia.thumbnailUri : uriFinal;

        if (imgBaseParaThumb) {
           // Subir el thumbnail estandar
           thumbPath = `${basePath}/thumb_${Date.now()}.jpg`;
           finalThumbUrl = await subirArchivoConRuta(imgBaseParaThumb, 'foto', thumbPath);
           updates.thumbnailUrl = finalThumbUrl;
           updates.thumbnailPath = thumbPath;

           // Generar miniatura LQ
           try {
              const manipResult = await ImageManipulator.manipulateAsync(
                imgBaseParaThumb,
                [{ resize: { width: 150 } }],
                { compress: 0.1, format: ImageManipulator.SaveFormat.JPEG }
              );
              thumbLQPath = `${basePath}/thumb_lq_${Date.now()}.jpg`;
              finalThumbLqUrl = await subirArchivoConRuta(manipResult.uri, 'foto', thumbLQPath);
              updates.thumbnailLqUrl = finalThumbLqUrl;
           } catch (e) {
              console.log("Error generando LQ en editor:", e);
           }
        }
      }

      await updateDoc(postRef, updates);
      Alert.alert('Éxito', 'Publicación actualizada');
      onClose(true);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo actualizar el post');
    } finally {
      setGuardando(false);
    }
  };

  const tieneMediaOriginal = (post?.url || post?.thumbnailUrl) && !mediaEliminada;
  const mostrarMedia = nuevaMedia ? nuevaMedia.thumbnailUri || nuevaMedia.uri : (tieneMediaOriginal ? post.thumbnailUrl || post.url : null);
  const esVideoActual = nuevaMedia ? nuevaMedia.tipo === 'video' : post?.tipo === 'video';

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <TouchableOpacity onPress={() => onClose(false)} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Editar Post</Text>
          <TouchableOpacity onPress={handleGuardar} disabled={guardando} style={[styles.saveBtnBox, guardando && { opacity: 0.7 }]}>
            {guardando ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View>
              <View style={styles.mediaContainer}>
                {mostrarMedia ? (
                  <View style={styles.mediaPreview}>
                    <Image source={{ uri: mostrarMedia }} style={styles.image} />
                    {esVideoActual && <View style={styles.videoBadge}><Ionicons name="play" size={16} color="#FFF" /></View>}
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => { setNuevaMedia(null); setMediaEliminada(true); }}
                    >
                      <Ionicons name="trash" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addMediaBtn} onPress={abrirCamara}>
                    <Ionicons name="camera" size={40} color="#FF6600" />
                    <Text style={styles.addMediaTxt}>Agregar foto o video</Text>
                  </TouchableOpacity>
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

              {mostrarMedia && (
                 <TouchableOpacity style={styles.changeBtn} onPress={abrirCamara}>
                    <Ionicons name="refresh" size={18} color="#FF6600" />
                    <Text style={styles.changeTxt}>Cambiar por otro</Text>
                 </TouchableOpacity>
              )}
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  cancelBtn: { paddingVertical: 8 },
  cancelBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
  saveBtnBox: {
    backgroundColor: '#FF6600',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 80,
    alignItems: 'center'
  },
  saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  content: { padding: 20, paddingBottom: 100 },
  mediaContainer: { marginBottom: 20 },
  mediaPreview: { width: '100%', height: 280, borderRadius: 16, overflow: 'hidden', position: 'relative', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeBtn: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(239, 68, 68, 0.9)', padding: 8, borderRadius: 20 },
  videoBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 8 },
  addMediaBtn: { width: '100%', height: 200, borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  addMediaTxt: { marginTop: 10, color: '#6B7280', fontWeight: '600' },
  changeBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 12, alignSelf: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  changeTxt: { marginLeft: 6, color: '#374151', fontWeight: '700' },
  label: { fontSize: 13, color: '#9CA3AF', marginBottom: 8, fontWeight: '800', marginTop: 15, textTransform: 'uppercase', letterSpacing: 1 },
  input: { borderWidth: 1.5, borderColor: '#F3F4F6', borderRadius: 16, padding: 16, fontSize: 16, minHeight: 120, textAlignVertical: 'top', backgroundColor: '#F9FAFB', color: '#111827' },
});
