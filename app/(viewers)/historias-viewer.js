import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, Image, Dimensions, DeviceEventEmitter, Text, TouchableOpacity } from 'react-native';
import PagerView from 'react-native-pager-view';
import { getStoriesCache, setShouldOpenStories, markLocalSeen, setStoriesCache } from '../../services/storiesState';
import { marcarUsuarioHistoriaComoVista, obtenerHistoriasGrupales } from '../../services/firebaseService';
import ReproductorHistorias from '../../components/historias/ReproductorHistorias';
import CardStoryAd from '../../components/historias/CardStoryAd';
import { KeyboardProvider } from 'react-native-keyboard-controller';

const { width } = Dimensions.get('window');

export default function HistoriasViewerScreen() {
  const { userId, thumbRapido, storyId, retornoRuta } = useLocalSearchParams();
  const router = useRouter();

  const [usuariosConHistorias, setUsuariosConHistorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [idxUsuarioActual, setIdxUsuarioActual] = useState(0);
  const pagerRef = useRef(null);

  /**
   * Función para inyectar un anuncio cada 3 usuarios reales (Regla 3+1)
   */
  const inyectarPublicidad = (lista) => {
    const nuevaLista = [];
    let contadorReales = 0;

    lista.forEach((usuario, index) => {
      nuevaLista.push(usuario);
      contadorReales++;

      // Cada 3 usuarios reales, inyectamos un objeto virtual de anuncio
      if (contadorReales % 3 === 0) {
        nuevaLista.push({
          userId: `ad-${index}`,
          isAd: true,
          userName: 'Publicidad'
        });
      }
    });
    return nuevaLista;
  };

  useEffect(() => {
    const cache = getStoriesCache();

    if (cache.length > 0 && cache.some(u => u.userId === userId)) {
      const listaConPublicidad = inyectarPublicidad(cache);
      setUsuariosConHistorias(listaConPublicidad);

      // Encontramos la posición inicial en la nueva lista con anuncios
      const initialIdx = listaConPublicidad.findIndex(u => u.userId === userId);
      setIdxUsuarioActual(Math.max(0, initialIdx));
      setCargando(false);
    } else if (userId) {
      cargarUsuarioIndividual(userId);
    } else {
      setCargando(false);
    }
  }, [userId]);

  const cargarUsuarioIndividual = async (id) => {
    try {
      const data = await obtenerHistoriasGrupales([id]);
      if (data && data.length > 0) {
        // Para usuario individual no inyectamos publicidad para no interrumpir
        setUsuariosConHistorias(data);
        setIdxUsuarioActual(0);
      }
    } catch (e) {
      console.error("Error al cargar historia individual:", e);
    } finally {
      setCargando(false);
    }
  };

  const cerrar = () => {
    const uActual = usuariosConHistorias[idxUsuarioActual];
    if (uActual?.userId && !uActual.isAd) {
      marcarUsuarioHistoriaComoVista(uActual.userId);
      markLocalSeen(uActual.userId);
    }

    setUsuariosConHistorias([]);

    if (retornoRuta) {
      router.navigate(retornoRuta);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home');
    }
  };

  // Cuando cambiamos de usuario en el Pager, marcamos el anterior como visto (si no es anuncio)
  useEffect(() => {
    if (usuariosConHistorias.length > 0) {
      const prevIdx = idxUsuarioActual - 1;
      if (prevIdx >= 0 && usuariosConHistorias[prevIdx] && !usuariosConHistorias[prevIdx].isAd) {
        marcarUsuarioHistoriaComoVista(usuariosConHistorias[prevIdx].userId);
      }
    }
  }, [idxUsuarioActual, usuariosConHistorias]);

  if (cargando) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#FF6600" />
      </View>
    );
  }

  if (usuariosConHistorias.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: 'white' }}>La historia ya no está disponible</Text>
        <TouchableOpacity onPress={cerrar} style={styles.btnVolver}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardProvider>
      <View style={styles.container}>
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={idxUsuarioActual}
          onPageSelected={(e) => setIdxUsuarioActual(e.nativeEvent.position)}
          offscreenPageLimit={1}
          overScrollMode="never"
          pageMargin={0}
          layoutDirection="ltr"
        >
          {usuariosConHistorias.map((usuario, index) => {
            const esElQueVeo = index === idxUsuarioActual;
            const estaCerca = Math.abs(index - idxUsuarioActual) <= 1;

            return (
              <View key={usuario.userId} style={styles.page}>
                {estaCerca && (
                  usuario.isAd ? (
                    <CardStoryAd
                      estaActiva={esElQueVeo}
                      onSkip={() => {
                        if (index < usuariosConHistorias.length - 1) {
                          pagerRef.current?.setPage(index + 1);
                        } else {
                          cerrar();
                        }
                      }}
                      onClose={cerrar}
                    />
                  ) : (
                    <ReproductorHistorias
                      usuario={usuario}
                      estaActivo={esElQueVeo}
                      initialStoryId={esElQueVeo ? storyId : null}
                      irSiguienteUsuario={() => {
                        if (index < usuariosConHistorias.length - 1) {
                          pagerRef.current?.setPage(index + 1);
                        } else {
                          cerrar();
                        }
                      }}
                      irAnteriorUsuario={() => {
                        if (index > 0) {
                          pagerRef.current?.setPage(index - 1);
                        }
                      }}
                      alCerrar={cerrar}
                    />
                  )
                )}
                {!estaCerca && <View style={{ flex: 1, backgroundColor: 'black' }} />}
              </View>
            );
          })}
        </PagerView>
      </View>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black', overflow: 'hidden' },
  center: { justifyContent: 'center', alignItems: 'center' },
  pager: { flex: 1, backgroundColor: 'black', overflow: 'hidden' },
  page: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'black'
  },
  btnVolver: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#333',
    borderRadius: 10
  }
});
