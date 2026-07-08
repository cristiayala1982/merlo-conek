import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebaseConfig';
import { buscarUsuarios, dejarDeSeguirUsuario, obtenerPerfilUsuario, seguirUsuario } from '../../services/firebaseService';

export default function AmigosModal({ visible, onClose }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [miPerfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('sugerencias'); // 'amigos' o 'sugerencias'

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // 1. Escuchar mi propio perfil para saber a quién sigo
    const unsubPerfil = obtenerPerfilUsuario(uid, (data) => {
      setPerfil(data);
    });

    // 2. Buscar usuarios (sugerencias o búsqueda)
    const unsubUsuarios = buscarUsuarios(busqueda, (lista) => {
      setUsuarios(lista);
      setCargando(false);
    });

    return () => {
      unsubPerfil();
      unsubUsuarios();
    };
  }, [busqueda]);

  const loSigo = (uid) => {
    return miPerfil?.siguiendo?.includes(uid);
  };

  const listaFiltrada = usuarios.filter(u => {
    if (tab === 'amigos') return loSigo(u.id);
    return true; // Sugerencias muestra todos (excepto yo, filtrado en el service)
  });

  const handleSeguir = async (uid) => {
    try {
      if (loSigo(uid)) {
        await dejarDeSeguirUsuario(uid);
      } else {
        await seguirUsuario(uid);
      }
    } catch (e) {
      console.log('Error al seguir/dejar de seguir:', e);
    }
  };

  const irAPerfil = (uid) => {
    onClose();
    router.push({
        pathname: '/(tabs)/perfilAjeno',
        params: { userId: uid }
    });
  };

  const renderUsuario = ({ item }) => (
    <View style={styles.userCard}>
      <TouchableOpacity style={styles.userInfo} onPress={() => irAPerfil(item.id)}>
        <Image
          source={{ uri: item.fotoUrl || 'https://picsum.photos/100/100' }}
          style={styles.avatar}
        />
        <View>
          <Text style={styles.userName}>{item.nombre || 'Usuario'}</Text>
          <Text style={styles.userBio} numberOfLines={1}>{item.bio || 'Sin biografía'}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, loSigo(item.id) && styles.actionBtnActive]}
        onPress={() => handleSeguir(item.id)}
      >
        <Text style={[styles.actionBtnTxt, loSigo(item.id) && styles.actionBtnTxtActive]}>
          {loSigo(item.id) ? 'Siguiendo' : 'Seguir'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Cabecera */}
        <View style={styles.header}>
          <Text style={styles.title}>Amigos</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Buscador */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'sugerencias' && styles.tabActive]}
            onPress={() => setTab('sugerencias')}
          >
            <Text style={[styles.tabTxt, tab === 'sugerencias' && styles.tabTxtActive]}>Sugerencias</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'amigos' && styles.tabActive]}
            onPress={() => setTab('amigos')}
          >
            <Text style={[styles.tabTxt, tab === 'amigos' && styles.tabTxtActive]}>Mis Amigos</Text>
          </TouchableOpacity>
        </View>

        {cargando ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#FF6600" />
          </View>
        ) : (
          <FlatList
            data={listaFiltrada}
            keyExtractor={item => item.id}
            renderItem={renderUsuario}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={60} color="#EEE" />
                <Text style={styles.emptyTxt}>No se encontraron usuarios</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  closeBtn: { padding: 5 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 20
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: 45, fontSize: 16 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    marginBottom: 10
  },
  tab: {
    paddingVertical: 12,
    marginRight: 25,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabActive: { borderBottomColor: '#FF6600' },
  tabTxt: { fontSize: 15, color: '#6B7280', fontWeight: '600' },
  tabTxtActive: { color: '#FF6600' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB'
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#EEE' },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  userBio: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  actionBtn: {
    backgroundColor: '#FF6600',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8
  },
  actionBtnActive: { backgroundColor: '#F3F4F6' },
  actionBtnTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  actionBtnTxtActive: { color: '#374151' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyTxt: { color: '#9CA3AF', marginTop: 15, fontSize: 16 }
});
