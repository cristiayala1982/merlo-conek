import { Ionicons } from '@expo/vector-icons'; // Importamos Ionicons
import { View } from 'react-native';
import { HaloCameraIcon } from './halo-camera-icon';
import { HaloBellIcon, HaloMessageIcon } from './halo-nav-icons';

export default function IconoContextual({ seccion }) {
  const getIcono = () => {
    switch (seccion) {
      case 'notificaciones': return <HaloBellIcon size={36} color="#FF6600" strokeWidth={1.5} />;
      case 'chats': return <HaloMessageIcon size={36} color="#FF6600" strokeWidth={1.5} />;
      // Cambiamos HaloOptionsIcon por un icono de usuario (person-circle-outline)
// Ajustamos el tamaño a 36 y usamos el mismo color
      case 'perfil': return <Ionicons name="person-outline" size={28} color="#FF6600" />;      
      case 'historias': return <HaloCameraIcon size={36} color="#FF6600" strokeWidth={1.5} />;
      default: return null;
    }
  };

  return (
    <View style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }}>
      {getIcono()}
    </View>
  );
}