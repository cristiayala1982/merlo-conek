import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, Modal, Pressable, Clipboard, Platform, NativeModules } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, query, collection, where, orderBy, limit, getDoc, serverTimestamp, addDoc, arrayUnion } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { getVideoMetaData } from 'react-native-compressor';
import { db, auth } from '../../firebaseConfig';
import {
  obtenerPerfilUsuario,
  subirAudioChat,
  subirMediaChat,
  marcarMensajesComoLeidos,
  actualizarEstadoEscribiendo,
  vaciarChat,
  eliminarMensajeParaMi,
  eliminarMensajeParaTodos,
  gestionarReaccionMensaje,
  actualizarMetadataChat
} from '../../services/firebaseService';
import GrabadorAudio from './GrabadorAudio';
import BurbujaMensaje from './BurbujaMensaje';
import VistaPrevia from '../camara/VistaPrevia';
import { comprimirVideoPro } from '../camara/compresor3';
import { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLOR_NARANJA = '#FF6600';
const COLOR_GRAFITO = '#1F2937';
const REACCIONES = ['❤️', '😂', '😮', '😢', '🙏', '👍', '🔥', '🎉', '💯', '✅', '😡', '🤮', '🤢', '😊', '😭'];

export default function ChatDetalle({ userId, miUid }) {
  const router = useRouter();
  const { nombre: nombreParam, tipo, productId, vaciadoInicio, prefilledMsg } = useLocalSearchParams();
  const inputRef = useRef(null);
  const flatListRef = useRef(null);

  const [texto, setTexto] = useState(prefilledMsg || '');
  const [mensajes, setMensajes] = useState([]);
  const [otroPerfil, setOtroPerfil] = useState(null);
  const [miPerfil, setMiPerfil] = useState(null);
  const [otroStatus, setOtroStatus] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const typingTimeoutRef = useRef(null);
  const currentStatusRef = useRef(null);

  const [vaciadoTimestamp, setVaciadoTimestamp] = useState(() => {
    if (vaciadoInicio && vaciadoInicio !== '0') return { toMillis: () => parseInt(vaciadoInicio) };
    return null;
  });

  const [mensajesOptimistas, setMensajesOptimistas] = useState([]);
  const [productoContexto, setProductoContexto] = useState(null);
  const [mensajeSeleccionado, setMensajeSeleccionado] = useState(null);
  const [mensajeAResponder, setMensajeAResponder] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [archivoCapturado, setArchivoCapturado] = useState(null);
  const [estaSubiendo, setEstaSubiendo] = useState(false);
  const [progresoMsg, setProgresoMsg] = useState("");
  const [progresoPct, setProgresoPct] = useState(0);

  const chatId = tipo === 'market' ? [miUid, userId].sort().join('_') + '_market' : [miUid, userId].sort().join('_');
  const loTengoBloqueado = miPerfil?.bloqueados?.includes(userId);
  const meTieneBloqueado = otroPerfil?.bloqueados?.includes(miUid);
  const bloqueoActivo = loTengoBloqueado || meTieneBloqueado;

  useEffect(() => {
    obtenerPerfilUsuario(miUid, setMiPerfil);
    obtenerPerfilUsuario(userId, setOtroPerfil);
    if (productId) {
      getDoc(doc(db, 'productos_market', productId)).then(snap => {
        if (snap.exists()) setProductoContexto({ id: snap.id, ...snap.data() });
      });
    }
  }, [miUid, userId, productId]);

  const toggleMiStatus = (status) => {
    if (currentStatusRef.current === status) return;
    currentStatusRef.current = status;
    actualizarEstadoEscribiendo(chatId, miUid, status);
  };

  const handleTextChange = (val) => {
    setTexto(val);
    if (val.length > 0) {
      toggleMiStatus('escribiendo');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => toggleMiStatus(null), 1500);
    } else toggleMiStatus(null);
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'chats', chatId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setVaciadoTimestamp(data[miUid]?.ultimoVaciado || null);
        setOtroStatus(data[userId]?.status);
        if (data[miUid]?.unreadCount > 0) {
          updateDoc(doc(db, 'chats', chatId), { [`${miUid}.unreadCount`]: 0 });
        }
      }
    });
    return () => { toggleMiStatus(null); unsub(); };
  }, [chatId]);

  useEffect(() => {
    const q = query(collection(db, 'mensajes_chat'), where('chatId', '==', chatId), orderBy('createdAt', 'desc'), limit(40));
    return onSnapshot(q, (snapshot) => {
      let msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      marcarMensajesComoLeidos(msgs, miUid);
      if (vaciadoTimestamp) {
        const tV = vaciadoTimestamp.toMillis ? vaciadoTimestamp.toMillis() : (vaciadoTimestamp.seconds * 1000);
        msgs = msgs.filter(m => !m.createdAt || (m.createdAt.toMillis ? m.createdAt.toMillis() : m.createdAt.seconds * 1000) > tV);
      }
      setMensajes(msgs.filter(m => !(m.borradoPara && m.borradoPara.includes(miUid))));
    });
  }, [chatId, vaciadoTimestamp]);

  const handleEnviarMedia = async (textoSobreMedia = '', uriEditada = null) => {
    if (estaSubiendo || !archivoCapturado) return;
    const captura = { ...archivoCapturado };
    if (uriEditada) captura.uri = uriEditada;
    try {
      setArchivoCapturado(null); setEstaSubiendo(true); setProgresoMsg("Preparando archivo..."); setProgresoPct(0);
      let uriParaSubir = captura.uri; let thumbnailUri = null; let duracionMs = null;
      const temporales = [];

      if (captura.tipo === 'video') {
        setProgresoMsg("Generando miniatura...");
        thumbnailUri = await VideoThumbnails.getThumbnailAsync(captura.uri, { time: 1000 }).then(r => r.uri);
        if (thumbnailUri) temporales.push(thumbnailUri);
        setProgresoMsg("Comprimiendo video...");
        uriParaSubir = await comprimirVideoPro(captura.uri);
        if (uriParaSubir !== captura.uri) temporales.push(uriParaSubir);
        const meta = await getVideoMetaData(uriParaSubir);
        duracionMs = meta?.duration ? Math.round(Number(meta.duration) * 1000) : null;
      } else temporales.push(uriParaSubir);

      const res = await subirMediaChat({
        uri: uriParaSubir, tipo: captura.tipo, thumbnailUri,
        onProgress: ({ fase, progreso }) => { setProgresoPct(progreso); setProgresoMsg(fase === 'subiendo-media' ? `Subiendo archivo... ${progreso}%` : `Subiendo miniatura... ${progreso}%`); }
      });

      const reply = mensajeAResponder; setMensajeAResponder(null);
      await addDoc(collection(db, 'mensajes_chat'), {
        chatId, url: res.mediaUrl, thumbnailUrl: res.thumbnailUrl || null, duracionMs, userId: miUid, user: miPerfil?.nombre || 'Usuario', userPhoto: miPerfil?.fotoUrl || null, createdAt: serverTimestamp(), tipo: captura.tipo, texto: textoSobreMedia.trim(), leido: false,
        replyTo: reply ? { id: reply.id, text: getReplyPreviewText(reply), user: reply.user, previewUrl: reply.thumbnailUrl || reply.url || null } : null
      });
      await actualizarMetadataChat(chatId, userId, captura.tipo === 'video' ? '🎥 Video' : '📷 Foto', true);
      temporales.forEach(t => FileSystem.deleteAsync(t, { idempotent: true }));
    } catch (e) { Alert.alert("Error", "No se pudo enviar."); } finally { setEstaSubiendo(false); setProgresoMsg(""); }
  };

  const enviarMensaje = async () => {
    if (texto.trim() === '') return;
    const t = texto; const reply = mensajeAResponder; setTexto(''); setMensajeAResponder(null);
    try {
      let finalTxt = t;
      if (t.startsWith('[CLASIFICADOS]')) finalTxt = `🟢 ${t}`;
      else if (t.startsWith('[HUELLITAS]')) finalTxt = `🐾 ${t}`;
      await addDoc(collection(db, 'mensajes_chat'), {
        chatId, text: finalTxt, userId: miUid, user: miPerfil?.nombre || 'Usuario', userPhoto: miPerfil?.fotoUrl || null, createdAt: serverTimestamp(), tipo: 'texto', leido: false,
        replyTo: reply ? { id: reply.id, text: getReplyPreviewText(reply), user: reply.user, previewUrl: reply.thumbnailUrl || reply.url || null } : null
      });
      await actualizarMetadataChat(chatId, userId, finalTxt, true);
    } catch (e) { setTexto(t); setMensajeAResponder(reply); }
  };

  const handleEnviarAudio = async (uri) => {
    const tempId = `temp-${Date.now()}`;
    setMensajesOptimistas(p => [{ id: tempId, chatId, url: uri, userId: miUid, user: miPerfil?.nombre || 'Usuario', userPhoto: miPerfil?.fotoUrl || null, createdAt: { seconds: Date.now() / 1000 }, tipo: 'audio', leido: false, enviando: true }, ...p]);
    try {
      const audioUrl = await subirAudioChat(uri);
      const reply = mensajeAResponder; setMensajeAResponder(null);
      await addDoc(collection(db, 'mensajes_chat'), {
        chatId, url: audioUrl, userId: miUid, user: miPerfil?.nombre || 'Usuario', userPhoto: miPerfil?.fotoUrl || null, createdAt: serverTimestamp(), tipo: 'audio', leido: false, clientSideId: tempId,
        replyTo: reply ? { id: reply.id, text: '🎤 Audio', user: reply.user, previewUrl: reply.thumbnailUrl || reply.url || null } : null
      });
      await actualizarMetadataChat(chatId, userId, '🎤 Audio', true);
    } finally { setMensajesOptimistas(p => p.filter(m => m.id !== tempId)); }
  };

  const getReplyPreviewText = (m) => {
    if (!m) return '';
    if (m.tipo === 'audio') return '🎤 Audio';
    if (m.tipo === 'foto') return '📷 Foto';
    if (m.tipo === 'video') return '🎥 Video';
    return m.text || m.texto || '';
  };

  const handleReaccionar = async (msg, emoji) => {
    setMensajeSeleccionado(null);
    const added = await gestionarReaccionMensaje(msg, emoji, miUid);
    if (added) {
      const textoNotif = `Reaccionó con ${emoji} a ${msg.userId === miUid ? 'tu' : 'un'} mensaje`;
      await actualizarMetadataChat(chatId, userId, textoNotif, true);
    }
  };

  return (
    <KeyboardProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={30} color={COLOR_GRAFITO} /></TouchableOpacity>
          <TouchableOpacity style={styles.headerInfo} onPress={() => !bloqueoActivo && router.push({ pathname: '/(tabs)/perfilAjeno', params: { userId } })}>
            <Image source={{ uri: otroPerfil?.fotoUrl || 'https://picsum.photos/200' }} style={styles.headerAvatar} />
            <View>
              <Text style={styles.headerTitle}>{otroPerfil?.nombre || nombreParam || 'Usuario'}</Text>
              {!bloqueoActivo && <View style={styles.statusRow}><View style={[styles.statusDot, { backgroundColor: otroPerfil?.online ? '#34B7F1' : '#FF4444' }]} /><Text style={styles.headerStatus}>{otroPerfil?.online ? 'En línea' : 'Desconectado'}</Text></View>}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => vaciarChat(chatId, miUid)} style={styles.iconBtn}><Ionicons name="trash-outline" size={24} color={COLOR_GRAFITO} /></TouchableOpacity>
        </View>

        {productoContexto && (
          <View style={styles.contextBar}>
            <Image source={{ uri: productoContexto.fotos?.[0] }} style={styles.contextImage} />
            <View style={styles.contextInfo}><Text style={styles.contextTitle} numberOfLines={1}>{productoContexto.titulo}</Text><Text style={styles.contextPrice}>${productoContexto.precio}</Text></View>
            {productoContexto.vendedorId !== miUid && <TouchableOpacity style={styles.contextSendBtn} onPress={() => { setTexto(`Hola! Me interesa: ${productoContexto.titulo}`); setTimeout(() => inputRef.current?.focus(), 100); }}><Text style={styles.contextSendText}>Preguntar</Text></TouchableOpacity>}
            <TouchableOpacity onPress={() => setProductoContexto(null)}><Ionicons name="close" size={20} color="#9CA3AF" /></TouchableOpacity>
          </View>
        )}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            ref={flatListRef}
            data={[...mensajesOptimistas.filter(o => !mensajes.some(m => m.clientSideId === o.id)), ...mensajes]}
            keyExtractor={item => item.id}
            inverted
            contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 10 }}
            ListHeaderComponent={() => otroStatus ? <View style={styles.typingContainer}><Text style={styles.typingText}>{otroStatus === 'escribiendo' ? 'Escribiendo...' : 'Grabando audio...'}</Text></View> : null}
            renderItem={({ item }) => (
              <BurbujaMensaje
                item={item}
                esMio={item.userId === miUid}
                hora={item.createdAt ? new Date(item.createdAt.toMillis ? item.createdAt.toMillis() : item.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                playingId={playingId} onPlayAudio={setPlayingId} onEndedAudio={(id) => {
                  const idx = mensajes.findIndex(m => m.id === id);
                  if (idx > 0 && mensajes[idx-1].tipo === 'audio') setPlayingId(mensajes[idx-1].id);
                  else setPlayingId(null);
                }}
                onLongPress={setMensajeSeleccionado} onSwipeReply={setMensajeAResponder} onReplyPress={(id) => {
                  const idx = mensajes.findIndex(m => m.id === id);
                  if (idx !== -1) { setHighlightId(id); flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 }); setTimeout(() => setHighlightId(null), 3000); }
                }}
                isHighlighted={highlightId === item.id}
              />
            )}
          />

          {mensajeAResponder && (
            <View style={styles.replyPreview}><View style={styles.replyBar} /><View style={{ flex: 1, paddingHorizontal: 10 }}><Text style={styles.replyUser}>{mensajeAResponder.user}</Text><Text style={styles.replyText} numberOfLines={3}>{getReplyPreviewText(mensajeAResponder)}</Text></View>
            {(mensajeAResponder.thumbnailUrl || mensajeAResponder.url) && <Image source={{ uri: mensajeAResponder.thumbnailUrl || mensajeAResponder.url }} style={styles.replyImageMini} />}
            <TouchableOpacity onPress={() => setMensajeAResponder(null)}><Ionicons name="close-circle" size={24} color="#999" /></TouchableOpacity></View>
          )}

          {bloqueoActivo ? (
            <View style={styles.blockedInputContainer}><Ionicons name="ban" size={20} color="#6B7280" /><Text style={styles.blockedInputText}>No puedes enviar mensajes.</Text></View>
          ) : (
            <View style={styles.inputWrapper}>
              <TouchableOpacity style={styles.iconBtn} onPress={async () => {
                try {
                  const ruta = await NativeModules.HistoriasLabNative.abrirCamaraHistorias(false);
                  if (ruta) setArchivoCapturado({ tipo: ruta.endsWith('.mp4') ? 'video' : 'foto', uri: `file://${ruta}` });
                } catch(e){}
              }}><Ionicons name="camera" size={28} color={COLOR_NARANJA} /></TouchableOpacity>
              <View style={styles.inputBoxContainer}>
                {(texto.includes('[CLASIFICADOS]') || texto.includes('[HUELLITAS]')) && <Ionicons name={texto.includes('CLAS') ? "newspaper" : "paw"} size={20} color={texto.includes('CLAS') ? "#059669" : "#10B981"} style={{ marginLeft: 12 }} />}
                <TextInput ref={inputRef} style={styles.input} placeholder="Escribe algo..." value={texto} onChangeText={handleTextChange} multiline />
              </View>
              {texto.length > 0 ? <TouchableOpacity style={styles.sendBtn} onPress={enviarMensaje}><Ionicons name="send" size={20} color="white" /></TouchableOpacity> : <GrabadorAudio onEnviar={handleEnviarAudio} onIniciarGrabacion={() => { setPlayingId(null); toggleMiStatus('grabando'); }} onFinalizarGrabacion={() => toggleMiStatus(null)} />}
            </View>
          )}
        </KeyboardAvoidingView>

        <Modal visible={!!archivoCapturado} animationType="slide"><VistaPrevia archivo={archivoCapturado} onDescartar={() => setArchivoCapturado(null)} onPublicar={handleEnviarMedia} replyData={mensajeAResponder ? { user: mensajeAResponder.user, text: getReplyPreviewText(mensajeAResponder), previewUrl: mensajeAResponder.thumbnailUrl || mensajeAResponder.url } : null} /></Modal>
        {estaSubiendo && <View style={styles.loadingOverlayChat}><View style={styles.loadingCardChat}><ActivityIndicator size="large" color={COLOR_NARANJA} /><View style={{ marginLeft: 15 }}><Text style={styles.loadingTextChat}>Enviando...</Text><Text style={styles.loadingSubTextChat}>{progresoMsg}</Text></View></View></View>}

        <Modal visible={!!mensajeSeleccionado} transparent animationType="fade"><Pressable style={styles.modalOverlay} onPress={() => setMensajeSeleccionado(null)}><View style={styles.modalContent}>
          <View style={styles.reaccionesRow}>{REACCIONES.map(e => <TouchableOpacity key={e} onPress={() => handleReaccionar(mensajeSeleccionado, e)} style={styles.reaccionBtn}><Text style={{ fontSize: 24 }}>{e}</Text></TouchableOpacity>)}</View>
          <TouchableOpacity style={styles.modalOption} onPress={() => { setMensajeAResponder(mensajeSeleccionado); setMensajeSeleccionado(null); setTimeout(() => inputRef.current?.focus(), 10); }}><Ionicons name="arrow-undo-outline" size={20} color="#333" /><Text style={styles.modalOptionText}>Responder</Text></TouchableOpacity>
          {mensajeSeleccionado?.tipo === 'texto' && <TouchableOpacity style={styles.modalOption} onPress={() => { Clipboard.setString(mensajeSeleccionado.text); setMensajeSeleccionado(null); }}><Ionicons name="copy-outline" size={20} color="#333" /><Text style={styles.modalOptionText}>Copiar</Text></TouchableOpacity>}
          <TouchableOpacity style={styles.modalOption} onPress={() => { eliminarMensajeParaMi(mensajeSeleccionado.id, miUid); setMensajeSeleccionado(null); }}><Ionicons name="trash-outline" size={20} color="#333" /><Text style={styles.modalOptionText}>Eliminar para mí</Text></TouchableOpacity>
          {mensajeSeleccionado?.userId === miUid && <TouchableOpacity style={styles.modalOption} onPress={() => { eliminarMensajeParaTodos(mensajeSeleccionado.id); setMensajeSeleccionado(null); }}><Ionicons name="trash" size={20} color="#ff4444" /><Text style={[styles.modalOptionText, { color: '#ff4444' }]}>Eliminar para todos</Text></TouchableOpacity>}
        </View></Pressable></Modal>
      </SafeAreaView>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  backBtn: { marginRight: 10 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#EEE' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 6 },
  headerStatus: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  iconBtn: { padding: 5 },
  inputWrapper: { flexDirection: 'row', padding: 12, backgroundColor: '#FFF', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EEEEEE' },
  inputBoxContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 18, marginHorizontal: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  input: { flex: 1, minHeight: 45, maxHeight: 100, paddingHorizontal: 14, paddingVertical: 8, color: '#1F2937' },
  sendBtn: { backgroundColor: COLOR_NARANJA, width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  replyPreview: { flexDirection: 'row', backgroundColor: '#F3F4F6', padding: 10, borderTopLeftRadius: 15, borderTopRightRadius: 15, marginHorizontal: 10, alignItems: 'center' },
  replyBar: { width: 4, height: '100%', backgroundColor: COLOR_NARANJA, borderRadius: 2 },
  replyUser: { fontWeight: 'bold', color: COLOR_NARANJA, fontSize: 13 },
  replyText: { color: '#666', fontSize: 12 },
  replyImageMini: { width: 45, height: 45, borderRadius: 8, marginLeft: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', borderRadius: 20, width: '85%', padding: 20 },
  reaccionesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20, backgroundColor: '#F9FAFB', borderRadius: 20, padding: 8 },
  reaccionBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  modalOptionText: { fontSize: 16, marginLeft: 15, color: '#333' },
  loadingOverlayChat: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  loadingCardChat: { backgroundColor: 'white', borderRadius: 20, padding: 20, alignItems: 'center', flexDirection: 'row', width: '85%' },
  loadingTextChat: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  loadingSubTextChat: { fontSize: 13, color: '#666' },
  typingContainer: { padding: 10, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 10, alignSelf: 'flex-start', marginLeft: 15 },
  typingText: { fontSize: 13, color: '#6B7280' },
  blockedInputContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#F3F4F6' },
  blockedInputText: { marginLeft: 10, color: '#6B7280', fontWeight: '600' },
  contextBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBF5', padding: 10, borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  contextImage: { width: 40, height: 40, borderRadius: 8 },
  contextInfo: { flex: 1, marginLeft: 12 },
  contextTitle: { fontSize: 14, fontWeight: 'bold' },
  contextPrice: { fontSize: 13, color: COLOR_NARANJA, fontWeight: '900' },
  contextSendBtn: { backgroundColor: COLOR_NARANJA, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 8 },
  contextSendText: { color: 'white', fontSize: 12, fontWeight: 'bold' }
});
