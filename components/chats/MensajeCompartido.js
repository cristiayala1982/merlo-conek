import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

/**
 * Burbuja de mensaje para contenido compartido (Perfil, Post, etc) estilo Instagram.
 */
export default function MensajeCompartido({ data, esMio, hora }) {
  const router = useRouter();

  const handleVerContenido = () => {
    if (!data) return;

    if (data.tipo === 'perfil') {
      router.push({ pathname: '/(tabs)/perfilAjeno', params: { userId: data.id } });
    } else if (data.tipo === 'post') {
      router.push({ pathname: '/postDetalle', params: { postId: data.id } });
    } else if (data.tipo === 'market') {
      router.push({ pathname: '/(marketplace)/marketDetalle', params: { productId: data.id } });
    }
  };

  return (
    <View style={[styles.container, esMio ? styles.mio : styles.ajeno]}>
      {/* HEADER DE LA TARJETA */}
      <View style={styles.header}>
        <Ionicons
            name={data.tipo === 'perfil' ? "person-circle-outline" : "share-social-outline"}
            size={16}
            color="#6B7280"
        />
        <Text style={styles.headerText}>
            {data.tipo === 'perfil' ? 'Perfil compartido' : 'Contenido compartido'}
        </Text>
      </View>

      {/* CUERPO: IMAGEN Y TÍTULO */}
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={handleVerContenido}
      >
        <Image
          source={{ uri: data.imagen || 'https://picsum.photos/200' }}
          style={styles.image}
        />
        <View style={styles.info}>
          <Text style={styles.titulo} numberOfLines={1}>{data.titulo || 'Contenido'}</Text>
          {data.subTitulo ? (
              <Text style={styles.subTitulo} numberOfLines={1}>{data.subTitulo}</Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* ACCIÓN PRINCIPAL */}
      <TouchableOpacity
        style={styles.btnVer}
        onPress={handleVerContenido}
      >
        <Text style={styles.btnVerText}>
            {data.tipo === 'perfil' ? 'Ver perfil' : 'Ver publicación'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.hora}>{hora}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    borderRadius: 20,
    padding: 2,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 4
  },
  mio: {
    alignSelf: 'flex-end',
    backgroundColor: '#FFF5ED',
    borderColor: '#FF6600',
    borderBottomRightRadius: 4
  },
  ajeno: {
    alignSelf: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderBottomLeftRadius: 4
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6
  },
  headerText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600'
  },
  card: {
    backgroundColor: 'white',
    marginHorizontal: 2,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: 180,
    backgroundColor: '#EEE'
  },
  info: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  titulo: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827'
  },
  subTitulo: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  btnVer: {
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'white'
  },
  btnVerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6600'
  },
  hora: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'right',
    paddingRight: 10,
    paddingBottom: 6
  }
});