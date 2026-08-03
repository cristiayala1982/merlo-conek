import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  StatusBar
} from 'react-native';
import { buscarUsuarios } from '../services/firebaseService';
import { auth } from '../firebaseConfig';

export default function BuscarScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    // Si no hay query, podemos mostrar sugerencias o dejar vacío
    const unsub = buscarUsuarios(query, (resultados) => {
      setUsuarios(resultados);
      setCargando(false);
    });
    return () => unsub();
  }, [query]);

  const irAlPerfil = (userId) => {
    if (userId === auth.currentUser?.uid) {
      router.push('/(tabs)/perfil');
    } else {
      router.push({
        pathname: '/(tabs)/perfilAjeno',
        params: { userId }
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Buscar amigos..."
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={(val) => {
              setQuery(val);
              setCargando(true);
            }}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {cargando && (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#FF6600" />
        </View>
      )}

      <FlatList
        data={usuarios}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !cargando && (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={60} color="#EEE" />
              <Text style={styles.emptyText}>
                {query.length > 0 ? 'No se encontraron usuarios' : 'Busca personas por su nombre'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.userCard} onPress={() => irAlPerfil(item.id)}>
            <Image
              source={{ uri: item.fotoUrl || `https://api.dicebear.com/9.x/thumbs/png?seed=${item.id}` }}
              style={styles.avatar}
            />
            <View style={styles.userInfo}>
              <Text style={styles.nombre}>{item.nombre}</Text>
              <Text style={styles.username}>@{item.nombre.toLowerCase().replace(/\s+/g, '')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    marginRight: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  list: {
    padding: 15,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  nombre: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  username: {
    fontSize: 13,
    color: '#6B7280',
  },
  loadingCenter: {
    marginTop: 50,
  },
  empty: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 10,
    color: '#9CA3AF',
    fontSize: 16,
  },
});
