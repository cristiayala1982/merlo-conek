import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

/**
 * Componente especializado en seleccionar SOLO FOTOS para Alertas Comunitarias.
 * Asegura uniformidad visual con la sección de Huellitas.
 */
export default function SelectorFotoComunidad({ onFotoSeleccionada, fotosActualesCount }) {

  const maxFotos = 1; // Las alertas comunitarias suelen ser de una sola foto

  const handleLaunchCamera = async () => {
    if (fotosActualesCount >= maxFotos) {
      Alert.alert("Límite alcanzado", `Solo puedes subir ${maxFotos} foto por alerta.`);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permiso denegado", "Necesitamos acceso a la cámara para tomar fotos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      onFotoSeleccionada(result.assets[0].uri);
    }
  };

  const handleLaunchGallery = async () => {
    if (fotosActualesCount >= maxFotos) {
      Alert.alert("Límite alcanzado", `Solo puedes subir ${maxFotos} foto por alerta.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      onFotoSeleccionada(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={handleLaunchCamera}>
          <View style={[styles.iconCircle, { backgroundColor: '#FFF5F0' }]}>
            <Ionicons name="camera" size={28} color="#FF6600" />
          </View>
          <Text style={styles.btnTxt}>Tomar Foto</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={handleLaunchGallery}>
          <View style={[styles.iconCircle, { backgroundColor: '#FFF5F0' }]}>
            <Ionicons name="images" size={28} color="#FF6600" />
          </View>
          <Text style={styles.btnTxt}>Galería</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.infoTxt}>Subir Fotos (Solo imágenes)</Text>
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
    borderColor: '#FFE0CC'
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
