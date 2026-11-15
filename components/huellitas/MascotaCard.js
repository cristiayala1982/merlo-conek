import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 10) / 2;

/**
 * COMPONENTE DE TARJETA PARA MASCOTAS (HUELLITAS)
 * Diseño unificado basado en Clasificados.
 */
const MascotaCard = ({ item, onPress, miUid, onLike, onMore, onShare }) => {
  const mainPhoto = item.fotos?.[0] || item.foto;
  const esPerdido = item.estado === 'perdido';
  const esEncontrado = item.estado === 'encontrado';
  const esAdopcion = item.estado === 'adopcion';
  const esReencuentro = item.estado === 'reencuentro';

  let colorEstado = '#6B7280';
  let labelEstado = 'Mascota';
  if (esPerdido) { colorEstado = '#EF4444'; labelEstado = 'SE PERDIÓ'; }
  if (esEncontrado) { colorEstado = '#3B82F6'; labelEstado = 'VISTO'; }
  if (esAdopcion) { colorEstado = '#10B981'; labelEstado = 'EN ADOPCIÓN'; }
  if (esReencuentro) { colorEstado = '#8B5CF6'; labelEstado = '¡REENCUENTRO!'; }

  const likes = item.likes || [];
  const loLikee = miUid && likes.includes(miUid);
  const esMio = item.userId === miUid;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => onPress(item)}>
      <View style={styles.imageContainer}>
        {mainPhoto ? (
          <Image
            source={{ uri: mainPhoto }}
            style={[styles.cardImage, esReencuentro && { opacity: 0.8 }]}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="paw-outline" size={40} color="#D1D5DB" />
          </View>
        )}

        {/* BADGE DE ESTADO */}
        <View style={[styles.estadoBadge, { backgroundColor: colorEstado }]}>
          <Text style={styles.estadoBadgeText}>{labelEstado}</Text>
        </View>

        {/* CORAZÓN FLOTANTE SI ES REENCUENTRO */}
        {esReencuentro && (
          <View style={styles.reencuentroOverlay}>
             <Ionicons name="heart" size={30} color="white" />
          </View>
        )}

        {/* BOTÓN MÁS OPCIONES */}
        <TouchableOpacity style={styles.cardMoreBtn} onPress={(e) => { e.stopPropagation(); onMore(item); }}>
          <Ionicons name="ellipsis-vertical" size={18} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.nombre || 'Sin nombre'}</Text>

        <View style={styles.locationContainer}>
          <View style={styles.barrioRow}>
            <Ionicons name="location" size={12} color="#10B981" />
            <Text style={styles.cardBarrio} numberOfLines={1}>
              {item.provincia ? `${item.provincia}, ` : ''}{item.partido || item.localidad || ''}{item.localidad && item.partido ? `, ${item.localidad}` : ''}
            </Text>
          </View>
          {item.barrio ? <Text style={styles.cardProvincia} numberOfLines={1}>({item.barrio})</Text> : null}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.userRowMini}>
            {item.userPhoto ? (
              <Image source={{ uri: item.userPhoto }} style={styles.userAvatarMini} transition={100} />
            ) : (
              <View style={styles.userAvatarPlaceholderMini}>
                <Ionicons name="person" size={12} color="#9CA3AF" />
              </View>
            )}
            <View style={{ flex: 1 }}>
               <Text style={styles.userNameMini} numberOfLines={1}>{item.userName}</Text>
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.cardActionBtn} onPress={(e) => { e.stopPropagation(); onLike(item); }}>
              <Ionicons name={loLikee ? "heart" : "heart-outline"} size={22} color={loLikee ? "#FF6600" : "#6B7280"} />
              {likes.length > 0 && <Text style={[styles.likeCount, loLikee && { color: "#FF6600" }]}>{likes.length}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cardActionBtn} onPress={(e) => { e.stopPropagation(); onShare(item); }}>
              <Ionicons name="share-social-outline" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: ITEM_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  imageContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#F9FAFB',
    position: 'relative'
  },
  cardImage: {
    width: '100%',
    height: '100%'
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6'
  },
  estadoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    elevation: 2,
    zIndex: 10
  },
  estadoBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '900'
  },
  reencuentroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5
  },
  cardMoreBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  cardContent: {
    padding: 8
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827'
  },
  barrioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4
  },
  cardBarrio: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '700',
    flex: 1
  },
  cardProvincia: {
    fontSize: 11,
    color: '#6B7280',
    marginLeft: 16,
    marginTop: -1,
    fontWeight: '700'
  },
  locationContainer: {
    marginTop: 4,
    marginBottom: 2
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
  },
  userRowMini: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4
  },
  userAvatarMini: {
    width: 26,
    height: 26,
    borderRadius: 13
  },
  userAvatarPlaceholderMini: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  userNameMini: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '900',
    flex: 1
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  likeCount: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 'bold'
  }
});

export default React.memo(MascotaCard);
