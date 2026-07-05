import { StyleSheet, Text, View } from 'react-native';

export default function PerfilAjenoScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perfil ajeno</Text>
      <Text style={styles.subtitle}>Aqui va tu logica para ver perfiles de otros usuarios.</Text>
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
