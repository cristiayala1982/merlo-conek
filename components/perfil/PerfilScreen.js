import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebaseConfig';
import { obtenerPerfilUsuario } from '../../services/firebaseService';

export default function PerfilScreen() {
  const router = useRouter();
  const [perfil, setPerfil] = useState({
    nombre: 'Cargando...',
    bio: '',
    fotoUrl: 'https://picsum.photos/200'
  });

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsub = obtenerPerfilUsuario(uid, (data) => {
      if (data) {
        setPerfil({
          nombre: data.nombre || 'Sin nombre',
          bio: data.bio || '',
          fotoUrl: data.fotoUrl || 'https://picsum.photos/200'
        });
      }
    });

    return () => unsub();
  }, []);

  const handleEditar = () => {
    router.push('/editarPerfil');
  };

  return (
    <ScrollView style={styles.container}>
      {/* Portada */}
      <View style={styles.portada} />

      {/* Info de Perfil */}
      <View style={styles.headerInfo}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: perfil.fotoUrl }}
            style={styles.avatar}
          />
          {/* Lapicito para editar */}
          <TouchableOpacity style={styles.editBadge} onPress={handleEditar}>
            <Ionicons name="pencil" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>

        <Text style={styles.nombre}>{perfil.nombre}</Text>
        <Text style={styles.bio}>{perfil.bio || 'Sin biografía'}</Text>
      </View>

      {/* Estadísticas */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>0</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>0</Text>
          <Text style={styles.statLabel}>Seguidores</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>0</Text>
          <Text style={styles.statLabel}>Seguidos</Text>
        </View>
      </View>

      <View style={styles.tabSection}>
        <Text style={styles.tabTitle}>Mis Publicaciones</Text>
        <View style={styles.emptyFeed}>
          <Ionicons name="grid-outline" size={40} color="#DDD" />
          <Text style={styles.emptyText}>Aún no has publicado nada.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  portada: {
    height: 120,
    backgroundColor: '#F3F4F6',
    width: '100%'
  },
  headerInfo: {
    alignItems: 'center',
    marginTop: -50,
    paddingHorizontal: 20
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFF',
    backgroundColor: '#EEE'
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FF6600',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    elevation: 3
  },
  nombre: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827'
  },
  bio: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 25,
    paddingHorizontal: 20
  },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280' },
  tabSection: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 20
  },
  tabTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 20,
    marginBottom: 20,
    color: '#333'
  },
  emptyFeed: {
    alignItems: 'center',
    marginTop: 40,
    opacity: 0.5
  },
  emptyText: {
    marginTop: 10,
    color: '#6B7280'
  }
});
