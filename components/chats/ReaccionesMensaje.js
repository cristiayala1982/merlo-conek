import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ReaccionesMensaje({ reacciones }) {
  if (!reacciones || Object.keys(reacciones).length === 0) return null;

  // Convertimos el objeto de reacciones a una lista de emojis que tienen al menos un voto
  const listaEmojis = Object.entries(reacciones)
    .filter(([_, uids]) => uids.length > 0)
    .map(([emoji]) => emoji);

  if (listaEmojis.length === 0) return null;

  return (
    <View style={styles.container}>
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
    bottom: -12,
    right: 5,
    zIndex: 10,
  },
  bubble: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  emoji: {
    fontSize: 12,
  }
});
