import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator
} from 'react-native';
import { buscarUsuarios } from '../../services/firebaseService';

export default function SelectorMenciones({ query, onSelect }) {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!query || query.length < 1) {
      setUsuarios([]);
      return;
    }

    setCargando(true);
    // Usamos la función existente de búsqueda
    const unsub = buscarUsuarios(query, (resultados) => {
      setUsuarios(resultados);
      setCargando(false);
    });

    return () => unsub();
  }, [query]);

  if (usuarios.length === 0 && !cargando) return null;

  return (
    <View style={styles.container}>
      {cargando && usuarios.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#FF6600" />
        </View>
      ) : (
        <FlatList
          data={usuarios}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="always"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.usuarioItem}
              onPress={() => onSelect(item)}
            >
              <Image
                source={{ uri: item.fotoUrl || 'https://picsum.photos/100' }}
                style={styles.avatar}
              />
              <View>
                <Text style={styles.nombre}>{item.nombre}</Text>
                <Text style={styles.subtitulo}>@{item.nombre.toLowerCase().replace(/\s+/g, '')}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 200,
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    overflow: 'hidden',
  },
  loadingBox: {
    padding: 20,
    alignItems: 'center',
  },
  usuarioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#EEE',
  },
  nombre: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  subtitulo: {
    fontSize: 12,
    color: '#6B7280',
  },
});
