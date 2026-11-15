import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * BarraProgresoAd - Versión con Reseteo por Montaje (Key Refresh)
 * Confía en que el padre la destruye y crea de nuevo para reiniciar.
 */
export default function BarraProgresoAd({
  activa = true,
  pausada = false,
  duracion = 5000,
  alFinalizar
}) {
  const progreso = useRef(new Animated.Value(0)).current;
  const progresoAcumulado = useRef(0);
  const animacionRef = useRef(null);

  useEffect(() => {
    // Si no está activa (por ejemplo, mientras carga la página), no hacemos nada
    if (!activa) return;

    if (pausada) {
      // Si se pausa, frenamos la animación y guardamos el valor actual
      progreso.stopAnimation((v) => {
        progresoAcumulado.current = v;
      });
    } else {
      // Calculamos cuánto tiempo le falta según lo que ya avanzó
      const tiempoRestante = duracion * (1 - progresoAcumulado.current);

      animacionRef.current = Animated.timing(progreso, {
        toValue: 1,
        duration: tiempoRestante,
        useNativeDriver: true, // GPU activada para fluidez total
      });

      animacionRef.current.start(({ finished }) => {
        if (finished && alFinalizar) {
          alFinalizar();
        }
      });
    }

    // Al desmontarse (cuando cambiamos de página), detenemos todo
    return () => {
      if (animacionRef.current) animacionRef.current.stop();
    };
  }, [activa, pausada, duracion]);

  // Estilo de transformación para escalado desde el centro simulando Instagram
  const transformStyle = {
    transform: [
      { translateX: -SCREEN_WIDTH / 2 },
      { scaleX: progreso },
      { translateX: SCREEN_WIDTH / 2 }
    ]
  };

  return (
    <View style={styles.container}>
      <View style={styles.fondoBarra}>
        <Animated.View style={[styles.progresoBarra, transformStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '92%',
    height: 3,
    alignSelf: 'center',
    marginTop: 5,
    marginBottom: 5,
    overflow: 'hidden',
  },
  fondoBarra: {
    flex: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progresoBarra: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  }
});
