import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

/**
 * CardNativeAd - Formato de Post Publicitario Híbrido Infalible
 * Combina un caparazón React puro (cabecera y botón verde) con el componente estable
 * BannerAd (MEDIUM_RECTANGLE o LARGE_BANNER en modo compacto) para simular el anuncio.
 * Soporta la propiedad opcional `compact={true}` para adaptarse a la altura de 1 fila de tarjetas en cuadrícula (~200px).
 */

const adUnitId = __DEV__ ? TestIds.BANNER : 'ca-app-pub-3940256099942544/6300978111';

function CardNativeAd({ compact = false }) {
  const adSize = compact ? BannerAdSize.LARGE_BANNER : BannerAdSize.MEDIUM_RECTANGLE;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>

      {/* Tarjeta Unificada Estilo Post Orgánico Premium */}
      <View style={[styles.mainCard, compact && styles.mainCardCompact]}>

        {/* Encabezado del Post */}
        <View style={[styles.headerInfo, compact && styles.headerInfoCompact]}>
          <View style={styles.headerTextColumn}>
            <Text style={[styles.companyNameText, compact && styles.companyNameTextCompact]}>Comercio Patrocinado</Text>
            <View style={styles.rowBadge}>
              <View style={styles.badgeAnuncio}>
                <Text style={styles.badgeText}>Anuncio</Text>
              </View>
              <Text style={styles.publicidadText}>• Publicidad</Text>
            </View>
          </View>
        </View>

        {!compact && (
          <Text style={styles.adDescriptionText}>
            Descubre las mejores ofertas y servicios destacados de nuestra comunidad de Merlo.
          </Text>
        )}

        {/* Sección Central del Anuncio */}
        <View style={[styles.adContentWrapper, compact && styles.adContentWrapperCompact]}>
          <BannerAd
            unitId={adUnitId}
            size={adSize}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
            onAdFailedToLoad={(error) => console.log('Error Google Ad Híbrido:', error)}
          />
        </View>

        {/* Pie de Tarjeta: Botón Horizontal Verde */}
        <View style={styles.footerAction}>
          <TouchableOpacity style={[styles.fullWidthButton, compact && styles.fullWidthButtonCompact]} activeOpacity={0.8}>
            <Text style={[styles.buttonText, compact && styles.buttonTextCompact]}>Saber Más</Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* Línea Divisoria Estética del Feed (solo en modo estándar) */}
      {!compact && <View style={styles.feedDivider} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  containerCompact: {
    paddingTop: 2,
    paddingBottom: 2,
  },
  mainCard: {
    width: '94%', // Alineado simétricamente con los posts ordinarios
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 16,
    paddingHorizontal: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  mainCardCompact: {
    width: '98%',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    elevation: 2,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerInfoCompact: {
    marginBottom: 6,
  },
  headerTextColumn: {
    flex: 1,
  },
  companyNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  companyNameTextCompact: {
    fontSize: 13,
    marginBottom: 2,
  },
  rowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeAnuncio: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#F59E0B',
  },
  badgeText: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '700',
  },
  publicidadText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginLeft: 6,
  },
  adDescriptionText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  adContentWrapper: {
    width: '100%',
    height: 260,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 15,
  },
  adContentWrapperCompact: {
    height: 110, // Perfecto para LARGE_BANNER (320x100)
    borderRadius: 10,
    marginBottom: 8,
  },
  footerAction: {
    width: '100%',
  },
  fullWidthButton: {
    backgroundColor: '#10B981',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullWidthButtonCompact: {
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  buttonTextCompact: {
    fontSize: 13,
  },
  feedDivider: {
    height: 8,
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EEEEEE',
    marginTop: 15,
  },
});

export default React.memo(CardNativeAd);
