import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, NativeModules, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { HaloBrandIcon } from '../../../components/icons/HaloIcons';
import { auth } from '../../../firebaseConfig';
import { aceptarSolicitudAmistad, eliminarNotificacion, escucharNotificaciones, marcarNotificacionLeida, rechazarSolicitudAmistad } from '../../../services/firebaseService';

export default function NotificacionesScreen() {
  const router = useRouter();
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoIds, setProcesandoIds] = useState({});

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsub = escucharNotificaciones(uid, (lista) => {
      setNotificaciones(lista);
      setCargando(false);

      // Limpiar notificaciones de la barra de Android al entrar a esta pestaña
      if (NativeModules.NotificationHistoryModule) {
        NativeModules.NotificationHistoryModule.clearSocialNotifications();
      }
    });

    return () => unsub();
  }, []);

  const handlePress = async (notif) => {
    if (!notif.leido) {
      await marcarNotificacionLeida(notif.id);
    }

    if (notif.tipo === 'desafio' || (notif.tipo === 'desafio_respuesta' && !notif.postId)) {
      router.replace('/(tabs)/home');
      return;
    }

    if (notif.tipo === 'desafio_completado' && notif.postId) {
      router.push({
        pathname: '/postDetalle',
        params: { postId: notif.postId }
      });
      return;
    }

    if (notif.tipo === 'clasificado_rechazado') return;
    if (notif.tipo === 'producto_market_rechazado') return;

    if (notif.postId) {
        if (notif.collectionName === 'productos_market') {
          router.push({
            pathname: '/(marketplace)/marketDetalle',
            params: { productId: notif.postId }
          });
          return;
        }

      if (notif.collectionName === 'clasificados') {
        router.push({
          pathname: '/alertas/clasificados/detalle',
          params: { postId: notif.postId }
        });
        return;
      }

      // Si el postId contiene un guión bajo, probablemente es un chatId de una reacción o mensaje
      if (typeof notif.postId === 'string' && notif.postId.includes('_')) {
        const partes = notif.postId.split('_');
        const esMarket = notif.postId.includes('_market');
        const otroId = partes.find(id => id !== auth.currentUser?.uid && id !== 'market');
        router.push({
          pathname: '/chats',
          params: { userId: otroId, tipo: esMarket ? 'market' : 'regular' }
        });
      } else {
        // DETERMINAR SI ES POST O ALERTA (Con fallback de seguridad)
        let esAlerta = notif.collectionName === 'alertas_comunitarias';

        // Fallback: Si no tiene collectionName, intentamos deducir por el texto
        if (!notif.collectionName && notif.texto && (notif.texto.includes('aviso comunitario') || notif.texto.includes('alerta'))) {
          esAlerta = true;
        }

        router.push({
          pathname: esAlerta ? '/alertaDetalle' : '/postDetalle',
          params: {
            postId: notif.postId,
            abrirComentarios: notif.comentarioId ? 'true' : 'false',
            commentId: notif.comentarioId || ''
          }
        });
      }
    } else if (notif.deUserId) {
      router.push({
        pathname: '/(tabs)/perfilAjeno',
        params: { userId: notif.deUserId }
      });
    }
  };

  const onAceptar = async (notif) => {
    if (procesandoIds[notif.id]) return;
    setProcesandoIds((prev) => ({ ...prev, [notif.id]: 'aceptando' }));
    try {
      await aceptarSolicitudAmistad(notif.id, notif.deUserId);
    } catch (e) {
      console.log("Error aceptando:", e);
    } finally {
      setProcesandoIds((prev) => ({ ...prev, [notif.id]: null }));
    }
  };

  const onRechazar = async (notif) => {
    if (procesandoIds[notif.id]) return;
    setProcesandoIds((prev) => ({ ...prev, [notif.id]: 'rechazando' }));
    try {
      await rechazarSolicitudAmistad(null, notif.deUserId);
      await eliminarNotificacion(notif.id);
    } catch (e) {
      console.log("Error rechazando:", e);
    } finally {
      setProcesandoIds((prev) => ({ ...prev, [notif.id]: null }));
    }
  };

  const onEliminar = async (notifId) => {
    try {
      await eliminarNotificacion(notifId);
    } catch (e) {
      console.log("Error eliminando notif:", e);
    }
  };

  const renderIcon = (tipo) => {
    switch (tipo) {
      case 'like': return <Ionicons name="heart" size={18} color="#FF6600" />;
      case 'comentario': return <Ionicons name="chatbubble" size={18} color="#4B5563" />;
      case 'amigo': return <Ionicons name="people" size={18} color="#F97316" />;
      case 'solicitud_amistad': return <Ionicons name="person-add" size={18} color="#FF6600" />;
      case 'reaccion_chat': return <Ionicons name="happy" size={18} color="#F97316" />;
      case 'desafio': return <Ionicons name="sparkles" size={18} color="#FF6600" />;
      case 'desafio_respuesta': return <Ionicons name="stats-chart" size={18} color="#3B82F6" />;
      case 'desafio_completado': return <Ionicons name="checkmark-done-circle" size={18} color="#10B981" />;
      case 'post_en_revision': return <Ionicons name="time-outline" size={18} color="#D97706" />;
      case 'post_rechazado': return <Ionicons name="shield" size={18} color="#DC2626" />;
      case 'post_aprobado': return <Ionicons name="checkmark-circle" size={18} color="#10B981" />;
      case 'alerta_en_revision': return <Ionicons name="time-outline" size={18} color="#D97706" />;
      case 'alerta_rechazada': return <Ionicons name="shield" size={18} color="#DC2626" />;
      case 'alerta_aprobada': return <Ionicons name="checkmark-circle" size={18} color="#10B981" />;
      case 'clasificado_en_revision': return <Ionicons name="time-outline" size={18} color="#D97706" />;
      case 'clasificado_rechazado': return <Ionicons name="shield" size={18} color="#DC2626" />;
      case 'clasificado_aprobado': return <Ionicons name="checkmark-circle" size={18} color="#10B981" />;
      case 'producto_market_en_revision': return <Ionicons name="time-outline" size={18} color="#D97706" />;
      case 'producto_market_rechazado': return <Ionicons name="shield" size={18} color="#DC2626" />;
      case 'producto_market_aprobado': return <Ionicons name="checkmark-circle" size={18} color="#10B981" />;
      default: return <Ionicons name="notifications" size={18} color="#999" />;
    }
  };

  const renderNotif = ({ item }) => (
    <View style={[styles.notifWrapper, !item.leido && styles.notifUnread]}>
        <View style={styles.notifMainRow}>
            <TouchableOpacity
              style={styles.notifCard}
              onPress={() => handlePress(item)}
            >
              {item.deFoto ? (
                <Image source={{ uri: item.deFoto }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.brandAvatar]}>
                  <HaloBrandIcon size={36} />
                </View>
              )}
              <View style={styles.content}>
                <Text style={styles.notifText}>
                  <Text style={styles.bold}>{item.deNombre}</Text> {item.texto}
                </Text>
                <Text style={styles.time}>{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Reciente'}</Text>
              </View>
              <View style={styles.iconContainer}>
                {renderIcon(item.tipo)}
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteBtn} onPress={() => onEliminar(item.id)}>
                <Ionicons name="close" size={20} color="#9CA3AF" />
            </TouchableOpacity>
        </View>

        {/* Botones de acción para solicitud de amistad */}
        {item.tipo === 'solicitud_amistad' && (
            <View style={styles.actionsRow}>
              {procesandoIds[item.id] ? (
                <ActivityIndicator size="small" color="#FF6600" style={{ paddingVertical: 4 }} />
              ) : (
                <>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => onAceptar(item)}>
                      <Text style={styles.acceptBtnTxt}>Aceptar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => onRechazar(item)}>
                      <Text style={styles.rejectBtnTxt}>Rechazar</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
        )}
    </View>
  );

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
        <Text style={styles.title}>Notificaciones</Text>
      </View>

      <FlatList
        data={notificaciones}
        keyExtractor={item => item.id}
        renderItem={renderNotif}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={60} color="#EEE" />
            <Text style={styles.emptyText}>No tienes notificaciones aún.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  list: { paddingBottom: 20 },
  notifWrapper: { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  notifMainRow: { flexDirection: 'row', alignItems: 'center' },
  notifCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  deleteBtn: { padding: 15, justifyContent: 'center' },
  notifUnread: { backgroundColor: '#FFF7ED' },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  brandAvatar: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  content: { flex: 1 },
  notifText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  bold: { fontWeight: '700', color: '#111827' },
  time: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  iconContainer: { marginLeft: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#9CA3AF', fontSize: 16, marginTop: 10 },

  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 75, // Alineado con el inicio del texto
    paddingBottom: 15,
    gap: 10
  },
  acceptBtn: {
    backgroundColor: '#FF6600',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8
  },
  acceptBtnTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  rejectBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  rejectBtnTxt: { color: '#333', fontWeight: 'bold', fontSize: 13 }
});
