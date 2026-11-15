import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Linking, Alert, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HaloSettingsIcon,
  HaloFriendsIcon,
  HaloBellIcon
} from '../components/icons/HaloIcons';

import { auth } from '../firebaseConfig';
import { eliminarCuentaUsuario } from '../services/firebaseService';
import { clearAllCachesAndListeners } from '../services/feedState';

export default function AjustesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [procesandoBorrado, setProcesandoBorrado] = React.useState(false);

  const handleEliminarCuenta = () => {
    Alert.alert(
      "Eliminar Cuenta",
      "⚠️ ATENCIÓN: Esta acción es IRREVERSIBLE. Se eliminarán permanentemente tu perfil, publicaciones, chats y fotos asociadas a esta cuenta.\n\n¿Estás absolutamente seguro de querer eliminar tu cuenta?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, Eliminar Todo",
          style: "destructive",
          onPress: ejecutarBorradoCuenta
        }
      ]
    );
  };

  const ejecutarBorradoCuenta = async () => {
    try {
      setProcesandoBorrado(true);
      // 1. Desconectar escuchadores y limpiar caché local
      clearAllCachesAndListeners();

      // 2. Borrar documento de usuario y cuenta de Firebase Auth
      const resultado = await eliminarCuentaUsuario();

      if (resultado.success) {
        // 3. Redirigir de inmediato al Login
        router.replace({ pathname: '/', params: { loggedOut: '1' } });
      } else {
        if (resultado.code === "requires-recent-login") {
          Alert.alert(
            "Autenticación Requerida",
            "Por motivos de seguridad, para eliminar tu cuenta debes haber iniciado sesión recientemente.\n\nPor favor, cierra sesión en la app, vuelve a ingresar con tu correo/contraseña y repite este proceso.",
            [{ text: "Entendido", style: "default" }]
          );
        } else {
          Alert.alert("Error", "No se pudo eliminar la cuenta. Verifica tu conexión o intenta más tarde.");
        }
      }
    } catch (error) {
      Alert.alert("Error", "Ocurrió un problema inesperado. Intenta más tarde.");
    } finally {
      setProcesandoBorrado(false);
    }
  };

  const opciones = [
    {
      id: 'cuenta',
      titulo: 'Cuenta',
      items: [
        { id: 'perfil', label: 'Editar Perfil', Icon: HaloFriendsIcon, onPress: () => router.push('/editarPerfil') },
        { id: 'bloqueados', label: 'Usuarios Bloqueados', Icon: HaloSettingsIcon, onPress: () => router.push('/bloqueados') },
        { id: 'eliminar', label: 'Eliminar Cuenta', Icon: HaloSettingsIcon, isDestructive: true, onPress: handleEliminarCuenta },
      ]
    },
    {
      id: 'ayuda_soporte',
      titulo: 'Ayuda y Soporte',
      items: [
        { id: 'ayuda', label: 'Comunícate por Email', Icon: HaloBellIcon, onPress: () => Linking.openURL('mailto:cristianayala10@hotmail.com').catch(() => Alert.alert('Error', 'No se pudo abrir la aplicación de correo.')) },
        { id: 'reportar', label: 'Sugerencias y Soporte', Icon: HaloSettingsIcon, onPress: () => router.push('/soporte-chat') },
        { id: 'politicas', label: 'Políticas de Privacidad', Icon: HaloSettingsIcon, onPress: () => router.push('/politica-privacidad') },
      ]
    }
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajustes y Ayuda</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {opciones.map((seccion) => (
          <View key={seccion.id} style={styles.seccion}>
            <Text style={styles.seccionTitulo}>{seccion.titulo}</Text>
            <View style={styles.itemsContainer}>
              {seccion.items.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.item, index === seccion.items.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={item.onPress}
                  disabled={procesandoBorrado}
                >
                  <View style={styles.itemLeft}>
                    {item.Icon ? (
                      <item.Icon size={24} color={item.isDestructive ? "#EF4444" : "#4B5563"} strokeWidth={1.2} />
                    ) : (
                      <Ionicons name="help-circle-outline" size={22} color={item.isDestructive ? "#EF4444" : "#4B5563"} />
                    )}
                    <Text style={[styles.itemLabel, item.isDestructive && { color: '#EF4444' }]}>{item.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.versionTxt}>Merlo Conek v1.0.0</Text>
        </View>
      </ScrollView>

      {/* MODAL DE CARGA MIENTRAS SE ELIMINA LA CUENTA Y CONTENIDOS */}
      <Modal visible={procesandoBorrado} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#EF4444" />
            <Text style={styles.loadingTitle}>Eliminando cuenta...</Text>
            <Text style={styles.loadingSubtitle}>
              Eliminando tus publicaciones, fotos y datos de la plataforma. Por favor espera.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  backBtn: { padding: 8 },
  content: { flex: 1 },
  seccion: { marginTop: 20, paddingHorizontal: 15 },
  seccionTitulo: { fontSize: 13, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: 8, marginLeft: 5 },
  itemsContainer: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  itemLabel: { marginLeft: 12, fontSize: 16, color: '#1F2937', fontWeight: '500' },
  footer: { padding: 40, alignItems: 'center' },
  versionTxt: { color: '#9CA3AF', fontSize: 12 },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8
  },
  loadingSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18
  }
});
