import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, Image, Dimensions } from 'react-native';
import PagerView from 'react-native-pager-view';
import { getStoriesCache, setShouldOpenStories } from '../../services/storiesState';
import { marcarUsuarioHistoriaComoVista } from '../../services/firebaseService';
import { auth } from '../../firebaseConfig';
import ReproductorHistorias from '../../components/historias/ReproductorHistorias';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { BackHandler } from 'react-native';

const { width } = Dimensions.get('window');

export default function HistoriasViewerPerfilScreen() {
  const { userId, storyId } = useLocalSearchParams();
  const router = useRouter();

  const usuariosConHistorias = getStoriesCache();
  const initialIdx = usuariosConHistorias.findIndex(u => u.userId === userId);
  const [idxUsuarioActual, setIdxUsuarioActual] = useState(Math.max(0, initialIdx));
  const pagerRef = useRef(null);

  useEffect(() => {
    const backAction = () => {
      cerrar();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [idxUsuarioActual]);

  const cerrar = () => {
    const uActual = usuariosConHistorias[idxUsuarioActual];
    if (uActual?.userId) marcarUsuarioHistoriaComoVista(uActual.userId);

    // LÓGICA ESPECÍFICA: Siempre volver al perfil
    // Quitamos setShouldOpenStories para que en el perfil NO se abra el barral al volver
    if (userId && userId !== auth.currentUser?.uid) {
      router.replace({ pathname: '/(tabs)/perfilAjeno', params: { userId: userId } });
    } else {
      router.replace('/(tabs)/perfil');
    }
  };

  if (usuariosConHistorias.length === 0) return null;

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
                {estaCerca ? (
                  <View style={{ flex: 1, overflow: 'hidden', backgroundColor: 'black' }}>
                    <ReproductorHistorias usuario={usuario} estaActivo={esElQueVeo} initialStoryId={esElQueVeo ? storyId : null}
                      irSiguienteUsuario={() => index < usuariosConHistorias.length - 1 ? pagerRef.current?.setPage(index + 1) : cerrar()}
                      irAnteriorUsuario={() => index > 0 && pagerRef.current?.setPage(index - 1)}
                      alCerrar={cerrar} />
                  </View>
                ) : <View style={{ flex: 1, backgroundColor: 'black' }} />}
              </View>
            );
          })}
        </PagerView>
      </View>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  pager: { flex: 1 },
  page: { flex: 1, backgroundColor: 'black' }
});
