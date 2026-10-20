import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { tiempoRelativo } from '../../services/dateUtils';

export default function CardAlerta({ item }) {
  const esUrgente = item.tipo === 'Alerta';

  return (
    <View style={[styles.cardAlerta, !esUrgente && styles.cardGeneral]}>
      <View style={styles.alertaHeader}>
        <Image
          source={{ uri: item.userPhoto || 'https://picsum.photos/100' }}
          style={styles.alertaAvatar}
        />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.alertaUserName}>{item.userName}</Text>
            <Text style={styles.alertaFecha}>
              {item.createdAt?.toDate ? tiempoRelativo(item.createdAt) : 'Ahora'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons
              name={esUrgente ? "warning" : "business"}
              size={14}
              color={esUrgente ? "#EF4444" : "#3B82F6"}
            />
            <Text style={[styles.alertaTipoLabel, { color: esUrgente ? "#EF4444" : "#3B82F6" }]}>
              {item.tipo?.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.alertaTexto}>{item.texto}</Text>

      {item.url && (
        <View style={styles.alertaMediaContainer}>
          <Image source={{ uri: item.url }} style={styles.alertaImagen} contentFit="cover" />
        </View>
      )}

      {item.barrio ? (
        <View style={styles.alertaLoc}>
          <Ionicons name="location" size={14} color="#6B7280" />
          <Text style={styles.alertaLocTxt}>{item.barrio}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardAlerta: {
    backgroundColor: '#FFF5F5',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    elevation: 2
  },
  cardGeneral: {
    backgroundColor: '#F0F7FF',
    borderColor: '#DBEAFE'
  },
  alertaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  alertaAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEE'
  },
  alertaUserName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  alertaFecha: {
    color: '#9CA3AF',
    fontSize: 11
  },
  alertaTipoLabel: {
    fontSize: 10,
    fontWeight: '900',
    marginLeft: 4,
    letterSpacing: 0.5
  },
  alertaTexto: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 22,
    fontWeight: '500'
  },
  alertaMediaContainer: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
    backgroundColor: '#000'
  },
  alertaImagen: {
    width: '100%',
    height: '100%'
  },
  alertaLoc: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 4
  },
  alertaLocTxt: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 'bold'
  }
});
