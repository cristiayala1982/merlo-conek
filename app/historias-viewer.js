import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import PagerView from 'react-native-pager-view';
import { auth } from '../firebaseConfig';
import { obtenerHistoriasGrupales, obtenerPerfilUsuario } from '../services/firebaseService';
import ReproductorHistorias from '../components/historias/ReproductorHistorias';

export default function HistoriasViewerScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();

  const [usuariosConHistorias, setUsuariosConHistorias] = useState([]);
  const [idxUsuarioActual, setIdxUsuarioActual] = useState(0);
  const [cargando, setCargando] = useState(true);

  const pagerRef = useRef(null);

  useEffect(() => {
    const cargarDatos = async () => {
      const miUid = auth.currentUser?.uid;
      if (!miUid) return;

      // Obtenemos los amigos para filtrar
      const { doc, getDoc } = require('firebase/firestore');
      const { db } = require('../firebaseConfig');
      const userSnap = await getDoc(doc(db, 'usuarios', miUid));
      const siguiendo = userSnap.data()?.siguiendo || [];
      const uids = [...siguiendo, miUid];

      const agrupadas = await obtenerHistoriasGrupales(uids);

      // Encontrar el indice inicial basado en el userId que toco el usuario
      const initialIdx = agrupadas.findIndex(u => u.userId === userId);

      setUsuariosConHistorias(agrupadas);
      setIdxUsuarioActual(Math.max(0, initialIdx));
      setCargando(false);
    };

    cargarDatos();
  }, [userId]);

  const cerrar = () => router.back();

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6600" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={idxUsuarioActual}
        onPageSelected={(e) => setIdxUsuarioActual(e.nativeEvent.position)}
      >
        {usuariosConHistorias.map((usuario, index) => (
          <View key={usuario.userId} style={styles.page}>
            <ReproductorHistorias
              usuario={usuario}
              estaActivo={index === idxUsuarioActual}
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
          </View>
        ))}
      </PagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  pager: { flex: 1 },
  page: { flex: 1 },
  center: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }
});
