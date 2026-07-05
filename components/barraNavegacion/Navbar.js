import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Image, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebaseConfig';
import { obtenerPerfilUsuario } from '../../services/firebaseService';
import ContenedorHistorias from '../historias/ContenedorHistorias';
import { HaloBrandIcon } from './halo-brand-icon';
import { HaloCameraIcon } from './halo-camera-icon';
import { HaloBellIcon, HaloMessageIcon, HaloOptionsIcon } from './halo-nav-icons';
import IconoContextual from './IconoContextual';
import MenuOpciones from './MenuOpciones';

export function Navbar({ closeSignal = 0 }) {
  const router = useRouter();
  const pathname = usePathname();
  const [seccionActiva, setSeccionActiva] = useState(null);
  const [mostrarHistorias, setMostrarHistorias] = useState(false);
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const [mensaje, setMensaje] = useState(false);
  const [perfil, setPerfil] = useState(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = obtenerPerfilUsuario(uid, (data) => {
      setPerfil(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setMostrarHistorias(false);
    setMostrarMenu(false);
  }, [closeSignal]);

  useEffect(() => {
    setMostrarHistorias(false);
    setMostrarMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mostrarHistorias || mostrarMenu) {
        setMostrarHistorias(false);
        setMostrarMenu(false);
        return true;
      }

      if (pathname !== '/') {
        setSeccionActiva(null);
        router.replace('/');
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [mostrarHistorias, mostrarMenu, pathname, router]);

  const navegar = (ruta, seccion) => {
    setSeccionActiva(seccion);
    router.push(ruta);
  };

  const recargarHome = () => {
    setMensaje(true);
    setTimeout(() => setMensaje(false), 2000);
    setSeccionActiva('home');
    setMostrarHistorias(false);
    setMostrarMenu(false);
    router.push(`/(tabs)/home?refresh=${Date.now()}`);
  };

  const cerrarOverlay = () => {
    setMostrarHistorias(false);
    setMostrarMenu(false);
  };

  return (
    <View style={styles.container}>
      {/* Toast de recarga */}
      {mensaje && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>Recargando pantalla...</Text>
        </View>
      )}

      <View style={styles.navbar}>
        <TouchableOpacity style={styles.logoWrap} onPress={recargarHome}>
          <HaloBrandIcon size={52} />
        </TouchableOpacity>

        <View style={styles.rightIcons}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navegar('/(tabs)/notificaciones', 'notificaciones')}>
            <HaloBellIcon size={40} color="#333" strokeWidth={1.15} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.iconButton} onPress={() => navegar('/chats', 'chats')}>
            <HaloMessageIcon size={40} color="#333" strokeWidth={1.15} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileCircle} onPress={() => navegar('/(tabs)/perfil', 'perfil')}>
            {perfil?.fotoUrl ? (
              <Image source={{ uri: perfil.fotoUrl }} style={styles.profileImage} />
            ) : (
              <Ionicons name="person" size={26} color="#FFFFFF" />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => {
              setSeccionActiva('historias');
              setMostrarHistorias((prev) => !prev);
              setMostrarMenu(false);
            }}
          >
            <HaloCameraIcon size={40} color="#333" strokeWidth={1.15} />
          </TouchableOpacity>

          <View style={styles.reservedSpace}>
            <IconoContextual seccion={seccionActiva} />
          </View>
          
          <TouchableOpacity style={styles.iconButton} onPress={() => {
              setMostrarMenu(!mostrarMenu);
              setMostrarHistorias(false);
          }}>
            {mostrarMenu ? (
              <Ionicons name="close" size={34} color="#333" />
            ) : (
              <HaloOptionsIcon size={40} color="#333" strokeWidth={1.15} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {(mostrarHistorias || mostrarMenu) && (
        <View style={styles.overlayContainer}>
          {mostrarHistorias && (
            <View style={styles.dropdownPanel}>
              <ContenedorHistorias />
              <View style={styles.historiasFooter}>
                <Pressable style={styles.historiasCloseBtn} onPress={cerrarOverlay}>
                  <Text style={styles.historiasCloseTxt}>Cerrar</Text>
                </Pressable>
              </View>
            </View>
          )}

          {mostrarMenu && (
            <View style={styles.dropdownPanel}>
              <MenuOpciones onClose={cerrarOverlay} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', zIndex: 2000, position: 'relative' },
  navbar: { height: 54, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  overlayContainer: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    zIndex: 4000,
    elevation: 20,
  },
  dropdownPanel: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    elevation: 2,
  },
  historiasFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
  },
  historiasCloseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  historiasCloseTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  toast: { position: 'absolute', top: '150%', alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: 15, borderRadius: 20, zIndex: 5000 },
  toastText: { color: '#FFF', fontWeight: 'bold' },
  logoWrap: { width: 58, height: 58, justifyContent: 'center', alignItems: 'center' },
  rightIcons: { flexDirection: 'row', flex: 1, justifyContent: 'space-around', alignItems: 'center' },
  profileCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FF6600',
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22
  },
  iconButton: { padding: 4 },
  reservedSpace: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }
});
