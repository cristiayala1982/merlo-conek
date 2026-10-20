import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { obtenerPerfilUsuario } from '../../services/firebaseService';
import CardAlerta from '../../components/alertas/CardAlerta';
import HeaderComunidad from '../../components/alertas/HeaderComunidad';
import CrearPost from '../../components/home/CrearPost';
import * as Location from 'expo-location';
import { Navbar } from '../../components/barraNavegacion/Navbar';

export default function AlertasIndex() {
  const insets = useSafeAreaInsets();
  const [alertas, setAlertas] = useState([]);
  const [miPerfil, setMiPerfil] = useState(null);
  const [clima, setClima] = useState({ temp: '--', icon: 'sunny', ciudad: '' });
  const [filtro, setFiltro] = useState('todo'); // 'todo', 'alertas', 'general'

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      obtenerPerfilUsuario(uid, setMiPerfil);
    }

    // Escuchar filtros desde la Navbar
    const subFilter = DeviceEventEmitter.addListener('SET_COMMUNITY_FILTER', (type) => {
      setFiltro(type);
    });

    return () => subFilter.remove();
  }, []);

  useEffect(() => {
    if (!miPerfil?.localidad) return;

    let q = query(
      collection(db, 'alertas_comunitarias'),
      where('provincia', '==', miPerfil.provincia),
      where('localidad', '==', miPerfil.localidad),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    // Aplicar filtros si no es 'todo'
    if (filtro === 'alertas') {
      q = query(q, where('tipo', '==', 'Alerta'));
    } else if (filtro === 'general') {
      q = query(q, where('tipo', '==', 'General'));
    }

    const unsub = onSnapshot(q, (snap) => {
      setAlertas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [miPerfil, filtro]);

  useEffect(() => {
    const fetchClima = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({});
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.coords.latitude}&longitude=${loc.coords.longitude}&current_weather=true`);
        const data = await res.json();
        if (data.current_weather) {
          const geo = await Location.reverseGeocodeAsync(loc.coords);
          setClima({
            temp: Math.round(data.current_weather.temperature),
            icon: 'partly-sunny',
            ciudad: geo[0]?.city || geo[0]?.subregion || ""
          });
        }
      } catch (e) { console.log(e); }
    };
    fetchClima();
  }, []);

  return (
    <View style={styles.container}>
      <Navbar />
      <FlatList
        data={alertas}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CardAlerta item={item} />}
        ListHeaderComponent={
          <CrearPost
            modoAlertas={true}
            bloquearAlertas={!miPerfil?.localidad}
            clima={clima}
            perfil={miPerfil}
          />
        }
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingTop: 12 },
});
