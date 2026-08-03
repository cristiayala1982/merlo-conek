import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, Image, Pressable, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import BarraProgreso from './BarraProgreso';

const { width } = Dimensions.get('window');

export default function ReproductorHistorias({
  usuario,
  estaActivo,
  irSiguienteUsuario,
  irAnteriorUsuario,
  alCerrar,
  onEliminarHistoria
}) {
  const [idxHistoria, setIdxHistoria] = useState(0);
  const [pausadoManual, setPausadoManual] = useState(false);
  const [videoCargado, setVideoCargado] = useState(false);
  const [duracionVideo, setDuracionVideo] = useState(5000);

  const historias = usuario?.stories || [];
  const actual = historias[idxHistoria];
  const siguiente = historias[idxHistoria + 1];

  const esFoto = actual?.type === 'foto';

  // REPRODUCTOR A: índices PARES
  const playerA = useVideoPlayer(idxHistoria % 2 === 0 ? actual?.url : (siguiente?.type === 'video' ? siguiente?.url : null), (p) => {
    p.loop = false;
  });

  // REPRODUCTOR B: índices IMPARES
  const playerB = useVideoPlayer(idxHistoria % 2 !== 0 ? actual?.url : (siguiente?.type === 'video' ? siguiente?.url : null), (p) => {
    p.loop = false;
  });

  const reproductorActivo = idxHistoria % 2 === 0 ? playerA : playerB;

  useEffect(() => {
    if (!estaActivo) {
      playerA.pause();
      playerB.pause();
      return;
    }

    if (esFoto) {
      playerA.pause();
      playerB.pause();
    } else if (reproductorActivo) {
      if (!pausadoManual) {
        reproductorActivo.play();
      } else {
        reproductorActivo.pause();
      }
    }
  }, [estaActivo, pausadoManual, reproductorActivo, esFoto, idxHistoria]);

  useEffect(() => {
    if (!estaActivo) return;

    if (esFoto) {
      setDuracionVideo(5000);
      setVideoCargado(true);
    } else if (reproductorActivo) {
      const subStatus = reproductorActivo.addListener('statusChange', (event) => {
        if (event.status === 'readyToPlay') {
          setVideoCargado(true);
          if (reproductorActivo.duration > 0) {
            setDuracionVideo(reproductorActivo.duration * 1000);
          }
        }
      });

      const subEnd = reproductorActivo.addListener('playToEnd', () => {
        irSiguiente();
      });

      return () => {
        subStatus.remove();
        subEnd.remove();
      };
    }
  }, [estaActivo, idxHistoria, esFoto, reproductorActivo]);

  const irSiguiente = () => {
    if (idxHistoria < historias.length - 1) {
      setVideoCargado(false);
      setIdxHistoria(idxHistoria + 1);
    } else {
      irSiguienteUsuario();
    }
  };

  const irAnterior = () => {
    setVideoCargado(false);
    if (idxHistoria > 0) {
      setIdxHistoria(idxHistoria - 1);
    } else {
      irAnteriorUsuario();
    }
  };

  if (!usuario) return null;

  return (
    <View style={styles.container}>
      {/* CAPA 1: LQ (Carga instantánea) */}
      {actual?.thumbnailLqUrl && (
        <Image
          source={{ uri: actual.thumbnailLqUrl }}
          style={StyleSheet.absoluteFill}
          blurRadius={5}
        />
      )}

      {/* CAPA 2: Miniatura Normal (Escudo de carga) */}
      {actual?.thumbnailUrl && !videoCargado && (
        <Image
          source={{ uri: actual.thumbnailUrl }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* CAPA 3: Contenido Real */}
      <View style={StyleSheet.absoluteFill}>
        {esFoto ? (
          <Image
            source={{ uri: actual.url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <VideoView
            player={reproductorActivo}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
        )}

        {/* Capa de Toques e Interacción */}
        <Pressable
          style={styles.capaToques}
          onPress={(evt) => {
            if (!estaActivo) return;
            evt.nativeEvent.locationX < width / 3 ? irAnterior() : irSiguiente();
          }}
          onLongPress={() => setPausadoManual(true)}
          onPressOut={() => setPausadoManual(false)}
        />
      </View>

      <BarraProgreso
        historias={historias}
        idxHistoria={idxHistoria}
        estaActivo={estaActivo}
        pausadoManual={pausadoManual}
        videoCargado={videoCargado}
        duracionVideo={duracionVideo}
        onTiempoCompleto={irSiguiente}
      />

      {/* Cabecera del Usuario */}
      <View style={styles.header}>
        <Image source={{ uri: usuario.userPhotoUrl || 'https://picsum.photos/100' }} style={styles.avatar} />
        <Text style={styles.username}>{usuario.userName}</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={alCerrar}>
          <Ionicons name="close" size={30} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  capaToques: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  header: {
    position: 'absolute',
    top: 60,
    left: 15,
    right: 15,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'white' },
  username: { color: 'white', fontWeight: 'bold', marginLeft: 10, fontSize: 14, flex: 1 },
  closeBtn: { padding: 5 }
});
