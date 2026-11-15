import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, addDoc, serverTimestamp, increment, doc, getDocs, limit, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { repostearContenido } from '../../services/firebase/postService';
import { showToast } from '../utilidades/CustomToast';
import { Alert } from 'react-native';

export default function SelectorCompartir({ visible, onClose, contenido }) {
  const insets = useSafeAreaInsets();
  const [amigos, setAmigos] = useState([]);
  const [resultadosGlobales, setResultadosGlobales] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [buscandoGlobal, setBuscandoGlobal] = useState(false);
  const [enviandoId, setEnviandoId] = useState(null);

  const [modalRepostVisible, setModalRepostVisible] = useState(false);
  const [comentarioRepost, setComentarioRepost] = useState('');
  const [enviandoRepost, setEnviandoRepost] = useState(false);

  const handleEjecutarRepost = async () => {
    if (!contenido) return;
    try {
      setEnviandoRepost(true);
      const collectionName = contenido.collectionName || (contenido.tipo === 'alerta' ? 'alertas_comunitarias' : 'posts');
      await repostearContenido({
        postOriginal: contenido.postObjeto || contenido,
        comentario: comentarioRepost,
        collectionName
      });
      showToast("¡Compartido en tu muro!", "success");
      setComentarioRepost('');
      setModalRepostVisible(false);
      onClose();
    } catch (e) {
      console.error("Error al compartir:", e);
      Alert.alert("Error", "No se pudo compartir en tu muro.");
    } finally {
      setEnviandoRepost(false);
    }
  };

  const miUid = auth.currentUser?.uid;

  // 1. CARGAR AMIGOS (Gente que sigo)
  useEffect(() => {
    if (!miUid || !visible) return;

    const fetchAmigos = async () => {
      try {
        setLoading(true);
        const myDoc = await getDoc(doc(db, 'usuarios', miUid));
        const siguiendo = myDoc.data()?.siguiendo || [];

        if (siguiendo.length > 0) {
          const qA = query(collection(db, 'usuarios'), where('__name__', 'in', siguiendo.slice(0, 30)));
          const snapA = await getDocs(qA);
          setAmigos(snapA.docs.map(d => ({ id: d.id, ...d.data(), esAmigo: true })));
        } else {
          setAmigos([]);
        }
      } catch (e) {
        console.log("Error cargando amigos:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchAmigos();
  }, [visible, miUid]);

  // 2. BÚSQUEDA GLOBAL (No amigos)
  useEffect(() => {
    if (!busqueda.trim()) {
      setResultadosGlobales([]);
      return;
    }

    const timer = setTimeout(async () => {
      setBuscandoGlobal(true);
      try {
        const term = busqueda.toLowerCase().trim();
        const q = query(collection(db, 'usuarios'), limit(40));
        const snap = await getDocs(q);

        const lista = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => {
            const matchNombre = u.nombre?.toLowerCase().includes(term);
            const noSoyYo = u.id !== miUid;
            const noEsAmigo = !amigos.some(a => a.id === u.id);
            return matchNombre && noSoyYo && noEsAmigo;
          })
          .map(u => ({ ...u, esAmigo: false }));

        setResultadosGlobales(lista);
      } catch (e) {
        console.log("Error búsqueda global:", e);
      } finally {
        setBuscandoGlobal(false);
      }
    }, 400);

    const [modalRepostVisible, setModalRepostVisible] = useState(false);
  const [comentarioRepost, setComentarioRepost] = useState('');
  const [enviandoRepost, setEnviandoRepost] = useState(false);

  const handleEjecutarRepost = async () => {
    if (!contenido) return;
    try {
      setEnviandoRepost(true);
      const collectionName = contenido.collectionName || (contenido.tipo === 'alerta' ? 'alertas_comunitarias' : 'posts');
      await repostearContenido({
        postOriginal: contenido.postObjeto || contenido,
        comentario: comentarioRepost,
        collectionName
      });
      showToast("¡Compartido en tu muro!", "success");
      setComentarioRepost('');
      setModalRepostVisible(false);
      onClose();
    } catch (e) {
      console.error("Error al compartir:", e);
      Alert.alert("Error", "No se pudo compartir en tu muro.");
    } finally {
      setEnviandoRepost(false);
    }
  };

  return () => clearTimeout(timer);
  }, [busqueda, miUid, amigos]);

  const dataFinal = useMemo(() => {
    const term = busqueda.toLowerCase().trim();
    const amigosFiltrados = amigos.filter(a => a.nombre?.toLowerCase().includes(term));

    const result = [];
    if (amigosFiltrados.length > 0) {
      result.push({ isHeader: true, title: 'Amigos' });
      result.push(...amigosFiltrados);
    }

    if (resultadosGlobales.length > 0) {
      result.push({ isSeparator: true });
      result.push({ isHeader: true, title: 'Otros usuarios' });
      result.push(...resultadosGlobales);
    }

    return result;
  }, [amigos, resultadosGlobales, busqueda]);

  const handleCompartir = async (item) => {
    if (!contenido || enviandoId) return;
    setEnviandoId(item.id);

    try {
      const chatId = [miUid, item.id].sort().join('_');

      const miDoc = await getDoc(doc(db, 'usuarios', miUid));
      const miData = miDoc.data() || {};

      const msgData = {
        chatId,
        userId: miUid,
        user: miData.nombre || 'Usuario',
        userPhoto: miData.fotoUrl || null,
        createdAt: serverTimestamp(),
        leido: false,
        tipo: 'compartido',
        compartidoData: {
          id: contenido.id,
          tipo: contenido.tipo,
          titulo: contenido.titulo,
          imagen: contenido.imagen || null,
          subTitulo: contenido.subTitulo || ''
        }
      };

      await addDoc(collection(db, 'mensajes_chat'), msgData);

      const chatRef = doc(db, 'chats', chatId);
      const textoNotif = `Compartió un ${contenido.tipo === 'perfil' ? 'perfil' : 'contenido'}`;

      await setDoc(chatRef, {
        ultimoMensaje: textoNotif,
        ultimoMensajeDe: miUid,
        fechaUltimoMensaje: serverTimestamp(),
        participantes: [miUid, item.id],
        tipo: 'regular',
        [miUid]: {
          nombre: miData.nombre || 'Usuario',
          foto: miData.fotoUrl || null,
          eliminadoPara: false,
          unreadCount: 0
        },
        [item.id]: {
          nombre: item.nombre || 'Usuario',
          foto: item.fotoUrl || null,
          eliminadoPara: false,
          unreadCount: increment(1)
        }
      }, { merge: true });

      setTimeout(() => {
        setEnviandoId(null);
        onClose();
      }, 400);
    } catch (e) {
      console.error(e);
      setEnviandoId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.sheet, { height: '94%', paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
               <Text style={styles.title}>Compartir</Text>
               <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={28} color="#333" />
               </TouchableOpacity>
            </View>
          </View>

          {/* BOTÓN RECOMPARTIR EN MI MURO */}
          {contenido?.tipo !== 'perfil' && (
            <TouchableOpacity
              style={styles.repostBannerBtn}
              onPress={() => setModalRepostVisible(true)}
            >
              <Ionicons name="repeat" size={22} color="#FF6600" />
              <Text style={styles.repostBannerTxt}>Compartir en mi Muro</Text>
              <Ionicons name="chevron-forward" size={18} color="#FF6600" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          )}

          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#9CA3AF" style={{ marginLeft: 10 }} />
            <TextInput
              placeholder="Escribí un nombre..."
              style={styles.searchInput}
              value={busqueda}
              onChangeText={setBusqueda}
              placeholderTextColor="#9CA3AF"
            />
            {buscandoGlobal && <ActivityIndicator size="small" color="#FF6600" style={{ marginRight: 10 }} />}
          </View>

          {loading && amigos.length === 0 ? (
            <ActivityIndicator color="#FF6600" size="large" style={{ margin: 40 }} />
          ) : (
            <FlatList
              data={dataFinal}
              keyExtractor={(item, index) => item.id || `extra-${index}`}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                if (item.isHeader) {
                  return <Text style={styles.headerText}>{item.title}</Text>;
                }
                if (item.isSeparator) {
                  return <View style={styles.separator} />;
                }

                return (
                  <View style={styles.chatItem}>
                    <View style={styles.avatarWrap}>
                      <Image
                        source={{ uri: item.fotoUrl || 'https://picsum.photos/100' }}
                        style={styles.avatar}
                      />
                      {item.esAmigo && (
                        <View style={styles.amigoBadge}>
                          <Ionicons name="people" size={12} color="white" />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 15 }}>
                      <Text style={styles.nombre} numberOfLines={1}>{item.nombre || 'Usuario'}</Text>
                      <Text style={styles.tipoLabel}>{item.esAmigo ? 'Tu amigo' : 'Usuario de Conek'}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.btnEnviar, enviandoId === item.id && styles.btnEnviando]}
                      onPress={() => handleCompartir(item)}
                    >
                      {enviandoId === item.id ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.btnText}>Enviar</Text>}
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>

      <Modal visible={modalRepostVisible} transparent animationType="fade" onRequestClose={() => setModalRepostVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.repostModalOverlay}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalRepostVisible(false)} />
          <View style={styles.repostModalCard}>
            <View style={styles.repostModalHeader}>
              <Ionicons name="repeat" size={22} color="#FF6600" />
              <Text style={styles.repostModalTitle}>Compartir en tu Muro</Text>
              <TouchableOpacity onPress={() => setModalRepostVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.repostSubtitle}>Añade un comentario opcional para tus vecinos:</Text>

            <TextInput
              placeholder="¿Qué opinas sobre esto? (Opcional)..."
              style={styles.repostInput}
              value={comentarioRepost}
              onChangeText={setComentarioRepost}
              multiline
              placeholderTextColor="#9CA3AF"
            />

            <TouchableOpacity
              style={[styles.btnPublicarRepost, enviandoRepost && { opacity: 0.6 }]}
              onPress={handleEjecutarRepost}
              disabled={enviandoRepost}
            >
              {enviandoRepost ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.btnPublicarRepostTxt}>Compartir Ahora 🔁</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, width: '100%', overflow: 'hidden' },
  header: { alignItems: 'center', paddingVertical: 10 },
  handle: { width: 40, height: 5, backgroundColor: '#DDD', borderRadius: 10, marginBottom: 5 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingHorizontal: 20 },
  title: { fontSize: 18, fontWeight: '900', color: '#111827' },
  closeBtn: { position: 'absolute', right: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', marginHorizontal: 20, borderRadius: 12, height: 50, marginBottom: 10 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#1F2937' },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  headerText: { fontSize: 14, fontWeight: 'bold', color: '#9CA3AF', textTransform: 'uppercase', marginTop: 15, marginBottom: 10, letterSpacing: 0.5 },
  separator: { height: 1, backgroundColor: '#EEE', marginVertical: 10 },
  chatItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EEE' },
  amigoBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#FF6600', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white', elevation: 3 },
  nombre: { fontSize: 16, fontWeight: '800', color: '#111827' },
  tipoLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  btnEnviar: { backgroundColor: '#FF6600', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  btnEnviando: { backgroundColor: '#9CA3AF' },
  btnText: { color: 'white', fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 40, color: '#9CA3AF', fontSize: 15 },
  repostBannerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FFEDD5', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, marginHorizontal: 15, marginBottom: 10, gap: 10 },
  repostBannerTxt: { fontSize: 15, fontWeight: '700', color: '#FF6600' },
  repostModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  repostModalCard: { backgroundColor: '#FFFFFF', borderRadius: 20, width: '100%', padding: 20, elevation: 5 },
  repostModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  repostModalTitle: { fontSize: 17, fontWeight: '800', color: '#111827', flex: 1, marginLeft: 8 },
  repostSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  repostInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, color: '#111827', minHeight: 80, textAlignVertical: 'top', marginBottom: 15 },
  btnPublicarRepost: { backgroundColor: '#FF6600', borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnPublicarRepostTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' }
});