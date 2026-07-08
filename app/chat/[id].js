import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import ChatRoom from '../../components/chat/ChatRoom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

export default function DynamicChatPage() {
  const { id, otherUserId } = useLocalSearchParams();
  const [otroUser, setOtroUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOtroUser() {
      if (otherUserId) {
        const snap = await getDoc(doc(db, 'usuarios', otherUserId));
        if (snap.exists()) setOtroUser(snap.data());
      }
      setLoading(false);
    }
    fetchOtroUser();
  }, [otherUserId]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF6600" />
      </View>
    );
  }

  return <ChatRoom chatId={id} otroUser={otroUser} />;
}
