import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

export default function DetalleVistas({ visible, onClose, story }) {
  const [vistasDetalle, setVistasDetalle] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (visible && story) {
      cargarVistasYReacciones();
    }
  }, [visible, story]);

  const cargarVistasYReacciones = async () => {
    try {
      setCargando(true);
      const vistasIds = story.vistas ? Object.keys(story.vistas) : [];
      const reacciones = story.reacciones || {};

      // Obtenemos los perfiles de los usuarios que la vieron
      const promesas = vistasIds.map(async (uid) => {
        const uSnap = await getDoc(doc(db, 'usuarios', uid));
        if (uSnap.exists()) {
          const data = uSnap.data();
          return {
            id: uid,
            nombre: data.nombre || 'Usuario',
            foto: data.fotoUrl || null,
            reaccion: reacciones[uid] || null, // Vemos si este usuario también le dio like
            fechaVista: story.vistas[uid]
          };
        }
        return null;
      });

      const resultados = await Promise.all(promesas);
      setVistasDetalle(resultados.filter(r => r !== null));
    } catch (e) {
      console.log("Error cargando detalles historia:", e);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.content}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.titulo}>Espectadores</Text>
            <Text style={styles.subtitulo}>{vistasDetalle.length} personas han visto tu historia</Text>
          </View>

          {cargando ? (
            <ActivityIndicator color="#FF6600" style={{ marginVertical: 40 }} />
          ) : (
            <FlatList
              data={vistasDetalle}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <View style={styles.userItem}>
                  <View style={styles.avatarWrap}>
                    <Image
                      source={{ uri: item.foto || 'https://picsum.photos/100' }}
                      style={styles.avatar}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                    {item.reaccion === 'like' && (
                      <View style={styles.heartBadge}>
                        <Ionicons name="heart" size={10} color="white" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.userName}>{item.nombre}</Text>
                  {item.reaccion === 'like' && (
                    <Ionicons name="heart" size={20} color="#FF6600" />
                  )}
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="eye-off-outline" size={40} color="#CCC" />
                  <Text style={styles.emptyTxt}>Todavía nadie ha visto esta historia.</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  content: {
    backgroundColor: 'white',
    height: '60%',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#EEE',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 12
  },
  header: { marginBottom: 20 },
  titulo: { fontSize: 20, fontWeight: '900', color: '#111827' },
  subtitulo: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  list: { paddingBottom: 30 },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  avatarWrap: { position: 'relative', marginRight: 15 },
  avatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#EEE' },
  heartBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FF6600',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center'
  },
  userName: { flex: 1, fontSize: 16, fontWeight: '700', color: '#374151' },
  empty: { alignItems: 'center', marginTop: 50 },
  emptyTxt: { color: '#9CA3AF', marginTop: 10, fontSize: 14 }
});
