import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import ComentariosModal from '../components/home/ComentariosModal';
import Post from '../components/home/Post';
import { auth, db } from '../firebaseConfig';
import { obtenerPerfilUsuario } from '../services/firebaseService';

export default function PostDetalleScreen() {
  const insets = useSafeAreaInsets();
  const { postId, abrirComentarios, commentId, collectionName } = useLocalSearchParams();
  const targetCollection = collectionName || 'posts';
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [miPerfil, setMiPerfil] = useState(null);
  const [mostrarComentarios, setMostrarComentarios] = useState(false);

  useEffect(() => {
    if (!postId) {
      setLoading(false);
      return;
    }

    if (abrirComentarios === 'true') {
      setMostrarComentarios(true);
    }

    // ESCUCHA EN TIEMPO REAL DEL POST
    const unsubPost = onSnapshot(doc(db, targetCollection, postId), (snap) => {
      if (snap.exists()) {
        setPost({ id: snap.id, ...snap.data(), collectionName: targetCollection });
      } else {
        setPost(null);
      }
      setLoading(false);
    }, (error) => {
      console.log("Error cargando post:", error);
      setLoading(false);
    });

    const uid = auth.currentUser?.uid;
    let unsubPerfil = () => {};
    if (uid) {
      unsubPerfil = obtenerPerfilUsuario(uid, (data) => {
        setMiPerfil(data);
      });
    }

    return () => {
      unsubPost();
      unsubPerfil();
    };
  }, [postId, abrirComentarios, commentId]);

  const volverAtras = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home');
    }
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#FF6600" />
    </View>
  );

  if (!post) return (
    <View style={styles.center}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <Ionicons name="alert-circle-outline" size={50} color="#ccc" />
      <Text style={styles.errorText}>Publicación no encontrada.</Text>
      <TouchableOpacity onPress={volverAtras} style={styles.btnVolver}>
        <Text style={styles.textBtn}>Volver atrás</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.mainContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      <View style={styles.headerCustom}>
        <TouchableOpacity onPress={volverAtras} style={styles.btnHeader}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle del Post</Text>
        <View style={styles.espaciador} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Post
          post={post}
          onComentar={() => setMostrarComentarios(true)}
        />
      </ScrollView>

      <ComentariosModal 
        visible={mostrarComentarios} 
        onClose={() => setMostrarComentarios(false)} 
        post={post} 
        collectionName={targetCollection}
        targetCommentId={commentId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
    backgroundColor: '#FFFFFF'
  },
  headerCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  btnHeader: { padding: 5 },
  espaciador: { width: 40 },
  scrollContent: { paddingVertical: 0 },
  errorText: { fontSize: 16, color: '#666', marginVertical: 10 },
  btnVolver: { backgroundColor: '#FF6600', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 30 },
  textBtn: { color: 'white', fontWeight: 'bold' }
});
