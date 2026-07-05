import { Ionicons } from '@expo/vector-icons';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';

const EMOJIS_REACCIONES = [
  '😊', '😂', '❤️', '👍', '🙏', '🔥', '😮', '😢', '🙌', '✨', '😎', '✅',
  '🤩', '🤔', '💪', '🎉', '😡', '😴', '💬', '📍', '⭐', '🎈', '🎨', '🚀',
  '😍', '😭', '😱', '🤫', '🤝', '🍕', '🍻', '🌈', '☀', '💯', '💥', '🏃',
];

const COLORS = {
  orange: '#F97316',
  orangeSoft: '#FFF7ED',
  orangeBorder: '#FDBA74',
  graphite: '#1F2937',
  graphiteSoft: '#6B7280',
  line: '#E5E7EB',
  bgSoft: '#F9FAFB',
};

const RenderHeart = ({ item, postId, loLikee }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleLike = async () => {
    const miId = auth.currentUser?.uid;
    if (!miId) return;

    if (!loLikee) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.5, duration: 100, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]).start();
    }

    const docRef = doc(db, 'posts', postId, 'comentarios', item.id);
    await updateDoc(docRef, {
      likes: loLikee ? arrayRemove(miId) : arrayUnion(miId),
    });
  };

  return (
    <TouchableOpacity onPress={handleLike} style={styles.btnLike}>
      <Animated.View style={{ transform: [{ scale: loLikee ? scaleAnim : 1 }] }}>
        <Ionicons name={loLikee ? 'heart' : 'heart-outline'} size={16} color={loLikee ? COLORS.orange : COLORS.graphiteSoft} />
      </Animated.View>
      {item.likes?.length > 0 ? (
        <Text style={[styles.contadorLikes, loLikee && { color: COLORS.orange }]}>{item.likes.length}</Text>
      ) : null}
    </TouchableOpacity>
  );
};

