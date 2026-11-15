import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, Modal, Pressable, Clipboard, Platform, NativeModules, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, query, collection, where, orderBy, limit, getDoc, serverTimestamp, addDoc, arrayUnion, updateDoc } from 'firebase/firestore';
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
import { HaloUserIcon } from '../icons/HaloIcons';
import { comprimirVideoPro } from '../camara/compresor3';
import { procesarImagenCompleta } from '../camaraFotos/OptimizadorImagenes';
import { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

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
  const [metaCargada, setMetaCargada] = useState(false);

  const [mensajesOptimistas, setMensajesOptimistas] = useState([]);
  const optimistasRef = useRef([]);

  const agregarOptimista = (msg) => {
    optimistasRef.current = [msg, ...optimistasRef.current.filter(o => o.id !== msg.id)];
    setMensajesOptimistas([...optimistasRef.current]);
  };

  const removerOptimista = (id) => {
    optimistasRef.current = optimistasRef.current.filter(o => o.id !== id);
    setMensajesOptimistas([...optimistasRef.current]);
  };
  const [productoContexto, setProductoContexto] = useState(null);
  const [mensajeSeleccionado, setMensajeSeleccionado] = useState(null);
  const [mensajeAResponder, setMensajeAResponder] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [archivoCapturado, setArchivoCapturado] = useState(null);
  const [estaSubiendo, setEstaSubiendo] = useState(false);
  const [progresoMsg, setProgresoMsg] = useState("");
  const [progresoPct, setProgresoPct] = useState(0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const chatId = tipo === 'market' ? [miUid, userId].sort().join('_') + '_market' : (tipo === 'soporte' ? [miUid, userId].sort().join('_') + '_soporte' : [miUid, userId].sort().join('_'));
  const loTengoBloqueado = miPerfil?.bloqueados?.includes(userId);
  const meTieneBloqueado = otroPerfil?.bloqueados?.includes(miUid);
  const bloqueoActivo = loTengoBloqueado || meTieneBloqueado;

  const scrollToMessage = (id) => {
    const index = mensajes.findIndex(m => m.id === id);
    if (index !== -1) {
      setHighlightId(id);
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setTimeout(() => setHighlightId(null), 3000);
    }
  };

  const reproducirSiguiente = (idActual) => {
    const indexActual = mensajes.findIndex(m => m.id === idActual);
    if (indexActual === -1) return;
    const siguienteMensaje = mensajes[indexActual - 1];
    if (siguienteMensaje && siguienteMensaje.tipo === 'audio') {
      setPlayingId(siguienteMensaje.id);
    } else {
      setPlayingId(null);
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatSeparatorDate = (date) => {
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    if (date.toDateString() === hoy.toDateString()) return 'Hoy';
    if (date.toDateString() === ayer.toDateString()) return 'Ayer';

    return date.toLocaleDateString([], { day: '2-digit', month: 'long', year: 'numeric' });
  };

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
      } else {
        setVaciadoTimestamp(null);
      }
      setMetaCargada(true);
    });

    // Limpiar historial de notificaciones nativas y marcar como chat activo
    if (NativeModules.NotificationHistoryModule) {
      NativeModules.NotificationHistoryModule.clearChatHistory(chatId);
      NativeModules.NotificationHistoryModule.setActiveChat(chatId);
    }

    return () => {
      toggleMiStatus(null);
      unsub();
      // Desmarcar chat activo al salir
      if (NativeModules.NotificationHistoryModule) {
        NativeModules.NotificationHistoryModule.setActiveChat(null);
      }
    };
  }, [chatId]);

  useEffect(() => {
    if (!metaCargada) return;

    const q = query(collection(db, 'mensajes_chat'), where('chatId', '==', chatId), orderBy('createdAt', 'desc'), limit(40));
    return onSnapshot(q, (snapshot) => {
      const rawMsgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      marcarMensajesComoLeidos(rawMsgs, miUid);

      // Limpiar de optimistasRef aquellos mensajes que ya llegaron en rawMsgs
      const idsLlegados = rawMsgs.map(m => m.clientSideId).filter(Boolean);
      if (idsLlegados.length > 0) {
        optimistasRef.current = optimistasRef.current.filter(o => !idsLlegados.includes(o.id));
      }

      const msgsFiltrados = rawMsgs.filter(m => {
        if (m.borradoPara && m.borradoPara.includes(miUid)) return false;
        if (vaciadoTimestamp) {
          const tV = vaciadoTimestamp.toMillis ? vaciadoTimestamp.toMillis() : (vaciadoTimestamp.seconds * 1000);
          const tM = m.createdAt ? (m.createdAt.toMillis ? m.createdAt.toMillis() : (m.createdAt.seconds ? m.createdAt.seconds * 1000 : m.createdAt)) : 0;
          return tM > tV;
        }
        return true;
      });

      // Combinar con optimistas pendientes que aún no llegaron a Firestore
      const optimistasPendientes = optimistasRef.current.filter(o => !rawMsgs.some(m => m.clientSideId === o.id));
      const listaCombinada = [...optimistasPendientes, ...msgsFiltrados];

      const processed = [];
      for (let i = 0; i < listaCombinada.length; i++) {
        const current = listaCombinada[i];
        const next = listaCombinada[i + 1];

        const currentDate = current.createdAt ? (current.createdAt.toDate ? current.createdAt.toDate() : new Date(current.createdAt.seconds * 1000)) : new Date();
        const nextDate = next && next.createdAt ? (next.createdAt.toDate ? next.createdAt.toDate() : new Date(next.createdAt.seconds * 1000)) : null;

        processed.push(current);

        if (!nextDate || currentDate.toDateString() !== nextDate.toDateString()) {
          processed.push({
            id: `date-${current.id}`,
            tipo: 'date_separator',
            date: currentDate,
            createdAt: current.createdAt
          });
        }
      }

      setMensajes(processed);
    });
  }, [chatId, vaciadoTimestamp, metaCargada]);

  const handleEnviarMedia = async (textoSobreMedia = '', uriEditada = null) => {
    if (estaSubiendo || !archivoCapturado) return;

    // 1. Datos iniciales y cierre inmediato de vista previa
    const uriParaSubir = uriEditada || archivoCapturado.uri;
    const thumbnailUri = archivoCapturado.thumbnailLocal || archivoCapturado.uriLQ || null;
    const tipo = archivoCapturado.tipo;
    const duracionMsPrevia = archivoCapturado.duracionMs || null;

    const tempId = `temp-media-${Date.now()}`;
    setArchivoCapturado(null); // Cierre inmediato de la pantalla de edición

    try {
      // 2. Crear mensaje optimista
      const msgOptimista = {
        id: tempId,
        chatId,
        url: uriParaSubir, // Usamos la URI local para mostrarla ya
        thumbnailUrl: thumbnailUri,
        duracionMs: duracionMsPrevia,
        userId: miUid,
        user: miPerfil?.nombre || 'Usuario',
        userPhoto: miPerfil?.fotoUrl || null,
        createdAt: { seconds: Date.now() / 1000 },
        tipo: tipo,
        texto: textoSobreMedia.trim(),
        leido: false,
        enviando: true, // Flag para mostrar spinner local
        replyTo: mensajeAResponder ? {
          id: mensajeAResponder.id,
          text: getReplyPreviewText(mensajeAResponder),
          user: mensajeAResponder.user,
          previewUrl: mensajeAResponder.thumbnailUrl || mensajeAResponder.url || null
        } : null
      };

      agregarOptimista(msgOptimista);
      const reply = mensajeAResponder;
      setMensajeAResponder(null);

      // 3. Subida real en segundo plano
      setEstaSubiendo(true);
      setProgresoPct(0);

      let duracionMs = duracionMsPrevia;
      if (tipo === 'video' && !duracionMs) {
        const meta = await getVideoMetaData(uriParaSubir);
        duracionMs = meta?.duration ? Math.round(Number(meta.duration) * 1000) : null;
      }

      const res = await subirMediaChat({
        uri: uriParaSubir,
        tipo: tipo,
        thumbnailUri,
        onProgress: ({ fase, progreso }) => {
          setProgresoPct(progreso);
          setProgresoMsg(fase === 'subiendo-media' ? `Subiendo archivo... ${progreso}%` : `Subiendo miniatura... ${progreso}%`);
        }
      });

      // 4. Enviar a Firestore real
      const { enviarMensajeChat } = require('../../services/firebase/chatService');
      await enviarMensajeChat({
        chatId,
        paraUserId: userId,
        texto: textoSobreMedia.trim(),
        tipo: tipo,
        media: {
          url: res.mediaUrl,
          thumbnailUrl: res.thumbnailUrl || null,
          duracionMs,
          tipo: tipo
        },
        replyTo: reply ? { id: reply.id, text: getReplyPreviewText(reply), user: reply.user, previewUrl: reply.thumbnailUrl || reply.url || null } : null,
        clientSideId: tempId, // Pulsera de identidad
        extraData: tipo === 'market' ? { tipo: 'market', productId } : (tipo === 'soporte' ? { tipo: 'soporte' } : {}) // PASAR CONTEXTO
      });
    } catch (e) {
      console.error("Error handleEnviarMedia:", e);
      Alert.alert("Error", "No se pudo enviar el archivo.");
      removerOptimista(tempId);
    } finally {
      setEstaSubiendo(false);
      setProgresoMsg("");
    }
  };

  const enviarUbicacion = async () => {
    const tempId = `temp-loc-${Date.now()}`;
    const reply = mensajeAResponder; setMensajeAResponder(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permiso denegado", "Se necesita permiso de ubicación para compartirla.");
        return;
      }
      setEstaSubiendo(true);
      setProgresoMsg("Obteniendo ubicación GPS...");
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };

      const msgOptimista = {
        id: tempId,
        chatId,
        userId: miUid,
        user: miPerfil?.nombre || 'Usuario',
        userPhoto: miPerfil?.fotoUrl || null,
        text: '📍 Ubicación compartida',
        coords,
        createdAt: { seconds: Date.now() / 1000 },
        tipo: 'ubicacion',
        leido: false,
        enviando: true,
        replyTo: reply ? { id: reply.id, text: getReplyPreviewText(reply), user: reply.user, previewUrl: reply.thumbnailUrl || reply.url || null } : null
      };

      agregarOptimista(msgOptimista);

      const { enviarMensajeChat } = require('../../services/firebase/chatService');
      await enviarMensajeChat({
        chatId,
        paraUserId: userId,
        texto: '📍 Ubicación compartida',
        tipo: 'ubicacion',
        coords,
        replyTo: reply ? { id: reply.id, text: getReplyPreviewText(reply), user: reply.user, previewUrl: reply.thumbnailUrl || reply.url || null } : null,
        clientSideId: tempId,
        extraData: tipo === 'market' ? { tipo: 'market', productId } : (tipo === 'soporte' ? { tipo: 'soporte' } : {})
      });
    } catch (e) {
      console.error("Error enviando ubicación:", e);
      Alert.alert("Error", "No se pudo obtener la ubicación actual.");
      removerOptimista(tempId);
    } finally {
      setEstaSubiendo(false);
      setProgresoMsg("");
    }
  };

  const enviarMensaje = async () => {
    if (texto.trim() === '') return;
    const t = texto; const reply = mensajeAResponder; setTexto(''); setMensajeAResponder(null);

    // ID temporal para el mensaje optimista
    const tempId = `temp-text-${Date.now()}`;

    try {
      let finalTxt = t;
      if (t.startsWith('[CLASIFICADOS]')) finalTxt = `🟢 ${t}`;
      else if (t.startsWith('[HUELLITAS]')) finalTxt = `🐾 ${t}`;

      // 1. Crear mensaje optimista
      const msgOptimista = {
        id: tempId,
        chatId,
        userId: miUid,
        user: miPerfil?.nombre || 'Usuario',
        userPhoto: miPerfil?.fotoUrl || null,
        text: finalTxt,
        createdAt: { seconds: Date.now() / 1000 },
        tipo: 'texto',
        leido: false,
        enviando: true, // Flag para mostrar algún indicador si quieres
        replyTo: reply ? {
          id: reply.id,
          text: getReplyPreviewText(reply),
          user: reply.user,
          previewUrl: reply.thumbnailUrl || reply.url || null
        } : null
      };

      agregarOptimista(msgOptimista);

      const { enviarMensajeChat } = require('../../services/firebase/chatService');
      await enviarMensajeChat({
        chatId,
        paraUserId: userId,
        texto: finalTxt,
        replyTo: reply ? { id: reply.id, text: getReplyPreviewText(reply), user: reply.user, previewUrl: reply.thumbnailUrl || reply.url || null } : null,
        clientSideId: tempId,
        extraData: tipo === 'market' ? { tipo: 'market', productId } : (tipo === 'soporte' ? { tipo: 'soporte' } : {}) // PASAR CONTEXTO MARKET
      });
    } catch (e) {
      console.error("Error enviando mensaje:", e);
      setTexto(t);
      setMensajeAResponder(reply);
      removerOptimista(tempId);
    }
  };

  const handleEnviarAudio = async (uri) => {
    const tempId = `temp-${Date.now()}`;
    agregarOptimista({ id: tempId, chatId, url: uri, userId: miUid, user: miPerfil?.nombre || 'Usuario', userPhoto: miPerfil?.fotoUrl || null, createdAt: { seconds: Date.now() / 1000 }, tipo: 'audio', leido: false, enviando: true });
    try {
      const audioUrl = await subirAudioChat(uri);
      const reply = mensajeAResponder; setMensajeAResponder(null);

      const { enviarMensajeChat } = require('../../services/firebase/chatService');
      await enviarMensajeChat({
        chatId,
        paraUserId: userId,
        tipo: 'audio',
        media: { url: audioUrl, tipo: 'audio' },
        replyTo: reply ? { id: reply.id, text: '🎤 Audio', user: reply.user, previewUrl: reply.thumbnailUrl || reply.url || null } : null,
        clientSideId: tempId, // Pulsera de identidad
        extraData: tipo === 'market' ? { tipo: 'market', productId } : (tipo === 'soporte' ? { tipo: 'soporte' } : {}) // PASAR CONTEXTO MARKET
      });
    } catch (e) {
      console.error("Error enviando audio:", e);
      removerOptimista(tempId);
    }
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

  const handleBack = () => {
    // Si podemos ir atrás Y hay historial previo real, vamos atrás.
    // Pero si venimos de una notificación, canGoBack puede ser falso o llevarnos al Home.
    // Forzamos la vuelta a la lista de chats para que siempre pase por ahí.
    router.replace('/chats');
    return true;
  };

  useEffect(() => {
    // Escuchar el botón físico de Android
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => backHandler.remove();
  }, []);

  return (
    <KeyboardProvider>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}><Ionicons name="arrow-back" size={30} color={COLOR_GRAFITO} /></TouchableOpacity>
          <TouchableOpacity style={styles.headerInfo} onPress={() => !bloqueoActivo && router.push({ pathname: '/(tabs)/perfilAjeno', params: { userId } })}>
            {otroPerfil?.fotoUrl ? (
              <Image source={{ uri: otroPerfil.fotoUrl }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, { backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' }]}>
                <HaloUserIcon size={20} color="#FFF" />
              </View>
            )}
            <View>
              <Text style={styles.headerTitle}>{otroPerfil?.nombre || nombreParam || 'Usuario'}</Text>
              {!bloqueoActivo && (
                <View style={styles.statusRow}>
                  {otroStatus ? (
                    <Text style={[styles.headerStatus, { color: COLOR_NARANJA, fontWeight: 'bold' }]}>
                      {otroStatus === 'escribiendo' ? 'Escribiendo...' : 'Grabando audio...'}
                    </Text>
                  ) : (
                    <>
                      <View style={[styles.statusDot, { backgroundColor: otroPerfil?.online ? '#34B7F1' : '#FF4444' }]} />
                      <Text style={styles.headerStatus}>{otroPerfil?.online ? 'En línea' : 'Desconectado'}</Text>
                    </>
                  )}
                </View>
              )}
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

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={mensajes}
            keyExtractor={item => item.id}
            inverted
            contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 10 }}
            keyboardShouldPersistTaps="always"
            ListHeaderComponent={() => otroStatus ? <View style={styles.typingContainer}><Text style={styles.typingText}>{otroStatus === 'escribiendo' ? 'Escribiendo...' : 'Grabando audio...'}</Text></View> : null}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={Platform.OS === 'android'}
            updateCellsBatchingPeriod={50}
            onScroll={(e) => {
              const offset = e.nativeEvent.contentOffset.y;
              setShowScrollBottom(offset > 500);
            }}
            onScrollToIndexFailed={(info) => {
              flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
              }, 100);
            }}
            renderItem={({ item, index }) => {
              if (item.tipo === 'date_separator') {
                return <View style={styles.dateSeparator}><Text style={styles.dateSeparatorText}>{formatSeparatorDate(item.date)}</Text></View>;
              }

              const prevItem = mensajes[index - 1]; // Más reciente en el tiempo
              const nextItem = mensajes[index + 1]; // Más antiguo en el tiempo

              // Evitar ocultar foto si el siguiente es un separador o si el remitente cambia
              const sameSenderAsNext = nextItem &&
                                     nextItem.userId === item.userId &&
                                     nextItem.tipo !== 'date_separator';

              const horaFinal = item.createdAt ? formatTime(item.createdAt) : formatTime({ seconds: Date.now()/1000 });

              const esMio = item.userId === miUid;
              const photoReal = item.userPhoto || (esMio ? miPerfil?.fotoUrl : otroPerfil?.fotoUrl) || null;
              const itemConFoto = { ...item, userPhoto: photoReal };

              return (
                <BurbujaMensaje
                  item={itemConFoto}
                  esMio={esMio}
                  hora={horaFinal}
                  playingId={playingId}
                  onPlayAudio={setPlayingId}
                  onEndedAudio={reproducirSiguiente}
                  onLongPress={setMensajeSeleccionado}
                  onSwipeReply={setMensajeAResponder}
                  onReplyPress={scrollToMessage}
                  isHighlighted={highlightId === item.id}
                  showUserPhoto={!sameSenderAsNext}
                />
              );
            }}
          />

          {showScrollBottom && (
            <TouchableOpacity
              style={styles.scrollBottomBtn}
              onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
            >
              <Ionicons name="chevron-down" size={24} color="white" />
            </TouchableOpacity>
          )}

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
                  const ruta = await NativeModules.HistoriasLabNative.abrirCamaraHistorias(false, false);
                  if (ruta) {
                    const uriOriginal = `file://${ruta}`;
                    const esVideo = ruta.endsWith('.mp4');

                    setEstaSubiendo(true);
                    setProgresoMsg("Optimizando media...");
                    setProgresoPct(0);

                    if (esVideo) {
                      const thumb = await VideoThumbnails.getThumbnailAsync(uriOriginal, { time: 1000 }).then(r => r.uri);
                      const uriOptimizada = await comprimirVideoPro(uriOriginal);
                      const meta = await getVideoMetaData(uriOptimizada || uriOriginal);
                      const duracionMs = meta?.duration ? Math.round(Number(meta.duration) * 1000) : null;

                      setArchivoCapturado({
                        tipo: 'video',
                        uri: uriOptimizada || uriOriginal,
                        thumbnailLocal: thumb,
                        duracionMs
                      });
                    } else {
                      const result = await procesarImagenCompleta(uriOriginal, "CHAT-CAPTURE");
                      setArchivoCapturado({
                        tipo: 'foto',
                        uri: result.uriPrincipal,
                        uriLQ: result.uriLQ
                      });
                    }
                    setEstaSubiendo(false);
                  }
                } catch(e){
                  console.error("Error captura chat:", e);
                  setEstaSubiendo(false);
                }
              }}><Ionicons name="camera" size={28} color={COLOR_NARANJA} /></TouchableOpacity>
              <TouchableOpacity onPress={enviarUbicacion} style={{ marginLeft: 8, marginRight: 4 }}>
                <Ionicons name="location-outline" size={26} color={COLOR_NARANJA} />
              </TouchableOpacity>
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
  contextSendText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  dateSeparator: { alignSelf: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginVertical: 15, borderWidth: 1, borderColor: '#E5E7EB' },
  dateSeparatorText: { fontSize: 12, color: '#6B7280', fontWeight: 'bold' },
  scrollBottomBtn: { position: 'absolute', bottom: 80, right: 20, backgroundColor: COLOR_NARANJA, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, zIndex: 100 },
});
