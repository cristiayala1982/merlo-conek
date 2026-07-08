import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, FlatList, Image, Keyboard, NativeModules, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller';
import { auth } from '../../firebaseConfig';
import { escucharMensajesChat, enviarMensajeChat, uriABlob } from '../../services/firebaseService';
import * as FileSystem from 'expo-file-system/legacy';
import { ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../../firebaseConfig';
import { comprimirVideoPro } from '../camara/compresor3';
import AudioMensaje from './AudioMensaje';
import GrabadorAudio from './GrabadorAudio';
import ChatMediaViewer from './ChatMediaViewer';
import VistaPrevia from '../camara/VistaPrevia';
import * as VideoThumbnails from 'expo-video-thumbnails';

export default function ChatRoom({ chatId, otroUser }) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [mensajes, setMensajes] = useState([]);
  const [archivoCapturado, setArchivoCapturado] = useState(null);
  const [mensajeSeleccionado, setMensajeSeleccionado] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [audioSonandoId, setAudioSonandoId] = useState(null);
  const [progreso, setProgreso] = useState(0);

  const miUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!chatId) return;
    const unsub = escucharMensajesChat(chatId, setMensajes);
    return () => unsub();
  }, [chatId]);

  const abrirCamaraNativa = async () => {
    if (NativeModules.HistoriasLabNative) {
      try {
        const rutaCrudaAndroid = await NativeModules.HistoriasLabNative.abrirCamaraHistorias(false);
        if (rutaCrudaAndroid) {
          setArchivoCapturado({
            tipo: rutaCrudaAndroid.endsWith('.mp4') ? 'video' : 'foto',
            uri: `file://${rutaCrudaAndroid}`
          });
        }
      } catch (error) {
        console.log("Cámara cancelada");
      }
    }
  };

  const handleEnviarTexto = async () => {
    if (!texto.trim()) return;
    await enviarMensajeChat(chatId, { texto: texto.trim() });
    setTexto('');
  };

  const handleEnviarMedia = async () => {
    if (!archivoCapturado) return;
    const captura = archivoCapturado;
    setArchivoCapturado(null);
    setSubiendo(true);

    try {
      let uriFinal = captura.uri;
      let thumbUrl = '';

      if (captura.tipo === 'video') {
        uriFinal = await comprimirVideoPro(captura.uri.replace('file://', ''));
        const { uri } = await VideoThumbnails.getThumbnailAsync(uriFinal, { time: 100 });
        const thumbBlob = await uriABlob(uri);
        const thumbRef = ref(storage, `chats/${chatId}/thumbs/${Date.now()}.jpg`);
        await uploadBytesResumable(thumbRef, thumbBlob);
        thumbUrl = await getDownloadURL(thumbRef);
      }

      const blob = await uriABlob(uriFinal);
      const mediaRef = ref(storage, `chats/${chatId}/media/${Date.now()}_${captura.tipo === 'video' ? 'video.mp4' : 'foto.jpg'}`);
      const uploadTask = uploadBytesResumable(mediaRef, blob);

      uploadTask.on('state_changed',
        (snap) => setProgreso(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        (err) => { console.error(err); setSubiendo(false); },
        async () => {
          const fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
          await enviarMensajeChat(chatId, { tipo: captura.tipo, fileUrl, thumbnailUrl: thumbUrl });
          setSubiendo(false);
          setProgreso(0);
        }
      );
    } catch (e) {
      console.error(e);
      setSubiendo(false);
    }
  };

  const handleEnviarAudio = async (uri) => {
    try {
      const blob = await uriABlob(uri);
      const audioRef = ref(storage, `chats/${chatId}/audios/${Date.now()}.m4a`);
      await uploadBytesResumable(audioRef, blob);
      const url = await getDownloadURL(audioRef);
      await enviarMensajeChat(chatId, { tipo: 'audio', fileUrl: url });
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (e) {
      console.error("Error enviando audio:", e);
    }
  };

  if (archivoCapturado) {
    return <VistaPrevia archivo={archivoCapturado} onDescartar={() => setArchivoCapturado(null)} onPublicar={handleEnviarMedia} />;
  }

  return (
    <KeyboardProvider>
      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Image source={{ uri: otroUser?.fotoUrl || 'https://picsum.photos/100' }} style={styles.avatar} />
            <View style={styles.headerInfo}>
                <Text style={styles.name}>{otroUser?.nombre || 'Chat'}</Text>
                <Text style={styles.status}>En línea</Text>
            </View>
        </View>

        <FlatList
          data={mensajes}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const esMio = item.senderId === miUid;
            return (
                <View style={[styles.bubble, esMio ? styles.bubbleMe : styles.bubbleThem]}>
                    {item.tipo === 'audio' ? (
                        <AudioMensaje
                            uri={item.fileUrl}
                            id={item.id}
                            isPlaying={audioSonandoId === item.id}
                            onPlay={setAudioSonandoId}
                            onEnded={(id) => {
                                const idx = mensajes.findIndex(m => m.id === id);
                                const next = mensajes[idx - 1]; // Inverted list
                                if (next?.tipo === 'audio') setAudioSonandoId(next.id);
                                else setAudioSonandoId(null);
                            }}
                        />
                    ) : item.tipo === 'foto' || item.tipo === 'video' ? (
                        <TouchableOpacity onPress={() => setMensajeSeleccionado(item)}>
                            <Image source={{ uri: item.thumbnailUrl || item.fileUrl }} style={styles.mediaPreview} />
                            {item.tipo === 'video' && <Ionicons name="play" size={40} color="white" style={styles.playIcon} />}
                        </TouchableOpacity>
                    ) : (
                        <Text style={[styles.msgText, esMio && styles.msgTextMe]}>{item.texto}</Text>
                    )}
                </View>
            );
          }}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : null}>
            <View style={styles.inputArea}>
                <TouchableOpacity onPress={abrirCamaraNativa}>
                    <Ionicons name="camera-outline" size={28} color="#FF6600" />
                </TouchableOpacity>
                <TextInput
                    style={styles.input}
                    value={texto}
                    onChangeText={setTexto}
                    placeholder="Escribir..."
                    multiline
                />
                {texto.trim() ? (
                    <TouchableOpacity onPress={handleEnviarTexto} style={styles.sendBtn}>
                        <Ionicons name="send" size={24} color="#FF6600" />
                    </TouchableOpacity>
                ) : (
                    <GrabadorAudio onIniciarGrabacion={() => setAudioSonandoId(null)} onEnviar={handleEnviarAudio} />
                )}
            </View>
        </KeyboardAvoidingView>

        {mensajeSeleccionado && (
            <ChatMediaViewer archivo={mensajeSeleccionado} alCerrar={() => setMensajeSeleccionado(null)} />
        )}

        {subiendo && (
            <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#FF6600" />
                <Text style={styles.loadingText}>Enviando... {progreso}%</Text>
            </View>
        )}
      </View>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 15, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    backBtn: { marginRight: 10 },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
    headerInfo: { flex: 1 },
    name: { fontWeight: 'bold', fontSize: 16 },
    status: { fontSize: 12, color: '#4BB543' },
    list: { padding: 15 },
    bubble: { padding: 10, borderRadius: 15, marginBottom: 10, maxWidth: '80%' },
    bubbleMe: { alignSelf: 'flex-end', backgroundColor: '#FF6600', borderBottomRightRadius: 2 },
    bubbleThem: { alignSelf: 'flex-start', backgroundColor: '#F3F4F6', borderBottomLeftRadius: 2 },
    msgText: { fontSize: 15, color: '#333' },
    msgTextMe: { color: '#FFF' },
    mediaPreview: { width: 200, height: 200, borderRadius: 10 },
    playIcon: { position: 'absolute', top: 80, left: 80, opacity: 0.8 },
    inputArea: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, borderTopColor: '#EEE' },
    input: { flex: 1, marginHorizontal: 10, backgroundColor: '#F9FAFB', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxHeight: 100 },
    sendBtn: { padding: 5 },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    loadingText: { color: '#FFF', marginTop: 10, fontWeight: 'bold' }
});
