// Vista previa simplificada: Solo Giro y Texto
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function VistaPrevia({ archivo, onDescartar, onPublicar, replyData }) {
  const insets = useSafeAreaInsets();
  const [textoHistoria, setTextoHistoria] = useState('');
  const [currentUri, setCurrentUri] = useState(archivo?.uri || null);
  const [editando, setEditando] = useState(false);

  const tipo = archivo?.tipo || null;
  const esVideo = tipo === 'video';

  const player = useVideoPlayer(esVideo && !!currentUri ? currentUri : null, (playerInstance) => {
    playerInstance.loop = true;
    playerInstance.play();
  });

  const handleRotate = async () => {
    if (tipo !== 'foto' || editando) return;
    try {
      setEditando(true);
      const result = await ImageManipulator.manipulateAsync(
        currentUri,
        [{ rotate: 90 }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );
      setCurrentUri(result.uri);
    } catch (e) {
      console.log(e);
    } finally {
      setEditando(false);
    }
  };

  if (!archivo) return null;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>

        {/* Fondo Blur */}
        {tipo === 'foto' && (
          <Image source={{ uri: currentUri }} style={StyleSheet.absoluteFill} blurRadius={20} opacity={0.5} />
        )}

        {/* Visualizador */}
        <View style={styles.viewerContainer}>
          {tipo === 'foto' ? (
            <Image
              source={{ uri: currentUri }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
            />
          ) : (
            <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
          )}
        </View>

        {editando && (
          <View style={styles.loaderEdit}>
            <ActivityIndicator color="#FF6600" size="large" />
          </View>
        )}

        {/* Botón Rotar (Solo fotos) */}
        {tipo === 'foto' && !editando && (
          <TouchableOpacity style={[styles.rotateBtn, { top: insets.top + 20 }]} onPress={handleRotate}>
            <Ionicons name="reload" size={28} color="white" />
            <Text style={styles.rotateTxt}>Girar</Text>
          </TouchableOpacity>
        )}

        {/* Input de Texto */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inputContainer}
          keyboardVerticalOffset={Platform.OS === 'android' ? 100 : 0}
        >
          <View style={styles.textoWrapper}>
            <TextInput
              style={styles.inputTexto}
              placeholder="Escribe un mensaje..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={textoHistoria}
              onChangeText={setTextoHistoria}
              multiline
              maxLength={150}
            />
          </View>
        </KeyboardAvoidingView>

        {/* Botonera Inferior */}
        <View style={[styles.contenedorBotones, { bottom: insets.bottom + 40 }]}>
          <TouchableOpacity style={styles.botonAccion} onPress={onDescartar}>
            <Ionicons name="close-circle" size={60} color="#FF3B30" />
            <Text style={styles.textoBoton}>Descartar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botonAccion}
            onPress={() => onPublicar?.(textoHistoria, currentUri)}
          >
            <Ionicons name="checkmark-circle" size={60} color="#34C759" />
            <Text style={styles.textoBoton}>Aceptar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  viewerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderEdit: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 500 },
  rotateBtn: { position: 'absolute', right: 20, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  rotateTxt: { color: 'white', fontSize: 10, marginTop: 4, fontWeight: 'bold' },
  inputContainer: { position: 'absolute', bottom: '45%', left: 30, right: 30, zIndex: 200 },
  textoWrapper: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 25, paddingHorizontal: 15, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  inputTexto: { color: 'white', fontSize: 18, fontWeight: '700', textAlign: 'center', minHeight: 40 },
  contenedorBotones: { position: 'absolute', flexDirection: 'row', width: '100%', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 40, zIndex: 10 },
  botonAccion: { alignItems: 'center' },
  textoBoton: { color: 'white', fontWeight: 'bold', fontSize: 13, marginTop: 5, textShadowColor: 'black', textShadowRadius: 3 }
});
