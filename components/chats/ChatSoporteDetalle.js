import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, increment, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';
import { tiempoRelativo } from '../../services/dateUtils';
import { subirArchivoConRuta, borrarArchivoPorUrl } from '../../services/firebase/storageService';
import CamaraInterna from '../camara/CamaraInterna';

const COLOR_NARANJA = '#FF6600';
const COLOR_GRAFITO = '#1F2937';

export default function ChatSoporteDetalle() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mensajes, setMensajes] = useState([]);
  const [mensajesOptimistas, setMensajesOptimistas] = useState([]);
  const [texto, setTexto] = useState('');
  const [imagenAdjunta, setImagenAdjunta] = useState(null);
  const [camaraVisible, setCamaraVisible] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  const miUid = auth.currentUser?.uid;
  const chatId = miUid ? `soporte_${miUid}` : null;

  useEffect(() => {
    if (!chatId) {
      setCargando(false);
      return;
    }

    // Resetear contador de respuestas sin leer del usuario
    if (miUid) {
      const chatRef = doc(db, 'chats', chatId);
      updateDoc(chatRef, {
        [`${miUid}.unreadCount`]: 0,
        unreadCountUser: 0,
        leido: true
      }).catch(() => {});
    }

    // Escuchamos los datos del chat para conocer la marca de tiempo de vaciado del usuario
    const unsubChat = onSnapshot(doc(db, 'chats', chatId), (chatSnap) => {
      const chatData = chatSnap.exists() ? chatSnap.data() : {};
      const tsVaciado = chatData.vaciadoPorUsuarioAt?.seconds || 0;

      const q = query(
        collection(db, 'mensajes_chat'),
        where('chatId', '==', chatId),
        orderBy('createdAt', 'desc')
      );

      const unsubMsgs = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(m => {
            const sec = m.createdAt?.seconds || (Date.now() / 1000);
            return sec >= tsVaciado;
          });
        setMensajes(msgs);
        setCargando(false);
      }, (err) => {
        console.error("Error al cargar mensajes:", err);
        setCargando(false);
      });

      return () => unsubMsgs();
    });

    return () => unsubChat();
  }, [chatId]);

  // Lista combinada sin duplicados
  const dataProcesada = useMemo(() => {
    if (mensajesOptimistas.length === 0) return mensajes;
    const idsReales = new Set(mensajes.map(m => m.id));
    const optFiltrados = mensajesOptimistas.filter(m => !idsReales.has(m.id));
    return [...optFiltrados, ...mensajes];
  }, [mensajes, mensajesOptimistas]);

  const abrirCamaraInterna = () => {
    setCamaraVisible(true);
  };

  const handleVaciarChat = () => {
    if (!chatId || !miUid) return;
    Alert.alert(
      "Vaciar conversación",
      "¿Deseas vaciar los mensajes de tu pantalla?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Vaciar",
          style: "destructive",
          onPress: async () => {
            try {
              const chatRef = doc(db, 'chats', chatId);
              await updateDoc(chatRef, {
                vaciadoPorUsuarioAt: serverTimestamp()
              }).catch(async () => {
                const { setDoc } = require('firebase/firestore');
                await setDoc(chatRef, { vaciadoPorUsuarioAt: serverTimestamp() }, { merge: true });
              });

              setMensajes([]);
              setMensajesOptimistas([]);
            } catch (e) {
              console.error("Error vaciando chat de usuario:", e);
            }
          }
        }
      ]
    );
  };

  const enviarMensajeSoporte = async () => {
    if ((texto.trim() === '' && !imagenAdjunta) || enviando || !miUid) return;

    const textoAEnviar = texto.trim();
    const uriAEnviar = imagenAdjunta;
    setTexto('');
    setImagenAdjunta(null);
    setEnviando(true);

    try {
      const userDoc = await getDoc(doc(db, 'usuarios', miUid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      let mediaUrl = null;
      if (uriAEnviar) {
        const tempId = `temp-${Date.now()}`;
        setMensajesOptimistas([{
          id: tempId,
          chatId,
          userId: miUid,
          user: userData.nombre || 'Usuario',
          text: textoAEnviar,
          url: uriAEnviar,
          tipo: 'foto',
          leido: false,
          enviando: true,
          createdAt: { seconds: Date.now() / 1000 }
        }]);

        mediaUrl = await subirArchivoConRuta(
          uriAEnviar,
          'foto',
          `soporte/${miUid}/${Date.now()}.jpg`
        );

        setMensajesOptimistas([]);
      }

      await addDoc(collection(db, 'mensajes_chat'), {
        chatId,
        userId: miUid,
        user: userData.nombre || 'Usuario',
        userPhoto: userData.fotoUrl || null,
        text: textoAEnviar,
        url: mediaUrl,
        tipo: mediaUrl ? 'foto' : 'texto',
        leido: false,
        createdAt: serverTimestamp()
      });

      const chatRef = doc(db, 'chats', chatId);
      const updatePayload = {
        chatId,
        tipo: 'soporte',
        userName: userData.nombre || 'Usuario',
        userPhoto: userData.fotoUrl || null,
        ultimoMensaje: textoAEnviar || '📷 Foto enviada',
        fechaUltimoMensaje: serverTimestamp(),
        ultimoMensajeDe: miUid,
        leido: false,
        participantes: [miUid, 'admin_soporte_merloconec'],
        [`${miUid}.nombre`]: userData.nombre || 'Usuario',
        [`${miUid}.foto`]: userData.fotoUrl || null,
        [`admin_soporte_merloconec.unreadCount`]: increment(1),
        unreadCount: increment(1)
      };

      await updateDoc(chatRef, updatePayload).catch(async () => {
        const { setDoc } = require('firebase/firestore');
        await setDoc(chatRef, updatePayload);
      });

    } catch (e) {
      console.error("Error al enviar mensaje de soporte:", e);
      Alert.alert("Error", "No se pudo enviar tu mensaje. Inténtalo de nuevo.");
      setTexto(textoAEnviar);
    } finally {
      setMensajesOptimistas([]);
      setEnviando(false);
    }
  };

  const formatHora = (ts) => {
    if (!ts) return '';
    const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <KeyboardProvider>
      <SafeAreaView style={styles.safeArea}>
        {/* CABECERA FORMAL Y PROFESIONAL CON BOTÓN DE VACIAR */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLOR_GRAFITO} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Atención al Cliente</Text>
            <Text style={styles.headerSub}>Merlo Conek • Soporte y Sugerencias</Text>
          </View>
          <TouchableOpacity onPress={handleVaciarChat} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={22} color={COLOR_GRAFITO} />
          </TouchableOpacity>
        </View>

        {/* CONTENIDOR DE CHAT CON TECLADO FLUIDO */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {cargando ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={COLOR_NARANJA} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={dataProcesada}
              keyExtractor={item => item.id}
              inverted
              contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 12 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="headset-outline" size={56} color="#9CA3AF" />
                  <Text style={styles.emptyTitle}>¿En qué podemos ayudarte?</Text>
                  <Text style={styles.emptySub}>
                    Escríbenos tus comentarios, sugerencias o reportes de fallos. Nuestro equipo leerá tu mensaje y te responderá a la brevedad.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const esMio = item.userId === miUid;
                const imgUri = item.url || item.mediaUrl || item.media?.url || item.foto;

                return (
                  <View style={[styles.msgRow, esMio ? styles.rowMio : styles.rowAjeno]}>
                    <View style={[styles.bubble, esMio ? styles.bubbleMio : styles.bubbleAjeno]}>
                      {imgUri ? (
                        <Image source={{ uri: imgUri }} style={styles.chatImage} contentFit="cover" />
                      ) : null}
                      {item.text ? (
                        <Text style={[styles.msgTxt, esMio ? styles.txtMio : styles.txtAjeno]}>
                          {item.text}
                        </Text>
                      ) : null}
                      <View style={styles.footerRow}>
                        <Text style={[styles.horaTxt, esMio ? styles.horaMio : styles.horaAjeno]}>
                          {formatHora(item.createdAt)}
                        </Text>
                        {esMio && (
                          <Ionicons
                            name={item.enviando ? "time-outline" : (item.leido ? "checkmark-done" : "checkmark")}
                            size={14}
                            color={item.enviando ? "#9CA3AF" : (item.leido ? "#2563EB" : "#6B7280")}
                            style={{ marginLeft: 4 }}
                          />
                        )}
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {/* VISTA PREVIA DE IMAGEN ADJUNTA */}
          {imagenAdjunta && (
            <View style={styles.adjuntoContainer}>
              <Image source={{ uri: imagenAdjunta }} style={styles.adjuntoThumb} />
              <Text style={styles.adjuntoTxt} numberOfLines={1}>Imagen seleccionada</Text>
              <TouchableOpacity onPress={() => setImagenAdjunta(null)} style={styles.adjuntoRemove}>
                <Ionicons name="close-circle" size={22} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* BARRA DE ENTRADA MINIMALISTA (CÁMARA INTERNA + TEXTO + ENVIAR) */}
          <View style={styles.inputBar}>
            <TouchableOpacity onPress={abrirCamaraInterna} style={styles.iconBtn}>
              <Ionicons name="images-outline" size={26} color={COLOR_NARANJA} />
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Escribe tu consulta o sugerencia..."
              placeholderTextColor="#9CA3AF"
              value={texto}
              onChangeText={setTexto}
              multiline
            />

            <TouchableOpacity
              style={[styles.sendBtn, (!texto.trim() && !imagenAdjunta) && { opacity: 0.5 }]}
              onPress={enviarMensajeSoporte}
              disabled={(!texto.trim() && !imagenAdjunta) || enviando}
            >
              {enviando ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* MODAL DE CÁMARA INTERNA */}
        <Modal
          visible={camaraVisible}
          animationType="slide"
          transparent={false}
          statusBarTranslucent={true}
          onRequestClose={() => setCamaraVisible(false)}
        >
          <CamaraInterna
            visible={camaraVisible}
            onCerrar={() => setCamaraVisible(false)}
            onFotoCapturada={(uri) => {
              setImagenAdjunta(uri);
              setCamaraVisible(false);
            }}
          />
        </Modal>
      </SafeAreaView>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  flexContainer: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backBtn: { padding: 4, marginRight: 10 },
  headerTitleContainer: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: COLOR_GRAFITO },
  headerSub: { fontSize: 11, color: '#6B7280' },
  iconBtn: { padding: 6 },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    marginTop: 60,
  },
  emptyTitle: { fontSize: 17, fontWeight: 'bold', color: '#374151', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  msgRow: { marginVertical: 4, flexDirection: 'row' },
  rowMio: { justifyContent: 'flex-end' },
  rowAjeno: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1.2,
  },
  bubbleMio: {
    backgroundColor: '#FFF5ED',
    borderColor: '#FF6600',
    borderBottomRightRadius: 4,
  },
  bubbleAjeno: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
    borderBottomLeftRadius: 4,
  },
  chatImage: { width: 220, height: 220, borderRadius: 12, marginBottom: 8 },
  msgTxt: { fontSize: 15, color: '#1F2937', lineHeight: 21 },
  txtMio: { color: '#1F2937' },
  txtAjeno: { color: '#1F2937' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  horaTxt: { fontSize: 10, color: '#6B7280' },
  horaMio: { color: '#6B7280' },
  horaAjeno: { color: '#9CA3AF' },
  adjuntoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 8,
    marginHorizontal: 15,
    borderRadius: 12,
    marginBottom: 8,
  },
  adjuntoThumb: { width: 36, height: 36, borderRadius: 6, marginRight: 10 },
  adjuntoTxt: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },
  adjuntoRemove: { padding: 4 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#1F2937',
    marginHorizontal: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLOR_NARANJA,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
