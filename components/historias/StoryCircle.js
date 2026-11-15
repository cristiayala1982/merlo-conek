import React from 'react';
import { Image, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const StoryCircle = ({
  onPress,
  onLongPress,
  image,
  name,
  isSeen = false,
  isUser = false,
  showPlus = false,
  onPlusPress
}) => {
  const graphite = '#4B5563';    // Gris Grafito suave
  const softOrange = '#FF9D5C';  // Naranja más clarito y vibrante
  const lightGray = '#E5E7EB';   // Gris clarito para historias vistas

  // Tamaño imponente pero balanceado (105px)
  const CIRCLE_SIZE = 105;
  const BORDER_WIDTH = 3.5;
  const INNER_SIZE = CIRCLE_SIZE - (BORDER_WIDTH * 2) - 6;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [
          styles.avatarWrap,
          pressed && { opacity: 0.85 }
        ]}
      >
        <View
          style={[
            styles.borderCircle,
            { width: CIRCLE_SIZE, height: CIRCLE_SIZE, borderRadius: CIRCLE_SIZE / 2 },
            isUser
              ? { borderColor: 'transparent', borderWidth: 0 }
              : (isSeen ? { borderColor: lightGray } : { borderColor: softOrange })
          ]}
        >
          <View style={[
            styles.innerCircle,
            { width: INNER_SIZE, height: INNER_SIZE, borderRadius: INNER_SIZE / 2 },
            isUser && { borderWidth: 0 }
          ]}>
            {image ? (
              <Image source={{ uri: image }} style={styles.image} />
            ) : (
              <View style={[styles.placeholder, isUser && styles.userPlaceholder]}>
                <Text style={styles.initials}>
                  {name ? name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {showPlus && (
          <Pressable
            style={[styles.plusBadge, { backgroundColor: graphite }]}
            onPress={onPlusPress}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </Pressable>
        )}
      </Pressable>
      {name && (
        <Text style={styles.name} numberOfLines={1}>
          {isUser ? 'Tu historia' : name}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 125, // Ancho para que entren ~3 y se alineen con el perfil
    marginHorizontal: 4,
  },
  avatarWrap: {
    position: 'relative',
    padding: 2,
  },
  borderCircle: {
    borderWidth: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  userPlaceholder: {
    backgroundColor: '#4B5563',
  },
  initials: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  plusBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  name: {
    fontSize: 12,
    marginTop: 6,
    color: '#374151',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default StoryCircle;
