import { useEffect, useState } from 'react';
import { Alert, Modal, NativeModules, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import VistaPrevia from '../../../components/camara/VistaPrevia';
import { comprimirVideoPro } from '../../../components/camara/compresor3';
import { subirArchivoAFirebase } from '../../../services/firebaseService';

const historias = [
  { id: '1', nombre: 'Tu historia' },
  { id: '2', nombre: 'Ana' },
  { id: '3', nombre: 'Luis' },
  { id: '4', nombre: 'Camila' },
  { id: '5', nombre: 'Marco' },
  { id: '6', nombre: 'Sofia' },
];

export default function HistoriasScreen() {
  const [archivoCapturado, setArchivoCapturado] = useState(null);

  useEffect(() => {
    const pedirPermisos = async () => {
      if (Platform.OS !== 'android') return;

      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
    };

    pedirPermisos();
  }, []);

  const abrirCamaraNativa = async () => {
    if (!NativeModules.HistoriasLabNative) {
      Alert.alert('Modulo no disponible', 'Compila Android nativo para usar la camara personalizada.');
      return;
    }

    try {
      const rutaCrudaAndroid = await NativeModules.HistoriasLabNative.abrirCamaraHistorias(false);
      const esVideo = rutaCrudaAndroid.endsWith('.mp4');

      setArchivoCapturado({
        tipo: esVideo ? 'video' : 'foto',
        uri: `file://${rutaCrudaAndroid}`,
      });
    } catch (error) {
      console.log('Camara nativa cancelada o fallo:', error?.message || error);
    }
  };

  const handlePublicar = async () => {
    try {
      let uriParaSubir = archivoCapturado.uri;

      if (archivoCapturado.tipo === 'video') {
        uriParaSubir = await comprimirVideoPro(archivoCapturado.uri);
      }

      await subirArchivoAFirebase(uriParaSubir, archivoCapturado.tipo);
      Alert.alert("¡Publicado!", "Tu historia se guardó en Firebase.");
      setArchivoCapturado(null);
    } catch (error) {
      Alert.alert("Error", "No se pudo subir a Firebase: " + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Historias</Text>
      <Text style={styles.subtitle}>Este es tu contenedor de historias en tabs</Text>

      <Pressable style={styles.botonCamara} onPress={abrirCamaraNativa}>
        <Text style={styles.botonCamaraTxt}>Abrir camara nativa</Text>
      </Pressable>

      <Modal visible={!!archivoCapturado} animationType="slide">
        <VistaPrevia
          archivo={archivoCapturado}
          onDescartar={() => setArchivoCapturado(null)}
          onPublicar={handlePublicar}
        />
      </Modal>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.lista}>
        {historias.map((historia) => (
          <View key={historia.id} style={styles.item}>
            <View style={styles.avatar} />
            <Text style={styles.nombre}>{historia.nombre}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingHorizontal: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 14,
  },
  botonCamara: {
    backgroundColor: '#0B3B60',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  botonCamaraTxt: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  capturaInfo: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 12,
  },
  lista: {
    gap: 10,
    paddingRight: 10,
  },
  item: {
    alignItems: 'center',
    width: 78,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#FB923C',
    marginBottom: 6,
  },
  nombre: {
    fontSize: 12,
    color: '#374151',
  },
});