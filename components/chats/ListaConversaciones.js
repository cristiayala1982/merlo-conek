import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { eliminarChat, buscarUsuarios, obtenerPerfilUsuario } from '../../services/firebaseService';
import { getSectionCache, setSectionCache } from '../../services/feedState';
import { Navbar } from '../barraNavegacion/Navbar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HaloMessageIcon, HaloMarketIcon, HaloUserIcon } from '../icons/HaloIcons';
import { BackHandler } from 'react-native';

const COLOR_NARANJA = '#FF6600';
const COLOR_GRAFITO = '#1F2937';

export default function ListaConversaciones({ miUid }) {
  const router = useRouter();
  const [chats, setChats] = useState(getSectionCache('chats'));
  const [loading, setLoading] = useState(chats.length === 0);
  const [tipoVista, setTipoVista] = useState('regular'); // 'regular' o 'market'
  const [pendientesRegular, setPendientesRegular] = useState(0);
  const [pendientesMarket, setPendientesMarket] = useState(0);

  const [modalNuevoChatVisible, setModalNuevoChatVisible] = useState(false);
  const [tabNuevoChat, setTabNuevoChat] = useState('amigos'); // 'amigos' o 'sugeridos'
  const [miPerfilLocal, setMiPerfilLocal] = useState(null);
  const [busquedaNuevoChat, setBusquedaNuevoChat] = useState('');
  const [resultadosUsuarios, setResultadosUsuarios] = useState([]);
  const [cargandoBusqueda, setCargandoBusqueda] = useState(false);

  useEffect(() => {
    if (!modalNuevoChatVisible) return;
    setCargandoBusqueda(true);

    // Traemos el perfil para saber a quién sigo
    const unsubPerfil = obtenerPerfilUsuario(miUid, (data) => setMiPerfilLocal(data));

    const unsubUsuarios = buscarUsuarios(busquedaNuevoChat, (lista) => {
      setResultadosUsuarios(lista.filter(u => u.id !== miUid));
      setCargandoBusqueda(false);
    });

    return () => {
      unsubPerfil();
      unsubUsuarios();
    };
  }, [busquedaNuevoChat, modalNuevoChatVisible, miUid]);

  const loSigo = (uid) => {
    return miPerfilLocal?.siguiendo?.includes(uid);
  };

  const listaFiltradaNuevoChat = resultadosUsuarios.filter(u => {
    if (tabNuevoChat === 'amigos') return loSigo(u.id);
    return true;
  });

  useEffect(() => {
    if (!miUid) return;
    const q = query(
      collection(db, 'chats'),
      where('participantes', 'array-contains', miUid),
      orderBy('fechaUltimoMensaje', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const allChats = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      let countReg = 0;
      let countMark = 0;

      allChats.forEach(chat => {
        if (chat.tipo === 'soporte') return;
        if (chat[miUid]?.eliminadoPara !== true) {
          const unread = chat[miUid]?.unreadCount || 0;
          if (chat.tipo === 'market') countMark += unread > 0 ? 1 : 0;
          else countReg += unread > 0 ? 1 : 0;
        }
      });

      setPendientesRegular(countReg);
      setPendientesMarket(countMark);

      let filtered = tipoVista === 'regular'
        ? allChats.filter(chat =>
            (chat.tipo === 'regular' || !chat.tipo) &&
            chat.tipo !== 'soporte' &&
            chat[miUid]?.eliminadoPara !== true
          )
        : allChats.filter(chat =>
            chat.tipo === 'market' &&
            chat[miUid]?.eliminadoPara !== true
          );

      setChats(filtered);
      if (tipoVista === 'regular') {
        setSectionCache('chats', filtered);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [miUid, tipoVista]);

  useEffect(() => {
    // Escuchar el botón físico de Android específicamente en la lista
    const handlePhysicalBack = () => {
      router.replace('/(tabs)/home');
      return true; // Bloquea la acción por defecto para evitar bucles
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handlePhysicalBack);
    return () => backHandler.remove();
  }, []);

  const handleEliminarChat = (chatId) => {
    Alert.alert("Eliminar conversación", "¿Estás seguro de que deseas eliminar este chat? No podrás recuperar los mensajes.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => eliminarChat(chatId, miUid) }
    ]);
  };

  const formatFecha = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    const hoy = new Date();
    if (d.toDateString() === hoy.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Navbar />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/home')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={30} color={COLOR_GRAFITO} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chats</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity onPress={() => setModalNuevoChatVisible(true)} style={[styles.toggleBtn, { marginRight: 6 }]}>
            <Ionicons name="search" size={24} color={COLOR_GRAFITO} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTipoVista('regular')} style={styles.toggleBtn}>
            <View>
              <HaloMessageIcon size={30} color={tipoVista === 'regular' ? COLOR_NARANJA : '#6B7280'} filled={tipoVista === 'regular'} />
              {pendientesRegular > 0 && <View style={styles.toggleBadge}><Text style={styles.toggleBadgeText}>{pendientesRegular}</Text></View>}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTipoVista('market')} style={styles.toggleBtn}>
            <View>
              <HaloMarketIcon size={32} color={tipoVista === 'market' ? COLOR_NARANJA : '#6B7280'} filled={tipoVista === 'market'} />
              {pendientesMarket > 0 && <View style={styles.toggleBadge}><Text style={styles.toggleBadgeText}>{pendientesMarket}</Text></View>}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLOR_NARANJA} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={item => item.id}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={60} color="#CCC" />
              <Text style={styles.emptyText}>No tienes conversaciones aún.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ChatItem
               item={item}
               miUid={miUid}
               tipoVista={tipoVista}
               handleEliminarChat={handleEliminarChat}
               formatFecha={formatFecha}
               router={router}
            />
          )}
        />
      )}

      <Modal visible={modalNuevoChatVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Iniciar Nuevo Chat</Text>
              <TouchableOpacity onPress={() => setModalNuevoChatVisible(false)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
            </View>

            {/* PESTAÑAS: Amigos vs Sugeridos */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tabBtn, tabNuevoChat === 'amigos' && styles.tabBtnActive]}
                onPress={() => setTabNuevoChat('amigos')}
              >
                <Text style={[styles.tabTxt, tabNuevoChat === 'amigos' && styles.tabTxtActive]}>Mis Amigos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, tabNuevoChat === 'sugeridos' && styles.tabBtnActive]}
                onPress={() => setTabNuevoChat('sugeridos')}
              >
                <Text style={[styles.tabTxt, tabNuevoChat === 'sugeridos' && styles.tabTxtActive]}>Sugeridos</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                placeholder="Buscar amigo o usuario..."
                style={styles.modalSearchInput}
                value={busquedaNuevoChat}
                onChangeText={setBusquedaNuevoChat}
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
              {busquedaNuevoChat ? (
                <TouchableOpacity onPress={() => setBusquedaNuevoChat('')}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ) : null}
            </View>

            {cargandoBusqueda ? (
              <ActivityIndicator color={COLOR_NARANJA} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={listaFiltradaNuevoChat}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.userRow}
                    onPress={() => {
                      setModalNuevoChatVisible(false);
                      router.push({
                        pathname: '/chats',
                        params: { userId: item.id, tipo: tipoVista }
                      });
                    }}
                  >
                    <Image
                      source={{ uri: item.fotoUrl || 'https://picsum.photos/100/100' }}
                      style={styles.userAvatar}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.userNameText}>{item.nombre || 'Usuario'}</Text>
                      <Text style={styles.userSubText} numberOfLines={1}>{item.bio || 'Vecino de Merlo Conek'}</Text>
                    </View>
                    <View style={styles.startChatBtn}>
                      <HaloMessageIcon size={22} color={COLOR_NARANJA} />
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingBottom: 40 }}
                ListEmptyComponent={
                  <Text style={styles.emptySearchTxt}>No se encontraron usuarios.</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatusBadge({ userId, size = 15, border = true }) {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    if (!userId) return;
    return onSnapshot(doc(db, 'usuarios', userId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        let isOnline = data.online || false;
        if (isOnline && data.ultimaVez) {
          const ahora = Date.now();
          const ultimaVez = data.ultimaVez.toMillis ? data.ultimaVez.toMillis() : (data.ultimaVez.seconds * 1000);
          if (ahora - ultimaVez > 180000) isOnline = false;
        }
        setOnline(isOnline);
      }
    });
  }, [userId]);
  return <View style={[styles.listStatusDot, { width: size, height: size, borderRadius: size / 2, backgroundColor: online ? '#34B7F1' : '#FF4444', borderWidth: border ? 2 : 0, borderColor: 'white' }]} />;
}

