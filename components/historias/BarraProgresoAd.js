import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';

/**
 * BarraProgresoAd - Componente independiente para el tiempo de los anuncios
 * @param {boolean} activa - Si el progreso debe estar corriendo
 * @param {boolean} pausada - Si el usuario tiene el dedo apoyado (pausa)
 * @param {number} duracion - Tiempo en ms (por defecto 5000ms)
 * @param {function} alFinalizar - Función a ejecutar cuando termina el tiempo
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
    if (!activa) {
      progreso.setValue(0);
      progresoAcumulado.current = 0;
      return;
    }

    if (pausada) {
      // Si se pausa, detenemos la animación y guardamos por donde iba
      progreso.stopAnimation((v) => {
        progresoAcumulado.current = v;
      });
    } else {
      // Si se activa o reanuda, lanzamos la animación desde donde quedó
      const tiempoRestante = duracion * (1 - progresoAcumulado.current);

      animacionRef.current = Animated.timing(progreso, {
        toValue: 1,
        duration: tiempoRestante,
        useNativeDriver: false, // Necesario para animar width/flex
      });

      animacionRef.current.start(({ finished }) => {
        if (finished && alFinalizar) {
          alFinalizar();
        }
      });
    }

    return () => {
      if (animacionRef.current) animacionRef.current.stop();
    };
  }, [activa, pausada, duracion]);

  return (
    <View style={styles.container}>
      <View style={styles.fondoBarra}>
        <Animated.View
          style={[
            styles.progresoBarra,
            {
              flex: progreso // Usamos el valor animado para llenar el ancho
            }
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '92%',
    height: 3,
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 5,
    marginBottom: 5,
  },
  fondoBarra: {
    flex: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  progresoBarra: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  }
});
