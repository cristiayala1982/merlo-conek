import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ReaccionesMensaje from './ReaccionesMensaje';

/**
 * Burbuja de mensaje para contenido compartido (Perfil, Post, etc) estilo Instagram.
 */
export default function MensajeCompartido({ data, esMio, hora, onLongPress, reacciones }) {
  const router = useRouter();

  const handleVerContenido = () => {
    if (!data) return;

    if (data.tipo === 'perfil') {
      router.push({ pathname: '/(tabs)/perfilAjeno', params: { userId: data.id } });
    } else if (data.tipo === 'post') {
      router.push({ pathname: '/postDetalle', params: { postId: data.id } });
    } else if (data.tipo === 'alerta') {
      router.push({ pathname: '/alertaDetalle', params: { postId: data.id } });
    } else if (data.tipo === 'clasificado') {
      router.push({ pathname: '/alertas/clasificados/detalle', params: { postId: data.id } });
    } else if (data.tipo === 'market') {
      router.push({ pathname: '/(marketplace)/marketDetalle', params: { productId: data.id } });
    } else if (data.tipo === 'huellita') {
      router.push({ pathname: '/huellitas/detalle', params: { petId: data.id } });
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onLongPress={onLongPress}
      style={[
        styles.container,
        esMio ? styles.mio : styles.ajeno,
        { marginBottom: reacciones && Object.keys(reacciones).length > 0 ? 22 : 4 }
      ]}
    >
      {/* HEADER DE LA TARJETA */}
      <View style={styles.header}>
        <Ionicons
            name={data.tipo === 'perfil' ? "person-circle-outline" : data.tipo === 'alerta' ? "megaphone-outline" : data.tipo === 'clasificado' ? "newspaper-outline" : data.tipo === 'huellita' ? "paw-outline" : "share-social-outline"}
            size={16}
            color="#6B7280"
        />
        <Text style={styles.headerText}>
            {data.tipo === 'perfil' ? 'Perfil compartido' : data.tipo === 'alerta' ? 'Aviso comunitario' : data.tipo === 'clasificado' ? 'Clasificado compartido' : data.tipo === 'huellita' ? 'Mascota compartida' : 'Publicación compartida'}
        </Text>
      </View>

      {/* CUERPO: IMAGEN Y TÍTULO */}
      <View
        style={styles.card}
      >
        {data.imagen ? (
          <Image
            source={{ uri: data.imagen }}
            style={styles.image}
          />
        ) : (
          <View style={[styles.image, styles.noImage]}>
             <Ionicons
              name={data.tipo === 'perfil' ? "person" : data.tipo === 'alerta' ? "megaphone" : data.tipo === 'clasificado' ? "newspaper" : data.tipo === 'huellita' ? "paw" : "document-text"}
              size={50}
              color="#D1D5DB"
            />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.titulo} numberOfLines={2}>{data.titulo || 'Contenido'}</Text>
          {data.subTitulo ? (
              <Text style={styles.subTitulo} numberOfLines={1}>{data.subTitulo}</Text>
          ) : null}
        </View>
      </View>

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

      <ReaccionesMensaje reacciones={reacciones} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    borderRadius: 20,
    padding: 2,
    borderWidth: 1,
    marginBottom: 4,
    position: 'relative',
    // Quitamos overflow: hidden para que las reacciones floten afuera
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
    gap: 6,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20
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
  noImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6'
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
    backgroundColor: 'white',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18
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