const formatTime = (timestamp) => {
  if (!timestamp) return 'ahora';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return `${Math.max(diff, 1)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

export default function ComentariosModal({ visible, onClose, post }) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);
  const [comentario, setComentario] = useState('');
  const [listaComentarios, setListaComentarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedThreads, setExpandedThreads] = useState({});
  const [hiddenComments, setHiddenComments] = useState([]);

  const postId = post?.id || post?.postId;

  useEffect(() => {
    if (!postId || !visible) return;

    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setShowEmojiPicker(false);
      setKeyboardHeight(e.endCoordinates.height + (Platform.OS === 'android' ? 45 : 0));
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      if (!showEmojiPicker) setKeyboardHeight(0);
    });

    const q = query(collection(db, 'posts', postId, 'comentarios'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setListaComentarios(data);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      unsubscribe();
    };
  }, [postId, visible, showEmojiPicker]);

  useEffect(() => {
    if (!visible) {
      setComentario('');
      setReplyingTo(null);
      setExpandedThreads({});
      setHiddenComments([]);
      setShowEmojiPicker(false);
      setKeyboardHeight(0);
    }
  }, [visible]);

  const confirmarEliminar = async (item) => {
    if (!item?.id || !postId) return;

    try {
      const comentariosRef = collection(db, 'posts', postId, 'comentarios');
      const postRef = doc(db, 'posts', postId);

      if (item.parentId) {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'posts', postId, 'comentarios', item.id));
        batch.update(postRef, { comentariosCount: increment(-1) });
        await batch.commit();
        return;
      }

      const repliesQuery = query(comentariosRef, where('parentId', '==', item.id));
      const repliesSnapshot = await getDocs(repliesQuery);
      const cantidadAEliminar = 1 + repliesSnapshot.size;

      const batch = writeBatch(db);
      batch.delete(doc(db, 'posts', postId, 'comentarios', item.id));
      repliesSnapshot.forEach((replyDoc) => {
        batch.delete(replyDoc.ref);
      });
      batch.update(postRef, { comentariosCount: increment(-cantidadAEliminar) });
      await batch.commit();
    } catch (e) {
      console.log('Error al eliminar comentario:', e?.message || e);
    }
  };

  const handleLongPress = (item) => {
    const miId = auth.currentUser?.uid;
    const esMio = item.userId === miId;

    const reportarComentario = async () => {
      try {
        await addDoc(collection(db, 'reportes'), {
          tipo: 'comentario',
          postId,
          comentarioId: item.id,
          comentarioUserId: item.userId || null,
          reporterId: miId || null,
          motivo: 'contenido-inapropiado',
          createdAt: serverTimestamp(),
        });
        Alert.alert('Gracias', 'Recibimos tu reporte.');
      } catch (e) {
        Alert.alert('Error', e?.message || 'No se pudo enviar el reporte.');
      }
    };

    Alert.alert(esMio ? 'Tu comentario' : 'Opciones', 'Que deseas hacer?', [
      { text: 'Cancelar', style: 'cancel' },
      ...(esMio
        ? [{ text: 'Eliminar', style: 'destructive', onPress: () => confirmarEliminar(item) }]
        : [
            { text: 'Reportar', style: 'destructive', onPress: reportarComentario },
            { text: 'Ocultar', onPress: () => setHiddenComments((prev) => [...prev, item.id]) },
          ]),
    ]);
  };

  const handleEnviar = async () => {
    if (!comentario.trim() || !postId) return;

    const miUser = auth.currentUser;
    if (!miUser?.uid) return;

    setCargando(true);
    try {
      const parentIdReal = replyingTo?.parentId ? replyingTo.parentId : replyingTo ? replyingTo.id : null;

      const batch = writeBatch(db);
      const comentarioRef = doc(collection(db, 'posts', postId, 'comentarios'));

      batch.set(comentarioRef, {
        texto: comentario.trim(),
        userId: miUser.uid,
        userName: miUser.displayName || 'Usuario',
        userPhoto: miUser.photoURL || '',
        createdAt: serverTimestamp(),
        likes: [],
        parentId: parentIdReal,
      });

      batch.update(doc(db, 'posts', postId), { comentariosCount: increment(1) });
      await batch.commit();

      setComentario('');
      setReplyingTo(null);
      setShowEmojiPicker(false);
      setKeyboardHeight(0);
      Keyboard.dismiss();
    } catch (e) {
      console.log('Error al enviar comentario:', e?.message || e);
    } finally {
      setCargando(false);
    }
  };

  const estructurados = useMemo(
    () =>
      listaComentarios
        .filter((c) => !c.parentId)
        .map((p) => ({
          ...p,
          respuestas: listaComentarios.filter((h) => h.parentId === p.id),
        })),
    [listaComentarios]
  );

  const renderComentario = (item, isReply = false) => {
    if (hiddenComments.includes(item.id)) return null;

    const miId = auth.currentUser?.uid;
    const loLikee = item.likes?.includes(miId);

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onLongPress={() => handleLongPress(item)}
        style={[isReply ? styles.filaRespuesta : styles.contenedorComentarioPadre, { alignItems: 'flex-start' }]}
      >
        {isReply ? <View style={styles.lineaGrisOscura} /> : null}

        <Image
          source={{
            uri:
              item.userPhoto ||
              `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(item.userId || 'user')}`,
          }}
          style={isReply ? styles.avatarRespuesta : styles.avatarComentario}
        />

        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={styles.globoComentario}>
            <View style={styles.filaMeta}>
              <Text style={styles.nombreComentario}>{item.userName || 'Usuario'}</Text>
              <Text style={styles.txtHora}>{formatTime(item.createdAt)}</Text>
            </View>
            <Text style={styles.textoComentario}>{item.texto}</Text>
          </View>

          <View style={styles.accionesComentario}>
            <RenderHeart item={item} postId={postId} loLikee={!!loLikee} />
            <TouchableOpacity
              onPress={() => {
                setReplyingTo(item);
                setComentario(`@${item.userName || 'usuario'} `);
                setTimeout(() => inputRef.current?.focus(), 120);
              }}
            >
              <Text style={styles.txtAccion}>Responder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => (showEmojiPicker ? setShowEmojiPicker(false) : onClose?.())}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />

        <View style={[styles.modalContent, { paddingBottom: showEmojiPicker ? 0 : keyboardHeight > 0 ? keyboardHeight : 45 }]}>
          <View style={styles.handleModal} />

          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerSideSpace} />
              <Text style={styles.titulo}>Comentarios</Text>
              <TouchableOpacity style={styles.headerCloseBtn} onPress={onClose}>
                <Ionicons name="close" size={18} color={COLORS.graphite} />
              </TouchableOpacity>
            </View>

            <View style={styles.headerBarSoft}>
              <View style={styles.headerBarStrong} />
            </View>
          </View>

          <FlatList
            data={estructurados}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
            onScrollToIndexFailed={() => {}}
            renderItem={({ item }) => (
              <View style={{ marginBottom: 15 }}>
                {renderComentario(item)}

                {item.respuestas?.length > 0 && !expandedThreads[item.id] ? (
                  <TouchableOpacity
                    onPress={() => setExpandedThreads((p) => ({ ...p, [item.id]: true }))}
                    style={styles.btnVerRespuestas}
                  >
                    <View style={styles.lineaGrisCorta} />
                    <Text style={styles.txtVerRespuestas}>Ver {item.respuestas.length} respuestas</Text>
                  </TouchableOpacity>
                ) : null}

                {expandedThreads[item.id] ? (
                  <>
                    {item.respuestas.map((resp) => (
                      <View key={resp.id}>{renderComentario(resp, true)}</View>
                    ))}
                    <TouchableOpacity
                      onPress={() => setExpandedThreads((p) => ({ ...p, [item.id]: false }))}
                      style={[styles.btnVerRespuestas, { marginTop: 5 }]}
                    >
                      <View style={styles.lineaGrisCorta} />
                      <Text style={styles.txtVerRespuestas}>Ocultar respuestas</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            )}
          />

          <View style={styles.inputWrapper}>
            {replyingTo ? (
              <View style={styles.replyingBar}>
                <Text style={{ fontSize: 12, color: COLORS.graphiteSoft }}>Respondiendo a {replyingTo.userName || 'usuario'}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setReplyingTo(null);
                    setComentario('');
                  }}
                >
                  <Ionicons name="close-circle" size={18} color={COLORS.graphiteSoft} />
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.footer}>
              <View style={styles.inputArea}>
                <View style={styles.inputBox}>
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setTimeout(() => setShowEmojiPicker((p) => !p), 100);
                    }}
                    style={{ marginRight: 8 }}
                  >
                    <Ionicons name={showEmojiPicker ? 'keypad' : 'happy-outline'} size={26} color={COLORS.graphiteSoft} />
                  </TouchableOpacity>
                  <TextInput
                    ref={inputRef}
                    style={styles.textInput}
                    placeholder="Escribir..."
                    value={comentario}
                    onChangeText={setComentario}
                    multiline
                    onFocus={() => setShowEmojiPicker(false)}
                  />
                </View>

                <TouchableOpacity style={styles.sendBtn} onPress={handleEnviar} disabled={!comentario.trim() || cargando}>
                  {cargando ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Ionicons name="send" size={22} color="white" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {showEmojiPicker ? (
              <View style={[styles.emojiContainer, { paddingBottom: Math.max(10, insets.bottom + 6) }]}>
                <FlatList
                  data={EMOJIS_REACCIONES}
                  numColumns={6}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.emojiListContent}
                  keyExtractor={(_, i) => `emoji-${i}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => setComentario((p) => p + item)} style={styles.emojiButton}>
                      <Text style={{ fontSize: 30 }}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF',
    height: '85%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  handleModal: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#9CA3AF',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSideSpace: {
    width: 30,
    height: 30,
  },
  headerCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.bgSoft,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    flex: 1,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.graphite,
    letterSpacing: 0.2,
  },
  headerBarSoft: {
    marginTop: 8,
    height: 3,
    borderRadius: 999,
    backgroundColor: COLORS.line,
    overflow: 'hidden',
  },
  headerBarStrong: {
    width: '38%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.orange,
    alignSelf: 'center',
  },
  contenedorComentarioPadre: { flexDirection: 'row', marginBottom: 12 },
  avatarComentario: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.line },
  nombreComentario: { fontWeight: '700', color: COLORS.graphite },
  textoComentario: { fontSize: 14, color: COLORS.graphite, lineHeight: 19 },
  globoComentario: {
    backgroundColor: COLORS.bgSoft,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  filaMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  txtHora: { fontSize: 11, color: COLORS.graphiteSoft, marginLeft: 8, fontWeight: 'normal' },
  accionesComentario: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: 5 },
  txtAccion: { color: COLORS.orange, fontWeight: '700', fontSize: 12 },
  inputWrapper: { backgroundColor: '#FFFFFF' },
  replyingBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 5,
    backgroundColor: COLORS.orangeSoft,
  },
  footer: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: COLORS.line },
  inputArea: { flexDirection: 'row', alignItems: 'center' },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.bgSoft,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 25,
    paddingHorizontal: 15,
    alignItems: 'center',
    minHeight: 48,
  },
  textInput: { flex: 1, fontSize: 16, color: COLORS.graphite, paddingVertical: 10 },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.orange,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  emojiContainer: { height: 300, backgroundColor: COLORS.bgSoft },
  emojiListContent: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  emojiButton: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  btnVerRespuestas: { flexDirection: 'row', alignItems: 'center', marginLeft: 50, marginTop: 5 },
  lineaGrisCorta: { width: 25, height: 1, backgroundColor: COLORS.graphiteSoft, marginRight: 10 },
  txtVerRespuestas: { fontSize: 13, fontWeight: 'bold', color: COLORS.graphiteSoft },
  filaRespuesta: { flexDirection: 'row', marginBottom: 12, marginLeft: 50, position: 'relative' },
  lineaGrisOscura: {
    position: 'absolute',
    left: -25,
    top: -15,
    bottom: 20,
    width: 2,
    backgroundColor: COLORS.graphiteSoft,
    borderBottomLeftRadius: 10,
  },
  avatarRespuesta: { width: 30, height: 30, borderRadius: 15, marginRight: 10, backgroundColor: COLORS.line },
  btnLike: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
  contadorLikes: { fontSize: 12, color: COLORS.graphiteSoft, marginLeft: 4, fontWeight: '600' },
});