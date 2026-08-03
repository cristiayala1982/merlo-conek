import React from 'react';
import { Image, StyleSheet, Text, View, Pressable } from 'react-native';

const StoryCircle = ({
  onPress,
  onLongPress,
  image,
  name,
  isSeen = false,
  isUser = false,
  showPlus = false,
  onPlusPress,
  children
}) => {
  const graphite = '#374151'; // Graphite Gray
  const orange = '#F97316';   // Brand Orange
  const lightGray = '#D1D5DB'; // Seen Gray

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [
          styles.avatarWrap,
          pressed && { opacity: 0.8 }
        ]}
      >
        <View
          style={[
            styles.borderCircle,
            isUser ? styles.noBorder : (isSeen ? { borderColor: lightGray } : { borderColor: orange })
            // Note: For the "orange mixed with graphite" we might need a more complex style or just use these two.
            // If the user wants a literal mix, we can try to use a gradient or just a specific color.
          ]}
        >
          <View style={styles.innerCircle}>
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
            <Text style={styles.plusText}>+</Text>
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
    width: 78,
    marginHorizontal: 4,
  },
  avatarWrap: {
    position: 'relative',
    padding: 3,
  },
  borderCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noBorder: {
    borderWidth: 0,
  },
  innerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    borderWidth: 1.5,
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
    backgroundColor: '#E5E7EB',
  },
  userPlaceholder: {
    backgroundColor: '#374151',
  },
  initials: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  plusBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: -1,
  },
  name: {
    fontSize: 11,
    marginTop: 4,
    color: '#374151',
    textAlign: 'center',
  },
});

export default StoryCircle;
