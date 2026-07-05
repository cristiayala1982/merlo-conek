import { StyleSheet, Text, View } from 'react-native';

export default function NotificacionesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notificaciones</Text>
      <Text style={styles.subtitle}>Aqui veras actividad, likes y mensajes nuevos.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
});
