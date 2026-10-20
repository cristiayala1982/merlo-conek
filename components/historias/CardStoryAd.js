import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions, Pressable } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

/**
 * CardStoryAd - Componente de Anuncio a Pantalla Completa para Historias
 * Simula una historia orgánica intercalada cada 3 usuarios.
 * Permite saltar el anuncio tocando el lateral derecho o cerrar todo con la 'X'.
 */

const adUnitId = __DEV__ ? TestIds.BANNER : 'ca-app-pub-3940256099942544/6300978111';

export default function CardStoryAd({ onSkip, onClose }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>

      {/* Fondo oscuro de seguridad */}
      <View style={StyleSheet.absoluteFill} backgroundColor="#000" />

      {/* ÁREA TÁCTIL PARA SALTAR (Lado Derecho) */}
      <Pressable
        style={styles.skipTouchArea}
        onPress={onSkip}
        activeOpacity={1}
      />

      {/* Encabezado Superior (Estilo Merlo Conek) */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 10, 50) }]}>
        <View style={styles.headerContent}>
          <View style={styles.badgeAnuncio}>
            <Text style={styles.badgeText}>Anuncio</Text>
          </View>
          <Text style={styles.publicidadText}>• Patrocinado</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={32} color="white" />
        </TouchableOpacity>
      </View>

      {/* Cuerpo Central: Anuncio de Google AdMob Rectangular Grande */}
      <View style={styles.body}>
        <View style={styles.adWrapper}>
          <BannerAd
            unitId={adUnitId}
            size={BannerAdSize.MEDIUM_RECTANGLE} // 300x250: el formato más rentable y estable para móvil
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
            onAdFailedToLoad={(error) => console.log('Error Google Ad en Historias:', error)}
          />
        </View>
        <Text style={styles.description}>
          Contenido recomendado por Merlo Conek. Pulsa el botón para conocer más detalles.
        </Text>
      </View>

      {/* Pie de Página: Botón de Acción Verde Premium */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}>
        <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Saber Más</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  skipTouchArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: width * 0.7, // 70% derecho para saltar
    zIndex: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    zIndex: 100,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeAnuncio: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#F59E0B',
  },
  badgeText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '700',
  },
  publicidadText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    marginLeft: 8,
  },
  closeBtn: {
    padding: 8,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  adWrapper: {
    backgroundColor: '#111',
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
    padding: 10,
    marginBottom: 20,
    elevation: 5,
  },
  description: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 25,
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: '#10B981',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