function ChatItem({ item, miUid, tipoVista, handleEliminarChat, formatFecha, router }) {
  const otroId = item.participantes?.find(id => id !== miUid);

  // LECTURA DIRECTA: SIN ESTADOS, SIN EFECTOS (IGUAL QUE EL MURO)
  const otroInfo = (otroId && item[otroId]) ? item[otroId] : {};
  const displayNombre = otroInfo.nombre || 'Usuario';
  const displayFoto = otroInfo.foto || null;

  const miData = item[miUid] || {};
  const unreadCount = miData.unreadCount || 0;
  const fechaUltimo = item.fechaUltimoMensaje;
  const ultimoVaciado = miData.ultimoVaciado;
  const vaciadoMillis = ultimoVaciado?.toMillis ? ultimoVaciado.toMillis() : (ultimoVaciado?.seconds ? ultimoVaciado.seconds * 1000 : 0);

  const statusOtro = item[otroId]?.status;
  let textoPreview = item.ultimoMensaje;
  let esStatus = false;
  const esClasificados = textoPreview?.startsWith('🟢 [CLASIFICADOS]');
  const esHuellitas = textoPreview?.startsWith('🐾 [HUELLITAS]');

  if (textoPreview?.startsWith('Reaccionó') && unreadCount === 0) textoPreview = textoPreview.replace('Reaccionó', 'Reaccionaste');
  if (statusOtro === 'escribiendo') { textoPreview = 'Escribiendo...'; esStatus = true; }
  else if (statusOtro === 'grabando') { textoPreview = 'Grabando audio...'; esStatus = true; }
  else if (ultimoVaciado && fechaUltimo) {
    const tUltimo = fechaUltimo.toMillis ? fechaUltimo.toMillis() : (fechaUltimo.seconds * 1000);
    if (vaciadoMillis >= tUltimo) textoPreview = "";
  }

  if (textoPreview?.startsWith('Compartió')) {
    textoPreview = item.ultimoMensajeDe === miUid ? textoPreview.replace('Compartió', 'Compartiste') : textoPreview.replace('Compartió', 'Te compartió');
  }

  return (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => router.push({
        pathname: '/chats',
        params: { userId: otroId, tipo: tipoVista, productId: item.productId, vaciadoInicio: vaciadoMillis || 0 }
      })}
      onLongPress={() => handleEliminarChat(item.id)}
    >
      <View style={styles.avatarContainer}>
        {displayFoto ? (
          <Image source={{ uri: displayFoto }} style={styles.chatAvatar} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.chatAvatar, { backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' }]}>
            <HaloUserIcon size={24} color="#FFF" />
          </View>
        )}
        <StatusBadge userId={otroId} />
      </View>
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatNombre}>{displayNombre}</Text>
          <Text style={styles.chatFecha}>{formatFecha(item.fechaUltimoMensaje)}</Text>
        </View>
        <View style={styles.ultimoMsgRow}>
          {esClasificados && <Ionicons name="newspaper" size={14} color="#059669" style={{ marginRight: 4 }} />}
          {esHuellitas && <Ionicons name="paw" size={14} color="#10B981" style={{ marginRight: 4 }} />}

          <Text style={[styles.chatUltimo, esStatus && { color: COLOR_NARANJA, fontWeight: 'bold' }, (esClasificados || esHuellitas) && { color: '#065F46', fontWeight: '500' }]} numberOfLines={1}>
            {esClasificados ? textoPreview.replace('🟢 ', '') : esHuellitas ? textoPreview.replace('🐾 ', '') : textoPreview}
          </Text>
          {unreadCount > 0 && <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{unreadCount}</Text></View>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  backBtn: { marginRight: 10 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleBtn: { padding: 5, position: 'relative' },
  toggleBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: 'white', zIndex: 10 },
  toggleBadgeText: { color: 'white', fontSize: 9, fontWeight: '900' },
  chatItem: { flexDirection: 'row', padding: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  avatarContainer: { position: 'relative' },
  listStatusDot: { position: 'absolute', bottom: 1, right: 1, zIndex: 1 },
  chatAvatar: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#EEE' },
  chatContent: { flex: 1, marginLeft: 15 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatNombre: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  chatFecha: { fontSize: 12, color: '#9CA3AF' },
  chatUltimo: { fontSize: 14, color: '#6B7280', flex: 1 },
  ultimoMsgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unreadBadge: { backgroundColor: COLOR_NARANJA, minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, marginLeft: 10 },
  unreadBadgeText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 15, fontSize: 16, color: '#9CA3AF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', height: '80%', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  tabsContainer: { flexDirection: 'row', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: COLOR_NARANJA },
  tabTxt: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabTxtActive: { color: COLOR_NARANJA },
  modalSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, height: 46 },
  modalSearchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#111827' },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  userAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EEE' },
  userNameText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  userSubText: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  startChatBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FFEDD5', justifyContent: 'center', alignItems: 'center' },
  emptySearchTxt: { textAlign: 'center', color: '#9CA3AF', marginTop: 30, fontSize: 14 }
});
