import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

const { width } = Dimensions.get('window');
const AD_WIDTH = (width - 40) / 2;

const AdItem = ({ logo, title, category, rating }) => {
  const handlePress = () => {
    // En una app real, aquí abriríamos el link de Play Store
    // Por ahora solo simulamos
    console.log(`Abrir Play Store para: ${title}`);
  };

  return (
    <TouchableOpacity style={styles.adItem} onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.headerAd}>
        <Image source={{ uri: logo }} style={styles.adLogo} />
        <View style={styles.adBadge}><Text style={styles.adBadgeText}>Ad</Text></View>
      </View>

      <View style={styles.adInfo}>
        <Text style={styles.adTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.adCategory} numberOfLines={1}>{category}</Text>

        <View style={styles.ratingRow}>
          <Text style={styles.ratingText}>{rating}</Text>
          <Ionicons name="star" size={12} color="#F59E0B" />
          <View style={styles.dot} />
          <Text style={styles.sizeText}>Gratis</Text>
        </View>

        <TouchableOpacity style={styles.installBtn} onPress={handlePress}>
          <Text style={styles.installBtnText}>Instalar</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default function CardNativeAd() {
  return (
    <View style={styles.container}>
      <View style={styles.topHeader}>
        <Text style={styles.sugerenciaText}>Sugerencias para ti</Text>
        <Ionicons name="ellipsis-horizontal" size={16} color="#9CA3AF" />
      </View>

      <View style={styles.adsRow}>
        <AdItem
          logo="https://cdn-icons-png.flaticon.com/512/3670/3670051.png"
          title="WhatsApp"
          category="Mensajería"
          rating="4.3"
        />
        <AdItem
          logo="https://cdn-icons-png.flaticon.com/512/3046/3046121.png"
          title="TikTok"
          category="Entretenimiento"
          rating="4.5"
        />
      </View>

      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingTop: 15,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  sugerenciaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  adItem: {
    width: AD_WIDTH,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 1,
  },
  headerAd: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  adLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  adBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  adInfo: {
    flex: 1,
  },
  adTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  adCategory: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#374151',
    marginRight: 2,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#9CA3AF',
    marginHorizontal: 6,
  },
  sizeText: {
    fontSize: 11,
    color: '#6B7280',
  },
  installBtn: {
    backgroundColor: '#0561FC', // Azul clásico de Google Play
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  installBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  divider: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#D1D5DB',
  },
});
