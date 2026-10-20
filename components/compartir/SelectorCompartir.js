import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, increment, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

/**
 * Componente para compartir contenido internamente en los chats de la app.
 * @param visible - Si el modal se muestra
 * @param onClose - Función para cerrar el modal
 * @param contenido - Objeto con la info a compartir { id, tipo, titulo, imagen, subTitulo }
 */
export default function SelectorCompartir({ visible, onClose, contenido }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enviandoId, setEnviandoId] = useState(null); // Para mostrar carga en el botón individual

  useEffect(() => {
    const miUid = auth.currentUser?.uid;
    if (!miUid || !visible) return;

    // Buscamos chats recientes donde participo
    const q = query(
      collection(db, 'chats'),
      where('participantes', 'array-contains', miUid),
      orderBy('fechaUltimoMensaje', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setChats(data);
      setLoading(false);
    });

    return () => unsub();
  }, [visible]);

  const handleCompartir = async (chat) => {
    if (!contenido || enviandoId) return;

    setEnviandoId(chat.id);
    const miUid = auth.currentUser?.uid;
    const otroId = chat.participantes.find(id => id !== miUid);

    try {
      // Creamos el mensaje especial de compartido
      const msgData = {
        chatId: chat.id,
        userId: miUid,
        user: auth.currentUser.displayName || 'Usuario',
        createdAt: serverTimestamp(),
        leido: false,
        tipo: 'compartido',
        compartidoData: {
          id: contenido.id,
          tipo: contenido.tipo, // 'perfil', 'post', 'market'
          titulo: contenido.titulo,
          imagen: contenido.imagen || null,
          subTitulo: contenido.subTitulo || ''
        }
      };

      await addDoc(collection(db, 'mensajes_chat'), msgData);

      // Actualizamos la metadata del chat para que aparezca arriba
      let textoNotif = `Te envió un ${contenido.tipo === 'perfil' ? 'perfil' : 'contenido'}`;
      await updateDoc(doc(db, 'chats', chat.id), {
        ultimoMensaje: textoNotif,
        fechaUltimoMensaje: serverTimestamp(),
        [`${otroId}.unreadCount`]: increment(1)
      });

      // Cerramos después de un delay sutil para que vea el check
      setTimeout(() => {
        setEnviandoId(null);
        onClose();
      }, 500);

    } catch (e) {
      console.error("Error al compartir:", e);
      setEnviandoId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <View style={styles.handle} />
            <Text style={styles.title}>Enviar a...</Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#FF6600" size="large" style={{ margin: 40 }} />
          ) : (
            <FlatList
              data={chats}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <Text style={styles.empty}>No tienes chats abiertos todavía.</Text>
              }
              renderItem={({ item }) => {
                const miUid = auth.currentUser?.uid;
                const otroId = item.participantes.find(id => id !== miUid);
                const otroInfo = item[otroId] || {};

                return (
                  <View style={styles.chatItem}>
                    <Image
                      source={{ uri: otroInfo.foto || 'https://picsum.photos/100' }}
                      style={styles.avatar}
                    />
                    <Text style={styles.nombre} numberOfLines={1}>{otroInfo.nombre || 'Usuario'}</Text>

                    <TouchableOpacity
                      style={[styles.btnEnviar, enviandoId === item.id && styles.btnEnviando]}
                      onPress={() => handleCompartir(item)}
                      disabled={enviandoId !== null}
                    >
                      {enviandoId === item.id ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Text style={styles.btnText}>Enviar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '70%',
    paddingBottom: 20
  },
  header: { alignItems: 'center', paddingVertical: 15 },
  handle: { width: 40, height: 5, backgroundColor: '#DDD', borderRadius: 10, marginBottom: 10 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  list: { paddingHorizontal: 20 },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  avatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#EEE' },
  nombre: { flex: 1, marginLeft: 15, fontSize: 16, fontWeight: '600', color: '#1F2937' },
  btnEnviar: {
    backgroundColor: '#FF6600',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center'
  },
  btnEnviando: { backgroundColor: '#9CA3AF' },
  btnText: { color: 'white', fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 40, color: '#9CA3AF', fontSize: 15 }
});