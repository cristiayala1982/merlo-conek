import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Keyboard
} from 'react-native';
import { db, auth } from '../../firebaseConfig';
import { doc, onSnapshot, collection, query as fireQuery, where, getDocs } from 'firebase/firestore';

export default function SelectorMenciones({ query, onSelect, onClose }) {
  const [amigos, setAmigos] = useState([]);
  const [filtrados, setFiltrados] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Al abrir el selector de menciones, ocultamos el teclado para liberar toda la pantalla
    Keyboard.dismiss();
  }, []);

  useEffect(() => {
    const miUid = auth.currentUser?.uid;
    if (!miUid) return;

    const unsub = onSnapshot(doc(db, 'usuarios', miUid), async (snap) => {
      if (snap.exists()) {
        const siguiendo = snap.data().siguiendo || [];
        if (siguiendo.length > 0) {
          // Buscamos los perfiles de los amigos en lotes de 10
          const q = fireQuery(collection(db, 'usuarios'), where('__name__', 'in', siguiendo.slice(0, 10)));
          const friendsSnap = await getDocs(q);
          const friendsList = friendsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setAmigos(friendsList);
        } else {
          setAmigos([]);
        }
        setCargando(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!query) {
      setFiltrados(amigos);
      return;
    }
    const qLower = query.toLowerCase();
    setFiltrados(amigos.filter(u => u.nombre?.toLowerCase().includes(qLower)));
  }, [query, amigos]);

  if (filtrados.length === 0 && !cargando) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mencionar amigo</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close-circle" size={20} color="#999" />
        </TouchableOpacity>
      </View>
      {cargando ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#FF6600" />
        </View>
      ) : (
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {filtrados.map((item) => (
            <TouchableOpacity key={item.id} style={styles.usuarioItem} onPress={() => onSelect(item)}>
              <Image
                source={{ uri: item.fotoUrl || 'https://picsum.photos/100' }}
                style={styles.avatar}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              <View>
                <Text style={styles.nombre}>{item.nombre}</Text>
                <Text style={styles.subtitulo}>Amigo</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 420, // Agrandado a 420px para ver hasta 8 amigos sin obstrucciones
    backgroundColor: 'white',
    borderRadius: 18,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },
  usuarioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 14, // Más espacio para tocar fácil
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 15,
    backgroundColor: '#F3F4F6',
  },
  nombre: {
    fontSize: 15, // Letra más clara
    fontWeight: '700',
    color: '#111827',
  },
  subtitulo: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
});
