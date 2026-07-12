import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import MensajeTexto from './MensajeTexto';
import AudioMensaje from './AudioMensaje';

export default function BurbujaMensaje({ item, esMio, hora, onPlayAudio, onEndedAudio, playingId }) {
  const renderContenido = () => {
    switch (item.tipo) {
      case 'audio':
        return (
          <AudioMensaje
            uri={item.url}
            id={item.id}
            isPlaying={playingId === item.id}
            onPlay={onPlayAudio}
            onEnded={onEndedAudio}
          />
        );
      case 'texto':
      default:
        return <MensajeTexto texto={item.text} esMio={esMio} hora={hora} />;
    }
  };

  return (
    <View style={[styles.filaMensaje, esMio ? styles.filaPropia : styles.filaAjena]}>
      {!esMio && (
        <Image
          source={{ uri: item.userPhoto || 'https://picsum.photos/200' }}
          style={styles.mensajeAvatarGrande}
        />
      )}
      <View style={styles.contenedorBurbuja}>
        {renderContenido()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filaMensaje: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 6 },
  filaPropia: { justifyContent: 'flex-end' },
  filaAjena: { justifyContent: 'flex-start' },
  mensajeAvatarGrande: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EEE', marginRight: 8 },
  contenedorBurbuja: {
    maxWidth: '75%',
  }
});
