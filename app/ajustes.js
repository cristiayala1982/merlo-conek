import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AjustesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const opciones = [
    {
      id: 'cuenta',
      titulo: 'Cuenta',
      items: [
        { id: 'perfil', label: 'Editar Perfil', icon: 'person-outline', onPress: () => router.push('/editarPerfil') },
        { id: 'bloqueados', label: 'Usuarios Bloqueados', icon: 'remove-circle-outline' },
      ]
    },
    {
      id: 'ayuda_soporte',
      titulo: 'Ayuda y Soporte',
      items: [
        { id: 'ayuda', label: 'Centro de Ayuda', icon: 'help-circle-outline' },
        { id: 'reportar', label: 'Informar un problema', icon: 'alert-circle-outline' },
        { id: 'politicas', label: 'Políticas de Privacidad', icon: 'document-text-outline' },
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
                >
                  <View style={styles.itemLeft}>
                    <Ionicons name={item.icon} size={22} color="#4B5563" />
                    <Text style={styles.itemLabel}>{item.label}</Text>
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
  versionTxt: { color: '#9CA3AF', fontSize: 12 }
});
