import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, DeviceEventEmitter, Alert } from 'react-native';
import { auth } from '../../firebaseConfig';
import { buscarUsuarios, dejarDeSeguirUsuario, obtenerPerfilUsuario, enviarSolicitudAmistad, aceptarSolicitudAmistad, rechazarSolicitudAmistad, escucharEstadoAmistad, lanzarDesafioEspontaneo } from '../../services/firebaseService';
import { showToast } from '../utilidades/CustomToast';

function FilaUsuario({ item, miPerfil, onNavigate, modoDesafio, onDesafioLanzado }) {
  const [relacion, setRelacion] = useState(null);
  const miUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!item.id || !miUid) return;
    const unsub = escucharEstadoAmistad(item.id, setRelacion);
    return () => unsub();
  }, [item.id, miUid]);

  const handleAccion = async () => {
    try {
      if (modoDesafio) {
        await lanzarDesafioEspontaneo(item.id);
        onDesafioLanzado?.(item.nombre);
        return;
      }
      if (!relacion) {
        await enviarSolicitudAmistad(item.id);
      } else if (relacion.status === 'aceptada') {
        await dejarDeSeguirUsuario(item.id);
      } else if (relacion.status === 'pendiente' && relacion.paraUid === miUid) {
        await aceptarSolicitudAmistad(null, item.id);
      }
    } catch (e) {
      console.log('Error en accion amigo:', e);
    }
  };

  const handleRechazar = async () => {
    try {
      await rechazarSolicitudAmistad(null, item.id);
    } catch (e) {
      console.log('Error al rechazar:', e);
    }
  };

  let btnText = "Agregar", btnIcon = "add", btnActive = false;
  let showReject = false;

  if (modoDesafio) {
    btnText = "Desafiar"; btnIcon = "sparkles"; btnActive = false;
  } else if (relacion) {
    if (relacion.status === 'aceptada') {
      btnText = "Amigo"; btnIcon = "checkmark"; btnActive = true;
    } else if (relacion.status === 'pendiente') {
      if (relacion.deUid === miUid) {
        btnText = "Enviada"; btnIcon = "time-outline"; btnActive = true;
      } else {
        btnText = "Aceptar"; btnIcon = "person-add"; btnActive = false;
        showReject = true; // Mostramos opción de rechazar
      }
    }
  }

  return (
    <View style={styles.userCard}>
      <TouchableOpacity style={styles.userInfo} onPress={() => onNavigate(item.id)}>
        <Image
          source={{ uri: item.fotoUrl || 'https://picsum.photos/100/100' }}
          style={styles.avatar}
        />
        <View style={styles.textContainer}>
          <Text style={styles.userName}>{item.nombre || 'Usuario'}</Text>
          <Text style={styles.userBio} numberOfLines={1} ellipsizeMode="tail">
            {item.bio || 'Sin biografía'}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {showReject && (
          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={handleRechazar}
          >
            <Ionicons name="close" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionBtn, btnActive && styles.actionBtnActive]}
          onPress={handleAccion}
          disabled={btnText === "Enviada"}
        >
          <Ionicons
            name={btnIcon}
            size={18}
            color={btnActive ? "#6B7280" : (modoDesafio ? "#FF6600" : "#FF6600")}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.actionBtnTxt, btnActive && styles.actionBtnTxtActive, modoDesafio && { color: '#FF6600' }]}>
            {btnText}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AmigosModal({ visible, onClose }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [miPerfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('sugerencias'); // 'amigos' o 'sugerencias'
  const [modoDesafio, setModoDesafio] = useState(false);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('SET_MODO_DESAFIO', (val) => {
      setModoDesafio(val);
      if (val) setTab('amigos'); // Por defecto a amigos si es desafío
    });
    return () => sub.remove();
  }, []);

  const handleDesafioCompletado = (nombre) => {
    showToast(`¡Desafío enviado a ${nombre}!`, 'challenge');
    onClose();
  };

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // 1. Escuchar mi propio perfil
    const unsubPerfil = obtenerPerfilUsuario(uid, (data) => {
      setPerfil(data);
    });

    // 2. Buscar usuarios
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
    return true;
  });

  const irAPerfil = (uid) => {
    onClose();
    router.push({
        pathname: '/(tabs)/perfilAjeno',
        params: { userId: uid }
    });
  };

  const renderUsuario = ({ item }) => (
    <FilaUsuario
      item={item}
      miPerfil={miPerfil}
      onNavigate={irAPerfil}
      modoDesafio={modoDesafio}
      onDesafioLanzado={handleDesafioCompletado}
    />
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => { setModoDesafio(false); onClose(); }}
    >
      <View style={styles.container}>
        {/* Cabecera */}
        <View style={styles.header}>
          <Text style={styles.title}>{modoDesafio ? 'Elegir amigo para desafiar' : 'Amigos'}</Text>
          <TouchableOpacity onPress={() => { setModoDesafio(false); onClose(); }} style={styles.closeBtn}>
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
        {!modoDesafio && (
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
        )}

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
                <Text style={styles.emptyText}>No se encontraron usuarios</Text>
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
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  textContainer: { flex: 1 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12, backgroundColor: '#EEE' },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  userBio: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  actionBtn: {
    borderWidth: 1,
    borderColor: '#FF6600',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 90,
    justifyContent: 'center',
    backgroundColor: 'transparent'
  },
  actionBtnActive: { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  actionBtnTxt: { color: '#FF6600', fontWeight: 'bold', fontSize: 13 },
  actionBtnTxtActive: { color: '#6B7280' },
  rejectBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyTxt: { color: '#9CA3AF', marginTop: 15, fontSize: 16 }
});
