import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaProvider, SafeAreaView, Dimensions, Alert, Image } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Componente de cámara integrada de alto rendimiento usando react-native-vision-camera.
 * Funciona completamente dentro de la aplicación para evitar cierres por falta de RAM en dispositivos de gama baja.
 *
 * @param {boolean} visible Controla la visibilidad de la cámara desde el padre.
 * @param {function} onCerrar Función que se ejecuta al cancelar o cerrar la cámara.
 * @param {function} onFotoCapturada Función que devuelve el URI local de la foto tomada.
 */
export default function CamaraInterna({ visible, onCerrar, onFotoCapturada }) {
  const [hasPermission, setHasPermission] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [cameraPosition, setCameraPosition] = useState('back'); // 'back' o 'front'
  const [flash, setFlash] = useState('off'); // 'off' o 'on'
  const [photoPreview, setPhotoPreview] = useState(null);

  const cameraRef = useRef(null);
  const device = useCameraDevice(cameraPosition);

  // Solicitar permisos al montar o al hacerse visible
  useEffect(() => {
    if (visible) {
      setIsActive(true);
      (async () => {
        const status = await Camera.getCameraPermissionStatus();
        if (status === 'granted') {
          setHasPermission(true);
        } else {
          const requestStatus = await Camera.requestCameraPermission();
          setHasPermission(requestStatus === 'granted');
        }
      })();
    } else {
      setIsActive(false);
      setPhotoPreview(null);
    }
  }, [visible]);

  if (!visible) return null;

  // Manejar el cambio de flash
  const toggleFlash = () => {
    setFlash((current) => (current === 'off' ? 'on' : 'off'));
  };

  // Alternar entre cámara trasera y delantera
  const toggleCameraPosition = () => {
    setCameraPosition((current) => (current === 'back' ? 'front' : 'back'));
  };

  // Capturar la fotografía
  const tomarFoto = async () => {
    if (cameraRef.current == null) return;

    try {
      const file = await cameraRef.current.takePhoto({
        flash: flash,
        enableShutterSound: true,
        qualityPrioritization: 'balanced', // Balance perfecto entre velocidad y RAM
        skipMetadata: true, // Ahorra memoria omitiendo datos adicionales de la foto
      });

      // El URI viene en formato de archivo local de react-native-vision-camera (ruta nativa)
      // Agregamos el prefijo file:// si no lo tiene, para compatibilidad con React Native Image
      const formattedUri = file.path.startsWith('file://') ? file.path : `file://${file.path}`;
      setPhotoPreview(formattedUri);
    } catch (error) {
      console.error("Error al capturar foto:", error);
      Alert.alert("Error", "No se pudo tomar la foto. Intenta de nuevo.");
    }
  };

  // Confirmar y enviar la foto tomada al componente padre
  const confirmarFoto = () => {
    if (photoPreview) {
      onFotoCapturada(photoPreview);
      setPhotoPreview(null);
      onCerrar();
    }
  };

  // Descartar la foto de vista previa para tomar otra
  const descartarFoto = () => {
    setPhotoPreview(null);
  };

  // Si no hay permisos concedidos
  if (!hasPermission) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="camera-outline" size={64} color="#6B7280" />
        <Text style={styles.errorText}>Se requiere acceso a la cámara para usar esta función.</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={onCerrar}>
          <Text style={styles.actionBtnTxt}>Regresar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Si no encuentra el lente o sensor de cámara adecuado
  if (device == null) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.errorText}>No se detectó un dispositivo de cámara compatible.</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={onCerrar}>
          <Text style={styles.actionBtnTxt}>Regresar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {photoPreview ? (
        // --- VISTA PREVIA DE LA FOTO TOMADA ---
        <View style={styles.previewContainer}>
          <Image source={{ uri: photoPreview }} style={styles.previewImage} resizeMode="cover" />

          <View style={styles.previewControls}>
            <TouchableOpacity style={styles.previewBtnDiscard} onPress={descartarFoto}>
              <Ionicons name="close-circle" size={32} color="white" />
              <Text style={styles.previewBtnTxt}>Repetir</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.previewBtnConfirm} onPress={confirmarFoto}>
              <Ionicons name="checkmark-circle" size={54} color="#10B981" />
              <Text style={[styles.previewBtnTxt, { fontWeight: 'bold' }]}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // --- VISTA DE CÁMARA EN VIVO ---
        <View style={styles.cameraWrapper}>
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isActive}
            photo={true}
          />

          {/* Botones de Control Superpuestos (Arriba) */}
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.iconButton} onPress={onCerrar}>
              <Ionicons name="arrow-back" size={28} color="white" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} onPress={toggleFlash}>
              <Ionicons
                name={flash === 'on' ? "flash" : "flash-off"}
                size={26}
                color={flash === 'on' ? "#FBBF24" : "white"}
              />
            </TouchableOpacity>
          </View>

          {/* Barra de Controles Inferior (Disparador y Rotar) */}
          <View style={styles.bottomControls}>
            <View style={styles.flexItem} />

            {/* Botón Disparador Principal */}
            <TouchableOpacity style={styles.shutterOuter} onPress={tomarFoto} activeOpacity={0.7}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>

            {/* Botón Rotar Cámara */}
            <View style={[styles.flexItem, { alignItems: 'center' }]}>
              <TouchableOpacity style={styles.rotateButton} onPress={toggleCameraPosition}>
                <Ionicons name="camera-reverse" size={28} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
    zIndex: 99999, // Superponerse a cualquier modal y pantalla
  },
  centerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    zIndex: 99999,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 25,
    lineHeight: 22,
  },
  actionBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  actionBtnTxt: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  cameraWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50, // Espacio para la barra de estado de Android
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  flexItem: {
    flex: 1,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  rotateButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'space-between',
  },
  previewImage: {
    flex: 1,
    width: screenWidth,
    height: screenHeight,
  },
  previewControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  previewBtnDiscard: {
    alignItems: 'center',
  },
  previewBtnConfirm: {
    alignItems: 'center',
  },
  previewBtnTxt: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
