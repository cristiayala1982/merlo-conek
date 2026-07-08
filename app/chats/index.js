import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebaseConfig';
import { escucharListaChats } from '../../services/firebaseService';

export default function ListaChatsScreen() {
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsub = escucharListaChats((data) => {
      setChats(data);
      setCargando(false);
    });
    return () => unsub();
  }, []);

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6600" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mensajes</Text>
      </View>

      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatItem}
            onPress={() => router.push({
                pathname: `/chat/${item.id}`,
                params: { otherUserId: item.participantes.find(p => p !== auth.currentUser?.uid) }
            })}
          >
            <Image source={{ uri: item.otroUser?.fotoUrl || 'https://picsum.photos/100' }} style={styles.avatar} />
            <View style={styles.content}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.otroUser?.nombre || 'Usuario'}</Text>
                <Text style={styles.time}>{formatTime(item.lastUpdate)}</Text>
              </View>
              <Text style={styles.lastMsg} numberOfLines={1}>{item.lastMessage}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={60} color="#EEE" />
            <Text style={styles.emptyText}>No tienes conversaciones activas.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { padding: 20, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chatItem: { flexDirection: 'row', padding: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  avatar: { width: 55, height: 55, borderRadius: 27.5, marginRight: 15 },
  content: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  time: { fontSize: 12, color: '#9CA3AF' },
  lastMsg: { fontSize: 14, color: '#6B7280' },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#9CA3AF', fontSize: 16, marginTop: 10 }
});
