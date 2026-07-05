import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, NativeModules, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../firebaseConfig';
import { actualizarPerfilUsuario, obtenerPerfilUsuario } from '../services/firebaseService';

export default function EditarPerfil() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [bio, setBio] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState('https://picsum.photos/200');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setCargando(false);
      return;
    }

    const unsub = obtenerPerfilUsuario(uid, (data) => {
      if (data) {
        setNombre(data.nombre || '');
        setBio(data.bio || '');
        setFotoPerfil(data.fotoUrl || 'https://picsum.photos/200');
      }
      setCargando(false);
    });

    return () => unsub();
  }, []);

  const abrirCamaraPerfil = async () => {
    try {
      if (Platform.OS !== 'android') {
        Alert.alert('No soportado', 'La camara nativa solo funciona en Android.');
        return;
      }

      const modulo = NativeModules.HistoriasLabNative;
      if (!modulo) return;

      const rutaCruda = await modulo.abrirCamaraHistorias(true); // true = solo foto
      if (rutaCruda) {
        setFotoPerfil(`file://${rutaCruda}`);
      }
    } catch (error) {
      console.log('Error camara perfil:', error);
    }
  };

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      Alert.alert("Error", "El nombre es obligatorio");
      return;
    }

    try {
      setGuardando(true);
      await actualizarPerfilUsuario({
        nombre: nombre.trim(),
        bio: bio.trim(),
        fotoUri: fotoPerfil
      });
      Alert.alert("Éxito", "Perfil actualizado correctamente");
      router.back();
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar: " + error.message);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color="#FF6600" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Perfil</Text>
        <TouchableOpacity onPress={handleGuardar} disabled={guardando}>
          {guardando ? (
            <ActivityIndicator size="small" color="#FF6600" />
          ) : (
            <Text style={styles.saveBtn}>Guardar</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.avatarSection}>
        <Image
          source={{ uri: fotoPerfil }}
          style={styles.avatar}
        />
        <TouchableOpacity style={styles.changePhotoBtn} onPress={abrirCamaraPerfil} disabled={guardando}>
          <Text style={styles.changePhotoTxt}>Cambiar foto de perfil</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Tu nombre"
          editable={!guardando}
        />

        <Text style={styles.label}>Biografía</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={3}
          placeholder="Cuéntanos sobre ti..."
          editable={!guardando}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  saveBtn: { color: '#FF6600', fontWeight: 'bold', fontSize: 16 },
  avatarSection: { alignItems: 'center', marginVertical: 30 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EEE' },
  changePhotoBtn: { marginTop: 15 },
  changePhotoTxt: { color: '#FF6600', fontWeight: '600' },
  form: { paddingHorizontal: 20 },
  label: { color: '#888', marginBottom: 5, fontSize: 12 },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    paddingVertical: 10,
    marginBottom: 25,
    fontSize: 16
  },
  textArea: { textAlignVertical: 'top' }
});
