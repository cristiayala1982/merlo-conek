import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export default function BarraProgreso({
  historias,
  idxHistoria,
  estaActivo,
  pausadoManual,
  videoCargado,
  duracionVideo,
  onTiempoCompleto
}) {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!estaActivo || !videoCargado || pausadoManual) {
      progressAnim.stopAnimation();
      return;
    }

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: duracionVideo * (1 - progressAnim._value), // Continuar desde donde estaba
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        onTiempoCompleto();
      }
    });

  }, [idxHistoria, estaActivo, pausadoManual, videoCargado, duracionVideo]);

  useEffect(() => {
    // Resetear barra al cambiar de historia
    progressAnim.setValue(0);
  }, [idxHistoria]);

  return (
    <View style={styles.container}>
      {historias.map((_, i) => {
        let width = '0%';
        if (i < idxHistoria) width = '100%';
        if (i === idxHistoria) {
          return (
            <View key={i} style={styles.backgroundBar}>
              <Animated.View
                style={[
                  styles.fillBar,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    })
                  }
                ]}
              />
            </View>
          );
        }
        return (
          <View key={i} style={styles.backgroundBar}>
            <View style={[styles.fillBar, { width }]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    flexDirection: 'row',
    zIndex: 100,
  },
  backgroundBar: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 2,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fillBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  }
});
