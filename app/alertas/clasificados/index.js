import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Navbar } from '../../../components/barraNavegacion/Navbar';

export default function ClasificadosIndex() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Navbar />

      <View style={styles.header}>
        <Text style={styles.title}>Clasificados y Oficios</Text>
        <Text style={styles.subtitle}>Encontrá trabajo o publicá tu servicio</Text>
      </View>

      <FlatList
        data={[]}
        keyExtractor={(item) => item.id}
        renderItem={null}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Próximamente: Lista de oficios y ofertas laborales.</Text>
          </View>
        }
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 22, fontWeight: '900', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  scrollContent: { paddingTop: 12 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', textAlign: 'center', fontSize: 16 }
});
