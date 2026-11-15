import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { auth } from '../../firebaseConfig';
import ListaConversaciones from '../../components/chats/ListaConversaciones';
import ChatDetalle from '../../components/chats/ChatDetalle';

/**
 * PANTALLA RAÍZ DE CHATS
 * Este archivo actúa como enrutador interno:
 * - Si no hay userId en los params, muestra el listado de conversaciones.
 * - Si hay userId, abre el chat específico con ese usuario.
 */
export default function ChatRoot() {
  const { userId } = useLocalSearchParams();
  const miUid = auth.currentUser?.uid;

  // Si no hay sesión, no renderizamos nada (o podrías redirigir)
  if (!miUid) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {!userId ? (
        <ListaConversaciones miUid={miUid} />
      ) : (
        <ChatDetalle userId={userId} miUid={miUid} />
      )}
    </GestureHandlerRootView>
  );
}
