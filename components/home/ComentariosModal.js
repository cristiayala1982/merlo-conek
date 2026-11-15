import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';
import { crearNotificacion, enviarReporte, obtenerPerfilUsuario } from '../../services/firebaseService';
import { censurarTexto } from '../../utils/profanityFilter';
import SelectorMenciones from '../menciones/SelectorMenciones';
import SelectorOpcionesModal from '../reportes/SelectorOpcionesModal';
import SelectorReporteModal from '../reportes/SelectorReporteModal';

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
  graphiteSoft: '#9CA3AF',
  line: '#E5E7EB',
  bgSoft: '#F9FAFB',
};

const RenderHeart = ({ item, postId, loLikee, collectionName }) => {
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

    const docRef = doc(db, collectionName, postId, 'comentarios', item.id);
    await updateDoc(docRef, {
      likes: loLikee ? arrayRemove(miId) : arrayUnion(miId),
    });

    if (!loLikee) {
      await crearNotificacion({
        paraUserId: item.userId,
        tipo: 'like_comentario',
        postId: postId,
        comentarioId: item.id,
        collectionName,
        texto: 'le gusta tu comentario'
      });
    }
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

// --- FUNCIÓN GLOBAL PARA RENDERIZAR MENCIONES EN NEGRITA ---
const renderTextoConMenciones = (textoInput) => {
  if (!textoInput) return null;
  const regex = /(@\w+)/g;
  const partes = textoInput.split(regex);
  return partes.map((part, index) => {
    if (part.match(regex)) {
      return <Text key={index} style={{ fontWeight: '900', color: '#4B5563' }}>{part}</Text>; // Grafito intenso
    }
    return part;
  });
};

const ComentarioItem = React.memo(({ item, expanded, onToggleExpand, onReply, onLongPress, highlightId, irAlPerfil, collectionName, postId, hiddenComments }) => {
  if (hiddenComments.includes(item.id)) return null;

  const miId = auth.currentUser?.uid;
  const loLikee = item.likes?.includes(miId);

  const renderComentario = (c, isReply = false) => {
    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onLongPress={() => onLongPress(c)}
        style={[isReply ? styles.filaRespuesta : styles.contenedorComentarioPadre, { alignItems: 'flex-start' }]}
      >
        {isReply && (
          <>
            <View style={styles.lineaGrisOscura} />
            <View style={styles.lineaHorizontalConector} />
          </>
        )}

        <TouchableOpacity onPress={() => irAlPerfil(c.userId)}>
          <Image
            source={{
              uri: c.userPhoto || `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(c.userId || 'user')}`,
            }}
            style={isReply ? styles.avatarRespuesta : styles.avatarComentario}
          />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={[styles.globoComentario, highlightId === c.id && styles.globoTarget]}>
            <TouchableOpacity style={styles.filaMeta} onPress={() => irAlPerfil(c.userId)}>
              <Text style={styles.nombreComentario} maxFontSizeMultiplier={1.3} numberOfLines={1}>{c.userName || 'Usuario'}</Text>
              <Text style={styles.txtHora} maxFontSizeMultiplier={1.3}>{formatTime(c.createdAt)}</Text>
            </TouchableOpacity>
            <Text style={styles.textoComentario} maxFontSizeMultiplier={1.35}>{renderTextoConMenciones(c.texto)}</Text>
          </View>

          <View style={styles.accionesComentario}>
            <RenderHeart item={c} postId={postId} loLikee={!!c.likes?.includes(miId)} collectionName={collectionName} />
            <TouchableOpacity
              onPress={() => onReply(c)}
            >
              <Text style={styles.txtAccion} maxFontSizeMultiplier={1.3}>Responder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ marginBottom: 15 }}>
      {renderComentario(item)}
      {item.respuestas?.length > 0 && !expanded ? (
        <TouchableOpacity onPress={onToggleExpand} style={styles.btnVerRespuestas}>
          <View style={styles.lineaGrisCorta} /><Text style={styles.txtVerRespuestas}>Ver {item.respuestas.length} respuestas</Text>
        </TouchableOpacity>
      ) : null}
      {expanded ? (
        <>
          {item.respuestas.map((resp) => (<View key={resp.id}>{renderComentario(resp, true)}</View>))}
          <TouchableOpacity onPress={onToggleExpand} style={[styles.btnVerRespuestas, { marginTop: 5 }]}>
            <View style={styles.lineaGrisCorta} /><Text style={styles.txtVerRespuestas}>Ocultar respuestas</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
});

export default function ComentariosModal({ visible, onClose, post, targetCommentId, collectionName = 'posts' }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const inputRef = useRef(null);
  const flatListRef = useRef(null);
  const [comentario, setComentario] = useState('');
  const [listaComentarios, setListaComentarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedThreads, setExpandedThreads] = useState({});
  const [hiddenComments, setHiddenComments] = useState([]);
  const [miPerfil, setMiPerfil] = useState(null);
  const [queryMencion, setQueryMencion] = useState(null);
  const [cursorPos, setCursorPos] = useState(0);
  const [highlightId, setHighlightId] = useState(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [idParaScroll, setIdParaScroll] = useState(null);
  const [mostrarReporteModal, setMostrarReporteModal] = useState(false);
  const [comentarioSeleccionado, setComentarioSeleccionado] = useState(null);
  const [mostrarOpcionesModal, setMostrarOpcionesModal] = useState(false);

  const postId = post?.id || post?.postId;

  // Resetear el scroll cuando se cierra el modal
  useEffect(() => {
    if (!visible) {
      setHasScrolled(false);
      setHighlightId(null);
      setIdParaScroll(null);
    } else if (targetCommentId) {
      setIdParaScroll(targetCommentId);
    }
  }, [visible, targetCommentId]);

  // Lógica para resaltar (azul)
  useEffect(() => {
    if (visible && idParaScroll) {
      setHighlightId(idParaScroll);
      const timer = setTimeout(() => setHighlightId(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [visible, idParaScroll]);

  // Lógica para hacer scroll automático
  useEffect(() => {
    if (!visible || !idParaScroll || estructurados.length === 0 || hasScrolled) return;

    const existe = listaComentarios.some(c => c.id === idParaScroll);
    if (!existe) return;

    let index = estructurados.findIndex(c => c.id === idParaScroll);
    let esRespuesta = false;

    if (index === -1) {
      index = estructurados.findIndex(p => p.respuestas?.some(r => r.id === idParaScroll));
      if (index !== -1) {
        esRespuesta = true;
        const padreId = estructurados[index].id;
        if (!expandedThreads[padreId]) {
          setExpandedThreads(prev => ({ ...prev, [padreId]: true }));
          return;
        }
      }
    }

    if (index !== -1) {
      setHasScrolled(true);
      const delay = esRespuesta ? 600 : 250;
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.2
        });
      }, delay);
    }
  }, [visible, idParaScroll, estructurados, listaComentarios, hasScrolled, expandedThreads]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (uid) obtenerPerfilUsuario(uid, setMiPerfil);
  }, []);

  useEffect(() => {
    if (!postId || !visible) {
      setListaComentarios([]);
      return;
    }

    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setShowEmojiPicker(false);
      // Ajustamos a 48px de margen extra en Android para que quede perfecto
      setKeyboardHeight(e.endCoordinates.height + (Platform.OS === 'android' ? 48 : 0));
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      if (!showEmojiPicker) setKeyboardHeight(0);
    });

    const q = query(collection(db, collectionName, postId, 'comentarios'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setListaComentarios(data);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      unsubscribe();
    };
  }, [postId, visible, showEmojiPicker, collectionName]);

  useEffect(() => {
    if (!visible) {
      setListaComentarios([]);
      setComentario('');
      setReplyingTo(null);
      setExpandedThreads({});
      setHiddenComments([]);
      setShowEmojiPicker(false);
      setKeyboardHeight(0);
      setComentarioSeleccionado(null);
    }
  }, [visible]);

  const confirmarEliminar = async (item) => {
    if (!item?.id || !postId) return;

    try {
      const comentariosRef = collection(db, collectionName, postId, 'comentarios');
      const postRef = doc(db, collectionName, postId);

      if (item.parentId) {
        const batch = writeBatch(db);
        batch.delete(doc(db, collectionName, postId, 'comentarios', item.id));
        batch.update(postRef, { comentariosCount: increment(-1) });
        await batch.commit();
        return;
      }

      const repliesQuery = query(comentariosRef, where('parentId', '==', item.id));
      const repliesSnapshot = await getDocs(repliesQuery);
      const cantidadAEliminar = 1 + repliesSnapshot.size;

      const batch = writeBatch(db);
      batch.delete(doc(db, collectionName, postId, 'comentarios', item.id));
      repliesSnapshot.forEach((replyDoc) => {
        batch.delete(replyDoc.ref);
      });
      batch.update(postRef, { comentariosCount: increment(-cantidadAEliminar) });
      await batch.commit();
    } catch (e) {
      console.log('Error al eliminar comentario:', e?.message || e);
    }
  };

  const reportarComentario = async (motivo) => {
    if (!comentarioSeleccionado) return;
    try {
      await enviarReporte({
        tipo: 'comentario',
        idContenido: comentarioSeleccionado.id,
        idAutor: comentarioSeleccionado.userId,
        idPadre: postId,
        motivo: motivo,
        textoOpcional: comentarioSeleccionado.texto,
        extraData: {
          texto: comentarioSeleccionado.texto,
          collectionName,
          postTitulo: post.texto || post.titulo || ''
        }
      });
      Alert.alert('Gracias', 'Recibimos tu reporte.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo enviar el reporte.');
    }
  };

  const obtenerOpcionesComentario = () => {
    if (!comentarioSeleccionado) return [];
    const miId = auth.currentUser?.uid;
    const esMio = comentarioSeleccionado.userId === miId;

    if (esMio) {
      return [
        {
          label: 'Eliminar comentario',
          icon: 'trash-outline',
          color: '#EF4444',
          onPress: () => {
            setMostrarOpcionesModal(false);
            confirmarEliminar(comentarioSeleccionado);
          }
        }
      ];
    } else {
      return [
        {
          label: 'Reportar comentario',
          icon: 'flag-outline',
          color: '#EF4444',
          onPress: () => {
            setMostrarOpcionesModal(false);
            setMostrarReporteModal(true);
          }
        },
        {
          label: 'Ocultar comentario',
          icon: 'eye-off-outline',
          color: '#374151',
          onPress: () => {
            setMostrarOpcionesModal(false);
            setHiddenComments((prev) => [...prev, comentarioSeleccionado.id]);
          }
        }
      ];
    }
  };

  const handleLongPress = useCallback((item) => {
    setComentarioSeleccionado(item);
    setMostrarOpcionesModal(true);
  }, []);

  const handleEnviar = async () => {
    if (!comentario.trim() || !postId) return;

    const miUser = auth.currentUser;
    if (!miUser?.uid) return;

    const textoAEnviar = comentario.trim();
    const replyActual = replyingTo;

    // LIMPIEZA INSTANTÁNEA CERO MILISEGUNDOS DEL INPUT
    setComentario('');
    setReplyingTo(null);

    setCargando(true);
    try {
      const parentIdReal = replyActual?.parentId ? replyActual.parentId : replyActual ? replyActual.id : null;

      const batch = writeBatch(db);
      const comentarioRef = doc(collection(db, collectionName, postId, 'comentarios'));

      const nuevoComentario = {
        texto: censurarTexto(textoAEnviar),
        userId: miUser.uid,
        userName: miPerfil?.nombre || miUser.displayName || 'Usuario',
        userPhoto: miPerfil?.fotoUrl || miUser.photoURL || '',
        createdAt: serverTimestamp(),
        likes: [],
        parentId: parentIdReal,
      };

      batch.set(comentarioRef, nuevoComentario);
      batch.update(doc(db, collectionName, postId), { comentariosCount: increment(1) });
      await batch.commit();

      if (parentIdReal) {
        setExpandedThreads(prev => ({ ...prev, [parentIdReal]: true }));
      }

      setHasScrolled(false);
      setIdParaScroll(comentarioRef.id);

      if (post.userId !== miUser.uid) {
        await crearNotificacion({
          paraUserId: post.userId,
          tipo: 'comentario',
          postId: postId,
          comentarioId: comentarioRef.id,
          collectionName,
          texto: 'comentó tu publicación'
        });
      }

      const menciones = textoAEnviar.match(/@([^@\s]*)/g);
      if (menciones) {
        for (const m of menciones) {
          const nombreLimpio = m.replace('@', '');
          try {
            const { getDocs, query, where } = require('firebase/firestore');
            const q = query(collection(db, 'usuarios'), where('nombre', '==', nombreLimpio));
            const uSnap = await getDocs(q);
            if (!uSnap.empty) {
              const targetUid = uSnap.docs[0].id;
              if (targetUid !== miUser.uid && targetUid !== post.userId) {
                await crearNotificacion({
                  paraUserId: targetUid,
                  tipo: 'mencion',
                  postId: postId,
                  comentarioId: comentarioRef.id,
                  collectionName,
                  texto: 'te mencionó en un comentario'
                });
              }
            }
          } catch (e) { console.log("Error notif mencion:", e); }
        }
      }

      setShowEmojiPicker(false);
      setKeyboardHeight(0);
      Keyboard.dismiss();
    } catch (e) {
      console.log('Error al enviar comentario:', e?.message || e);
      setComentario(textoAEnviar);
    } finally {
      setCargando(false);
    }
  };

  const estructurados = useMemo(
    () => {
      const roots = listaComentarios.filter((c) => !c.parentId);
      return roots.map((p) => ({
        ...p,
        respuestas: listaComentarios.filter((h) => h.parentId === p.id),
      }));
    },
    [listaComentarios]
  );

  const irAlPerfil = useCallback((userId) => {
    if (!userId) return;
    onClose?.();
    if (userId === auth.currentUser?.uid) router.push('/(tabs)/perfil');
    else router.push({ pathname: '/(tabs)/perfilAjeno', params: { userId } });
  }, [onClose, router]);

  const renderComentarioItem = useCallback(({ item }) => (
    <ComentarioItem
      item={item}
      expanded={!!expandedThreads[item.id]}
      onToggleExpand={() => setExpandedThreads(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
      onReply={(c) => {
        setReplyingTo(c);
        setComentario(`@${c.userName || 'usuario'} `);
        setTimeout(() => inputRef.current?.focus(), 120);
      }}
      onLongPress={handleLongPress}
      highlightId={highlightId}
      irAlPerfil={irAlPerfil}
      collectionName={collectionName}
      postId={postId}
      hiddenComments={hiddenComments}
    />
  ), [expandedThreads, handleLongPress, highlightId, irAlPerfil, collectionName, postId, hiddenComments]);

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

        <View style={[styles.modalContent, { paddingBottom: showEmojiPicker ? 0 : keyboardHeight > 0 ? keyboardHeight : Math.max(insets.bottom, 15) }]}>
          <View style={styles.handleModal} />

          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerSideSpace} />
              <Text style={styles.titulo}>Comentarios</Text>
              <TouchableOpacity style={styles.headerCloseBtn} onPress={onClose}>
                <Ionicons name="close" size={18} color={COLORS.graphite} />
              </TouchableOpacity>
            </View>
            <View style={styles.headerBarSoft}><View style={styles.headerBarStrong} /></View>
          </View>

          <FlatList
            ref={flatListRef}
            data={estructurados}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
            keyboardShouldPersistTaps="always"
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            onScrollToIndexFailed={(info) => {
              flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.2 });
              }, 100);
            }}
            renderItem={renderComentarioItem}
          />

          <View style={styles.inputWrapper}>
            {queryMencion !== null && (
              <View style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, backgroundColor: 'white', zIndex: 1000 }}>
                <SelectorMenciones query={queryMencion} onClose={() => setQueryMencion(null)} onSelect={(user) => {
                    const textBefore = comentario.substring(0, cursorPos).replace(/@[^@\s]*$/, '');
                    const textAfter = comentario.substring(cursorPos);
                    setComentario(`${textBefore}@${user.nombre} ${textAfter}`);
                    setQueryMencion(null);
                    inputRef.current?.focus();
                  }}
                />
              </View>
            )}
            {replyingTo ? (
              <View style={styles.replyingBar}>
                <Text style={{ fontSize: 12, color: COLORS.graphiteSoft }}>Respondiendo a {replyingTo.userName || 'usuario'}</Text>
                <TouchableOpacity onPress={() => { setReplyingTo(null); setComentario(''); }}><Ionicons name="close-circle" size={18} color={COLORS.graphiteSoft} /></TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.footer}>
              <View style={styles.inputArea}>
                <View style={styles.inputBox}>
                  <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowEmojiPicker((p) => !p), 100); }} style={{ marginRight: 8 }}>
                    <Ionicons name={showEmojiPicker ? 'keypad' : 'happy-outline'} size={26} color={COLORS.graphiteSoft} />
                  </TouchableOpacity>
                  <TextInput
                    ref={inputRef}
                    style={styles.textInput}
                    placeholder="Escribir..."
                    value={comentario}
                    onChangeText={(text) => {
                      setComentario(text);
                      const match = text.match(/@([^@\s]*)$/);
                      if (match) setQueryMencion(match[1]);
                      else setQueryMencion(null);
                    }}
                    onSelectionChange={(e) => setCursorPos(e.nativeEvent.selection.start)}
                    multiline
                    onFocus={() => setShowEmojiPicker(false)}
                  />
                </View>
                <TouchableOpacity style={styles.sendBtn} onPress={handleEnviar} disabled={!comentario.trim() || cargando}>
                  {cargando ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="send" size={22} color="white" />}
                </TouchableOpacity>
              </View>
            </View>
            {showEmojiPicker ? (
              <View style={[styles.emojiContainer, { paddingBottom: Math.max(10, insets.bottom + 6) }]}>
                <FlatList data={EMOJIS_REACCIONES} numColumns={6} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.emojiListContent} keyExtractor={(_, i) => `emoji-${i}`} renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => setComentario((p) => p + item)} style={styles.emojiButton}><Text style={{ fontSize: 30 }}>{item}</Text></TouchableOpacity>
                  )}
                />
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* MODAL GLOBAL DE OPCIONES PARA COMENTARIOS */}
      <SelectorOpcionesModal
        visible={mostrarOpcionesModal}
        onClose={() => setMostrarOpcionesModal(false)}
        titulo="Opciones de comentario"
        opciones={comentarioSeleccionado ? obtenerOpcionesComentario() : []}
      />

      {/* MODAL GLOBAL DE REPORTE PARA COMENTARIOS */}
      <SelectorReporteModal
        visible={mostrarReporteModal}
        onClose={() => setMostrarReporteModal(false)}
        onReportar={(motivo) => {
          setMostrarReporteModal(false);
          if (comentarioSeleccionado) {
            reportarComentario(motivo);
          }
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', height: '85%', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  handleModal: { width: 48, height: 5, borderRadius: 999, backgroundColor: '#9CA3AF', alignSelf: 'center', marginTop: 10 },
  header: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.line, backgroundColor: '#FFFFFF' },
  headerRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSideSpace: { width: 30, height: 30 },
  headerCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.bgSoft, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  titulo: { flex: 1, textAlign: 'center', fontSize: 19, fontWeight: '800', color: COLORS.graphite, letterSpacing: 0.2 },
  headerBarSoft: { marginTop: 8, height: 3, borderRadius: 999, backgroundColor: COLORS.line, overflow: 'hidden' },
  headerBarStrong: { width: '38%', height: '100%', borderRadius: 999, backgroundColor: COLORS.orange, alignSelf: 'center' },
  contenedorComentarioPadre: { flexDirection: 'row', marginBottom: 12 },
  avatarComentario: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.line },
  nombreComentario: { fontWeight: '700', color: COLORS.graphite },
  textoComentario: { fontSize: 14, color: COLORS.graphite },
  globoComentario: { backgroundColor: COLORS.bgSoft, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, alignSelf: 'flex-start', maxWidth: '95%', flexShrink: 1 },
  globoTarget: { borderColor: '#93C5FD', borderWidth: 1.5, backgroundColor: '#F0F7FF' },
  filaMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  txtHora: { fontSize: 11, color: COLORS.graphiteSoft, marginLeft: 8, fontWeight: 'normal' },
  accionesComentario: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: 5 },
  txtAccion: { color: COLORS.orange, fontWeight: '700', fontSize: 12 },
  inputWrapper: { backgroundColor: '#FFFFFF' },
  replyingBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 5, backgroundColor: COLORS.orangeSoft },
  footer: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: COLORS.line },
  inputArea: { flexDirection: 'row', alignItems: 'center' },
  inputBox: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.bgSoft, borderWidth: 1, borderColor: COLORS.line, borderRadius: 25, paddingHorizontal: 15, alignItems: 'center', minHeight: 48 },
  textInput: { flex: 1, fontSize: 16, color: COLORS.graphite, paddingVertical: 10 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.orange, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  emojiContainer: { height: 300, backgroundColor: COLORS.bgSoft },
  emojiListContent: { paddingTop: 4, paddingBottom: 8 },
  emojiButton: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  btnVerRespuestas: { flexDirection: 'row', alignItems: 'center', marginLeft: 50, marginTop: 5 },
  lineaGrisCorta: { width: 25, height: 1, backgroundColor: COLORS.graphiteSoft, marginRight: 10 },
  txtVerRespuestas: { fontSize: 13, fontWeight: 'bold', color: COLORS.graphiteSoft },
  filaRespuesta: { flexDirection: 'row', marginBottom: 12, marginLeft: 50, position: 'relative' },
  lineaGrisOscura: { position: 'absolute', left: -25, top: -15, bottom: 20, width: 2, backgroundColor: COLORS.graphiteSoft, borderBottomLeftRadius: 10 },
  lineaHorizontalConector: {
    position: 'absolute',
    left: -25,
    top: 15, // Centrada con el avatar de 30px
    width: 15,
    height: 2,
    backgroundColor: COLORS.graphiteSoft,
  },
  avatarRespuesta: { width: 30, height: 30, borderRadius: 15, marginRight: 10, backgroundColor: COLORS.line },
  btnLike: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
  contadorLikes: { fontSize: 12, color: COLORS.graphiteSoft, marginLeft: 4, fontWeight: '600' },
});
