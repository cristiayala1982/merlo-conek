import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * BarraProgreso - Optimización de Fluidez y Sincronización Total
 * Garantiza que los segmentos anteriores se llenen al 100% y el actual sea suave.
 */
export default function BarraProgreso({
  historias,
  idxHistoria,
  estaActivo,
  pausadoManual,
  videoCargado,
  duracionVideo,
  onTiempoCompleto
}) {
  const insets = useSafeAreaInsets();
  const progresoAnim = useRef(new Animated.Value(0)).current;
  const progresoAcumulado = useRef(0);
  const animacionRef = useRef(null);

  // CONTROL DE ANIMACIÓN PARA EL SEGMENTO ACTIVO
  useEffect(() => {
    // Si pasamos a otra historia, reseteamos progreso
    if (!estaActivo) {
      progresoAnim.setValue(0);
      progresoAcumulado.current = 0;
      if (animacionRef.current) animacionRef.current.stop();
      return;
    }

    if (!videoCargado) {
      if (animacionRef.current) animacionRef.current.stop();
      return;
    }

    const duracionFinal = duracionVideo > 0 ? duracionVideo : 5000;

    if (pausadoManual) {
      // Al pausar, detenemos y NO reseteamos nada
      if (animacionRef.current) animacionRef.current.stop();
      // stopAnimation devuelve el valor actual, lo guardamos para luego
      progresoAnim.stopAnimation((value) => {
        progresoAcumulado.current = value;
        progresoAnim.setValue(value); // Clavamos la barra en ese valor visualmente
      });
    } else {
      // Al reanudar (o iniciar), partimos estrictamente desde el progreso guardado
      const tiempoRestante = duracionFinal * (1 - progresoAcumulado.current);

      // Reiniciamos la animación asegurándonos de que arranque desde donde se quedó
      progresoAnim.setValue(progresoAcumulado.current);

      animacionRef.current = Animated.timing(progresoAnim, {
        toValue: 1,
        duration: tiempoRestante,
        useNativeDriver: false,
      });

      animacionRef.current.start(({ finished }) => {
        if (finished && onTiempoCompleto) {
          onTiempoCompleto();
        }
      });
    }
  }, [estaActivo, pausadoManual, videoCargado, duracionVideo, idxHistoria]);

  // RESETEO FORZADO AL CAMBIAR DE HISTORIA
  useEffect(() => {
    progresoAnim.setValue(0);
    progresoAcumulado.current = 0;
  }, [idxHistoria]);

  useEffect(() => {
    return () => {
      if (animacionRef.current) animacionRef.current.stop();
    };
  }, []);

  return (
    <View style={[styles.fondoSuperior, { height: Math.max(115, insets.top + 60) }]}>
      <View style={[styles.contenedorBarras, { top: Math.max(50, insets.top + 15) }]}>
        {historias.map((_, i) => {
          // LÓGICA DE SINCRONIZACIÓN BLINDADA:

          if (i < idxHistoria) {
            // SEGMENTOS PASADOS: Siempre 100% blanco (estático, sin transformaciones)
            return (
              <View key={i} style={styles.fondoBarra}>
                <View style={[styles.rellenoBarra, { width: '100%' }]} />
              </View>
            );
          } else if (i === idxHistoria) {
            // SEGMENTO ACTUAL: Animado suavemente y exacto (sin matematicas con errores de offset)
            return (
              <View key={i} style={styles.fondoBarra}>
                <Animated.View
                  style={[
                    styles.rellenoBarra,
                    {
                      width: progresoAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%']
                      })
                    }
                  ]}
                />
              </View>
            );
          } else {
            // SEGMENTOS FUTUROS: Siempre 0% (vaciós)
            return (
              <View key={i} style={styles.fondoBarra}>
                <View style={[styles.rellenoBarra, { width: '0%' }]} />
              </View>
            );
          }
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fondoSuperior: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  contenedorBarras: {
    position: 'absolute',
    left: 10,
    right: 10,
    flexDirection: 'row',
    gap: 5,
  },
  fondoBarra: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 2,
    overflow: 'hidden'
  },
  rellenoBarra: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 2,
  }
});
