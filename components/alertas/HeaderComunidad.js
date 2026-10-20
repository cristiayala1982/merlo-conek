import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function HeaderComunidad({ perfil, clima }) {
  return (
    <View style={styles.headerComunidadScroll}>
      <View style={styles.locInfo}>
        <Ionicons name="location-sharp" size={18} color="#111827" />
        <Text style={styles.textoUbicacionNegro}>
          {perfil?.provincia?.toUpperCase() || 'BUENOS AIRES'}, {perfil?.localidad?.toUpperCase() || 'MERLO'}
        </Text>
      </View>

      {clima && (
        <View style={styles.climaInfoBox}>
          <Ionicons name={clima.icon} size={20} color="#F97316" />
          <Text style={styles.climaTemp}>
            {clima.temp}°{clima.ciudad && clima.ciudad.toLowerCase() !== (perfil?.localidad || 'merlo').toLowerCase() ? ` (${clima.ciudad})` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerComunidadScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20,
    marginBottom: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  locInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  textoUbicacionNegro: {
    marginLeft: 8,
    fontSize: 17,
    fontWeight: '900',
    color: '#111827'
  },
  climaInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5'
  },
  climaTemp: {
    marginLeft: 8,
    fontSize: 17,
    fontWeight: 'bold',
    color: '#F97316'
  }
});
