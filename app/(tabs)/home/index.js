import { useEffect, useState } from 'react';
import { FlatList, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ComentariosModal from '../../../components/home/ComentariosModal';
import CrearPost from '../../../components/home/CrearPost';
import Post from '../../../components/home/Post';
import { escucharPostsMuro } from '../../../services/firebaseService';

export default function App() {
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState([]);
  const [cargandoPosts, setCargandoPosts] = useState(true);
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [postSeleccionado, setPostSeleccionado] = useState(null);

  useEffect(() => {
    const unsub = escucharPostsMuro(
      (items) => {
        setPosts(items);
        setCargandoPosts(false);
      },
      (error) => {
        console.log('Error escuchando posts:', error?.message || error);
        setCargandoPosts(false);
      }
    );
    return () => unsub();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        data={posts}
        keyExtractor={(item, index) => String(item.postId || item.id || `tmp-${index}`)}
        renderItem={({ item }) => (
          <Post
            post={item}
            onComentar={(post) => {
              setPostSeleccionado(post);
              setMostrarComentarios(true);
            }}
          />
        )}
        ListHeaderComponent={<CrearPost />}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(100, insets.bottom + 86) }]}
        keyboardShouldPersistTaps="handled"
        windowSize={3}              // Mantiene menos ítems en RAM (pantalla + 1 arriba/abajo)
        initialNumToRender={3}      // Renderizado inicial ligero
        maxToRenderPerBatch={2}     // Procesa el renderizado en bloques pequeños
        updateCellsBatchingPeriod={50}
      />

      <ComentariosModal
        visible={mostrarComentarios}
        onClose={() => setMostrarComentarios(false)}
        post={posts.find((p) => (p.id || p.postId) === (postSeleccionado?.id || postSeleccionado?.postId)) || postSeleccionado}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingTop: 10, paddingBottom: 20 },
  estadoWrap: { paddingVertical: 24, alignItems: 'center', justifyContent: 'center' },
  estadoTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  estadoTxt: { marginTop: 8, fontSize: 14, color: '#6B7280' }
});

/*const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 20
  },
  estadoWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estadoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  estadoTxt: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  }
});*/