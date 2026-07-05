import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebaseConfig';

export default function MenuOpciones({ onClose }) {
  const router = useRouter();

  const handleCerrarSesion = () => {
    Alert.alert('Cerrar sesion', 'Quieres cerrar sesion en este dispositivo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesion',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            onClose?.();
            router.replace({ pathname: '/', params: { loggedOut: '1' } });
          } catch (error) {
            Alert.alert('Error', error?.message || 'No se pudo cerrar sesion.');
          }
        },
      },
    ]);
  };

  const opciones = [
    { label: 'Buscar', icon: 'search-outline' },
    { label: 'Marketplace', icon: 'cart-outline' },
    { label: 'Crear Post', icon: 'add-circle-outline' },
    { label: 'Ajustes', icon: 'settings-outline' },
    { label: 'Amigos', icon: 'people-outline' },
    { label: 'Ayuda', icon: 'help-circle-outline' },
    {
      label: 'Cerrar sesion',
      icon: 'log-out-outline',
      iconColor: '#FF6600',
      textColor: '#1F2937',
      onPress: handleCerrarSesion,
    },
  ];

  return (
    <View style={styles.menuContainer}>
      {opciones.map((opcion, index) => (
        <TouchableOpacity key={index} style={styles.opcionItem} onPress={opcion.onPress || onClose}>
          <View style={styles.iconoBox}>
            <Ionicons name={opcion.icon} size={26} color={opcion.iconColor || '#374151'} />
          </View>
          <Text style={[styles.texto, opcion.textColor ? { color: opcion.textColor } : null]}>{opcion.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // ... (los estilos se mantienen igual que antes, ¡están perfectos!)
  menuContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    width: '100%',
  },
  opcionItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconoBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  texto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center'
  }
});