import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { Alert, StyleSheet, Text, TouchableOpacity, View, DeviceEventEmitter } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { actualizarEstadoOnline } from '../../services/firebaseService';
import { clearAllCachesAndListeners } from '../../services/feedState';
import {
  HaloSearchIcon,
  HaloAddIcon,
  HaloSettingsIcon,
  HaloFriendsIcon,
  HaloLogoutIcon
} from '../icons/HaloIcons';

export default function MenuOpciones({ onClose, onOpenAmigos, perfil }) {
  const router = useRouter();
  const [soporteUnread, setSoporteUnread] = useState(0);

  useEffect(() => {
    const miUid = auth.currentUser?.uid;
    if (!miUid) return;

    const chatRef = doc(db, 'chats', `soporte_${miUid}`);
    const unsub = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const count = data[miUid]?.unreadCount || data.unreadCountUser || (data.ultimoMensajeDe !== miUid && data.leido === false ? 1 : 0);
        setSoporteUnread(count);
      } else {
        setSoporteUnread(0);
      }
    });

    return () => unsub();
  }, []);

  const handleCerrarSesion = () => {
    Alert.alert('Cerrar sesion', 'Quieres cerrar sesion en este dispositivo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesion',
        style: 'destructive',
        onPress: async () => {
          try {
            const uid = auth.currentUser?.uid;
            if (uid) {
              actualizarEstadoOnline(uid, false).catch(e => console.log("Error status online:", e));
            }
            // 1. Limpiamos la memoria y desconectamos listeners antes de borrar el token
            clearAllCachesAndListeners();
            // 2. Destruimos la sesión
            await signOut(auth);
            onClose?.();
            router.replace({ pathname: '/', params: { loggedOut: '1' } });
          } catch (error) {
            console.error("Error al cerrar sesion:", error);
            Alert.alert('Error', 'No se pudo cerrar la sesion correctamente. Intentalo de nuevo.');
          }
        },
      },
    ]);
  };

  const opciones = [
    {
      label: 'Buscar',
      Icon: HaloSearchIcon,
      onPress: () => {
        onClose?.();
        router.push('/buscar');
      }
    },
    {
      label: 'Sugerencias y Soporte',
      Icon: (props) => <Ionicons name="chatbubbles-outline" size={props.size} color={props.color || '#374151'} />,
      iconColor: '#FF6600',
      badge: soporteUnread,
      onPress: () => {
        onClose?.();
        router.push('/soporte-chat');
      }
    },
    {
      label: 'Ajustes y Ayuda',
      Icon: HaloSettingsIcon,
      onPress: () => {
        onClose?.();
        router.push('/ajustes');
      }
    },
    {
      label: 'Amigos',
      Icon: HaloFriendsIcon,
      onPress: () => {
        onClose?.();
        DeviceEventEmitter.emit('OPEN_AMIGOS_DESAFIO', false);
      }
    },
    {
      label: `Huellitas ${perfil?.partido || 'Merlo'}`,
      Icon: (props) => <Ionicons name="paw" size={props.size} color="#10B981" />,
      iconColor: '#10B981',
      onPress: () => {
        onClose?.();
        router.push('/huellitas');
      }
    },
    {
      label: 'Cerrar sesion',
      Icon: HaloLogoutIcon,
      iconColor: '#FF6600',
      textColor: '#1F2937',
      onPress: handleCerrarSesion,
    },
  ];

  return (
    <View style={styles.menuContainer}>
      {opciones.map((opcion, index) => (
        <TouchableOpacity key={index} style={styles.opcionItem} onPress={opcion.onPress || onClose}>
          <View style={[styles.iconoBox, opcion.iconColor === '#10B981' && { backgroundColor: '#ECFDF5' }]}>
            <opcion.Icon size={24} color={opcion.iconColor || '#374151'} strokeWidth={1.2} />
            {opcion.badge > 0 && (
              <View style={styles.badgeSoporte}>
                <Text style={styles.badgeSoporteTxt}>{opcion.badge}</Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.texto, opcion.textColor ? { color: opcion.textColor } : null]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {opcion.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  badgeSoporte: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF6600',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeSoporteTxt: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  texto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center'
  }
});
