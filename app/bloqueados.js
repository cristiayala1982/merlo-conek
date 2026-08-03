import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { desbloquearUsuario } from '../services/firebaseService';

export default function BloqueadosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bloqueadosIds, setBloqueadosIds] = useState([]);
  const [usuariosBloqueados, setUsuariosBloqueados] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const miUid = auth.currentUser?.uid;
    if (!miUid) return;

    // Escuchamos cambios en nuestra lista de bloqueados
    const unsub = onSnapshot(doc(db, 'usuarios', miUid), async (snap) => {
      if (snap.exists()) {
        const ids = snap.data().bloqueados || [];
        setBloqueadosIds(ids);

        // Cargamos los perfiles de esos usuarios
        const perfiles = await Promise.all(
          ids.map(async (id) => {
            const uSnap = await getDoc(doc(db, 'usuarios', id));
            return uSnap.exists() ? { id: uSnap.id, ...uSnap.data() } : null;
          })
        );
        setUsuariosBloqueados(perfiles.filter(u => u !== null));
      }
      setCargando(false);
    });

    return () => unsub();
  }, []);

  const handleDesbloquear = (usuario) => {
    Alert.alert(
      'Desbloquear usuario',
      `¿Quieres desbloquear a ${usuario.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desbloquear',
          onPress: async () => {
            try {
              await desbloquearUsuario(usuario.id);
            } catch (e) {
              Alert.alert('Error', 'No se pudo desbloquear al usuario.');
            }
          }
        }
      ]
    );
  };

  const renderUsuario = ({ item }) => (
    <View style={styles.item}>
      <Image
        source={{ uri: item.fotoUrl || 'https://picsum.photos/100' }}
        style={styles.avatar}
      />
      <View style={styles.info}>
        <Text style={styles.nombre}>{item.nombre}</Text>
      </View>
      <TouchableOpacity
        style={styles.desbloquearBtn}
        onPress={() => handleDesbloquear(item)}
      >
        <Text style={styles.desbloquearTxt}>Desbloquear</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Usuarios Bloqueados</Text>
        <View style={{ width: 40 }} />
      </View>

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF6600" />
        </View>
      ) : usuariosBloqueados.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="shield-checkmark-outline" size={60} color="#CCC" />
          <Text style={styles.emptyTxt}>No tienes usuarios bloqueados.</Text>
        </View>
      ) : (
        <FlatList
          data={usuariosBloqueados}
          keyExtractor={(item) => item.id}
          renderItem={renderUsuario}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE'
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  backBtn: { padding: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  list: { padding: 15 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6'
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EEE' },
  info: { flex: 1, marginLeft: 15 },
  nombre: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  desbloquearBtn: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FF6600',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  desbloquearTxt: { color: '#FF6600', fontSize: 13, fontWeight: '700' },
  emptyTxt: { marginTop: 15, color: '#6B7280', textAlign: 'center' }
});
