import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CamaraInterna from '../camara/CamaraInterna';

/**
 * Componente especializado en seleccionar SOLO FOTOS para Clasificados.
 * Diseño idéntico a Huellitas pero con los colores de Clasificados.
 */
export default function SelectorFotoClasificados({ onFotoSeleccionada, fotosActualesCount, cerrarCamara }) {
  const [camaraVisible, setCamaraVisible] = useState(false);
  const maxFotos = 4;

  useEffect(() => {
    if (cerrarCamara > 0) setCamaraVisible(false);
  }, [cerrarCamara]);

  const handleLaunchCamera = () => {
    if (fotosActualesCount >= maxFotos) {
      Alert.alert("Límite alcanzado", `Puedes subir un máximo de ${maxFotos} fotos.`);
      return;
    }
    setCamaraVisible(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={handleLaunchCamera}>
          <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="camera" size={36} color="#059669" />
          </View>
          <Text style={styles.btnTxt}>Foto / Galería</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.infoTxt}>Solo se permiten fotos. Máximo 4 por anuncio.</Text>

      {/* MODAL OFICIAL PARA VOLAR LA CÁMARA A PANTALLA COMPLETA ENCIMA DE TODO */}
      <Modal
        visible={camaraVisible}
        animationType="slide"
        transparent={false}
        statusBarTranslucent={true}
        onRequestClose={() => setCamaraVisible(false)}
      >
        <CamaraInterna
          visible={camaraVisible}
          onCerrar={() => setCamaraVisible(false)}
          onFotoCapturada={onFotoSeleccionada}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 2
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 5
  },
  btn: {
    alignItems: 'center',
    flex: 1
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5'
  },
  btnTxt: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#374151'
  },
  infoTxt: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '700',
    fontStyle: 'italic',
    marginTop: 8
  }
});
