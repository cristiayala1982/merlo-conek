import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Navbar } from '../../components/barraNavegacion/Navbar';
export default function RootLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.layoutContainer}>
      <Navbar />
      <View style={styles.contentContainer}>
        <Slot />
      </View>
      <View style={[styles.bottomSystemBar, { height: Math.max(0, insets.bottom) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  layoutContainer: { 
    flex: 1, 
    backgroundColor: '#000000',
    paddingTop: 40 // Gestión del área del notch/barra de estado
  },
  contentContainer: {
    flex: 1, // Asegura que el contenido ocupe el resto de la pantalla
    backgroundColor: '#FFFFFF',
  },
  bottomSystemBar: {
    width: '100%',
    backgroundColor: '#000000',
  },
});