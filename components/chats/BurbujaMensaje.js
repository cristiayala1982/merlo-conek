import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS
} from 'react-native-reanimated';
import MensajeTexto from './MensajeTexto';
import AudioMensaje from './AudioMensaje';
import MediaMensaje from './MediaMensaje';
import MensajeHistoria from './MensajeHistoria';
import MensajeCompartido from './MensajeCompartido';
import MensajeUbicacion from './MensajeUbicacion';

export default function BurbujaMensaje({
  item,
  esMio,
  hora,
  onPlayAudio,
  onEndedAudio,
  playingId,
  onLongPress,
  onSwipeReply,
  onReplyPress,
  isHighlighted,
  showUserPhoto
}) {
  const translateX = useSharedValue(0);
  const hasTriggered = useSharedValue(false);

  const onGestureEvent = (event) => {
    'worklet';
    const x = event.nativeEvent.translationX;
    // Solo permitimos deslizar hacia la derecha y con un límite razonable
    if (x > 0 && x < 120) {
      translateX.value = x;
    }
  };

  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.CANCELLED) {
      // Disparamos la mención al SOLTAR si pasó el umbral
      if (translateX.value > 45 && onSwipeReply) {
        runOnJS(onSwipeReply)(item);
      }

      // Regreso ultra rápido y limpio
      translateX.value = withSpring(0, {
        damping: 15,
        stiffness: 250,
        mass: 0.5
      });
      hasTriggered.value = false;
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(translateX.value > 45 ? 1 : 0.6) }],
    opacity: withSpring(translateX.value > 20 ? 1 : 0),
    position: 'absolute',
    left: -40,
  }));

  const renderContenido = () => {
    if (item.deletedForAll) {
      return (
        <Animated.View style={animatedStyle}>
          <MensajeTexto
            texto="Este mensaje fue eliminado"
            esMio={esMio}
            hora={hora}
            isDeleted={true}
            replyTo={item.replyTo}
            onReplyPress={onReplyPress}
            leido={item.leido}
            isHighlighted={isHighlighted}
            onLongPress={() => onLongPress(item)}
            reacciones={item.reacciones}
            showUserPhoto={showUserPhoto}
            userPhoto={item.userPhoto}
            userName={item.user}
          />
        </Animated.View>
      );
    }

    switch (item.tipo) {
      case 'audio':
        return (
          <Animated.View style={animatedStyle}>
            <AudioMensaje
              uri={item.url}
              id={item.id}
              isPlaying={playingId === item.id}
              onPlay={onPlayAudio}
              onEnded={onEndedAudio}
              esMio={esMio}
              hora={hora}
              replyTo={item.replyTo}
              onLongPress={() => onLongPress(item)}
              onReplyPress={onReplyPress}
              leido={item.leido}
              userPhoto={item.userPhoto}
              isHighlighted={isHighlighted}
              reacciones={item.reacciones}
            />
          </Animated.View>
        );
      case 'foto':
      case 'video':
        return (
          <Animated.View style={animatedStyle}>
            <MediaMensaje
              item={item}
              esMio={esMio}
              hora={hora}
              onLongPress={() => onLongPress(item)}
              leido={item.leido}
              replyTo={item.replyTo}
              onReplyPress={onReplyPress}
              isHighlighted={isHighlighted}
              showUserPhoto={showUserPhoto}
            />
          </Animated.View>
        );
      case 'historia_reply':
        return (
          <Animated.View style={animatedStyle}>
            <MensajeHistoria
              item={item}
              esMio={esMio}
              hora={hora}
              leido={item.leido}
              onLongPress={() => onLongPress(item)}
              isHighlighted={isHighlighted}
            />
          </Animated.View>
        );
      case 'compartido':
        return (
          <Animated.View style={animatedStyle}>
            <MensajeCompartido
              data={item.compartidoData}
              esMio={esMio}
              hora={hora}
              onLongPress={() => onLongPress(item)}
              reacciones={item.reacciones}
            />
          </Animated.View>
        );
      case 'ubicacion':
        return (
          <Animated.View style={animatedStyle}>
            <MensajeUbicacion
              coords={item.coords}
              esMio={esMio}
              hora={hora}
              leido={item.leido}
              userPhoto={item.userPhoto}
              showUserPhoto={showUserPhoto}
              isHighlighted={isHighlighted}
              onLongPress={() => onLongPress(item)}
              reacciones={item.reacciones}
            />
          </Animated.View>
        );
      case 'texto':
      default:
        return (
          <Animated.View style={animatedStyle}>
            <MensajeTexto
              texto={item.deletedForAll ? "Este mensaje fue eliminado" : item.text}
              esMio={esMio}
              hora={hora}
              isDeleted={item.deletedForAll}
              replyTo={item.replyTo}
              onReplyPress={onReplyPress}
              leido={item.leido}
              isHighlighted={isHighlighted}
              onLongPress={() => onLongPress(item)}
              reacciones={item.reacciones}
              showUserPhoto={showUserPhoto}
              userPhoto={item.userPhoto}
              userName={item.user}
            />
          </Animated.View>
        );
    }
  };

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={[-10, 10]}
      failOffsetY={[-30, 30]}
    >
      <View style={[styles.filaMensaje, esMio ? styles.filaPropia : styles.filaAjena]}>
        <View style={styles.contenedorConIcono}>
          <Animated.View style={iconStyle}>
            <Ionicons name="arrow-undo-outline" size={20} color="#FF6600" />
          </Animated.View>
          {renderContenido()}
        </View>
      </View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  filaMensaje: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 2 },
  filaPropia: { justifyContent: 'flex-end', paddingLeft: 50, paddingRight: 12 },
  filaAjena: { justifyContent: 'flex-start', paddingRight: 50, paddingLeft: 12 },
  contenedorConIcono: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
  }
});
