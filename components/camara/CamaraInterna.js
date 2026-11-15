import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View, Vibration } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';

/**
 * Camara interna para capturar una foto y devolver su URI local al componente padre.
 */
export default function CamaraInterna({ visible, onCerrar, onFotoCapturada }) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isActive, setIsActive] = useState(false);
  const [cameraPosition, setCameraPosition] = useState('back');
  const [flash, setFlash] = useState('off');
  const [zoomFactor, setZoomFactor] = useState(1);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSelectingGallery, setIsSelectingGallery] = useState(false);
  const [isPreparingGallery, setIsPreparingGallery] = useState(false);
  const [galleryLoadingText, setGalleryLoadingText] = useState('');
  const cameraRef = useRef(null);
  const device = useCameraDevice(cameraPosition);

  const photoOutput = usePhotoOutput({
    maxPhotoQualityPrioritization: 'balanced',
  });

  useEffect(() => {
    if (visible) {
      setIsActive(true);
      if (!hasPermission) requestPermission();
    } else {
      setIsActive(false);
    }
  }, [visible, hasPermission]);

  useEffect(() => {
    if (!visible) return undefined;

    const zoomInterval = setInterval(() => {
      const factor = cameraRef.current?.controller?.displayableZoomFactor;
      if (typeof factor === 'number') setZoomFactor(factor);
    }, 100);

    return () => clearInterval(zoomInterval);
  }, [visible, cameraPosition]);

  if (!visible) return null;

  const toggleFlash = () => {
    if (cameraPosition !== 'back') return;

    setFlash((current) => {
      if (current === 'off') return 'auto';
      if (current === 'auto') return 'on';
      return 'off';
    });
  };

  const toggleCameraPosition = () => {
    setCameraPosition((current) => (current === 'back' ? 'front' : 'back'));
    setFlash('off');
    setZoomFactor(1);
  };

  const cambiarZoom = (direction) => {
    const controller = cameraRef.current?.controller;
    if (!controller) return;

    const zoomStep = (controller.maxZoom - controller.minZoom) * 0.2;
    const nextZoom = Math.max(
      controller.minZoom,
      Math.min(controller.maxZoom, controller.zoom + zoomStep * direction)
    );

    cameraRef.current.startZoomAnimation(nextZoom, 3);
  };

  const abrirGaleria = async () => {
    if (isSelectingGallery || isCapturing) return;

    setIsSelectingGallery(true);
    setIsPreparingGallery(true);
    setGalleryLoadingText('Espere, abriendo galería...');
    setIsActive(false);

    try {
      // Dar tiempo a que el mensaje se pinte antes de abrir el selector nativo.
      await new Promise((resolve) => setTimeout(resolve, 180));
      setIsPreparingGallery(false);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setIsPreparingGallery(true);
        setGalleryLoadingText('Cargando imagen...');
        setIsActive(true);
        await new Promise((resolve) => setTimeout(resolve, 100));

        let finalUri = result.assets[0].uri;
        try {
          const manip = await ImageManipulator.manipulateAsync(
            finalUri,
            [{ resize: { width: 1080 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );
          if (manip?.uri) finalUri = manip.uri;
        } catch (e) {}

        onFotoCapturada(finalUri);
        setTimeout(() => setIsPreparingGallery(false), 800);
      } else {
        setIsActive(true);
        setIsPreparingGallery(false);
        setGalleryLoadingText('');
      }
    } catch (error) {
      console.error('Error al abrir la galería:', error);
      setIsActive(true);
      setIsPreparingGallery(false);
      setGalleryLoadingText('');
      Alert.alert('Error', 'No se pudo abrir la galería. Intenta de nuevo.');
    } finally {
      setIsSelectingGallery(false);
    }
  };

  const tomarFoto = async () => {
    if (photoOutput == null || isCapturing) return;

    setIsCapturing(true);
    Vibration.vibrate(50); // Feedback háptico de confirmación estilo WhatsApp
    try {
      const photo = await photoOutput.capturePhoto(
        {
          flashMode: cameraPosition === 'back' ? flash : 'off',
          enableShutterSound: false
        },
        {}
      );
      const filePath = await photo.saveToTemporaryFileAsync();
      const formattedUri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;

      // Normalizar rotación EXIF de inmediato para que en Samsung A54 y similares la vista previa salga vertical
      let finalUri = formattedUri;
      try {
        const manip = await ImageManipulator.manipulateAsync(
          formattedUri,
          [{ resize: { width: 1080 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        if (manip?.uri) finalUri = manip.uri;
      } catch (errManip) {
        console.log('Error normalizando rotación EXIF en foto:', errManip);
      }

      onFotoCapturada(finalUri);
      photo.dispose?.();
    } catch (error) {
      console.error('Error al capturar foto:', error);
      Alert.alert('Error', 'No se pudo tomar la foto. Intenta de nuevo.');
    } finally {
      setIsCapturing(false);
    }
  };

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
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        implementationMode="compatible"
        enableNativeZoomGesture
        outputs={[photoOutput]}
      />

      {isPreparingGallery && (
        <View style={styles.galleryLoadingOverlay} pointerEvents="none">
          <View style={styles.galleryLoadingContent}>
            <ActivityIndicator color="white" size="large" />
            <Text style={styles.galleryLoadingText}>{galleryLoadingText}</Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.sideButton, styles.flashButton, styles.flashTopButton, cameraPosition !== 'back' && styles.sideButtonDisabled]}
        onPress={toggleFlash}
        disabled={cameraPosition !== 'back'}
      >
        <Ionicons
          name={flash === 'off' ? 'flash-off' : 'flash'}
          size={24}
          color={flash === 'off' ? 'white' : '#FBBF24'}
        />
        <Text style={styles.flashLabel}>
          {flash === 'auto' ? 'Auto' : flash === 'on' ? 'On' : 'Off'}
        </Text>
      </TouchableOpacity>

      <View style={styles.zoomIndicator} pointerEvents="none">
        <Text style={styles.zoomIndicatorText}>{zoomFactor.toFixed(1)}x</Text>
      </View>

      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.sideButton} onPress={() => cambiarZoom(-1)}>
          <Ionicons name="remove" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideButton} onPress={() => cambiarZoom(1)}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.controls} pointerEvents="box-none">
        <View style={styles.controlsRow}>
          <View style={styles.sideSlot}>
            <TouchableOpacity
              style={[styles.sideButton, isSelectingGallery && styles.sideButtonDisabled]}
              onPress={abrirGaleria}
              disabled={isSelectingGallery}
            >
              <Ionicons name="images" size={25} color="white" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.shutterOuter, isCapturing && styles.shutterDisabled]}
            onPress={tomarFoto}
            activeOpacity={0.7}
            disabled={isCapturing}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          <View style={styles.sideSlot}>
            <TouchableOpacity style={styles.sideButton} onPress={toggleCameraPosition}>
              <Ionicons name="camera-reverse" size={28} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
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
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 230,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  controlsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  sideSlot: {
    width: 76,
    alignItems: 'center',
  },
  flashTopButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 20,
    elevation: 20,
  },
  flashButton: {
    width: 64,
    height: 58,
    borderRadius: 29,
  },
  flashLabel: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: -2,
  },
  zoomIndicator: {
    position: 'absolute',
    top: 115,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  zoomIndicatorText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  zoomControls: {
    position: 'absolute',
    right: 20,
    top: 115,
    gap: 10,
    zIndex: 20,
    elevation: 20,
  },
  sideButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideButtonDisabled: {
    opacity: 0.45,
  },
  galleryLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    elevation: 100,
  },
  galleryLoadingContent: {
    transform: [{ translateY: 250 }],
    alignItems: 'center',
  },
  galleryLoadingText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: 'white',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterDisabled: {
    opacity: 0.55,
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
});
