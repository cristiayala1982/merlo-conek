import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ReaccionesMensaje({ reacciones, style }) {
  if (!reacciones || Object.keys(reacciones).length === 0) return null;

  const listaEmojis = Object.entries(reacciones)
    .filter(([_, uids]) => uids.length > 0)
    .map(([emoji]) => emoji);

  if (listaEmojis.length === 0) return null;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.bubble}>
        {listaEmojis.map((emoji, idx) => (
          <Text key={idx} style={styles.emoji}>{emoji}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: -20,
    right: 5,
    zIndex: 10,
  },
  bubble: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 1,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 26,
    minHeight: 24
  },
  emoji: {
    fontSize: 20,
    lineHeight: 22,
  }
});
