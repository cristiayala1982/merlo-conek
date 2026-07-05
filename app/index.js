import { router, useLocalSearchParams } from 'expo-router';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../firebaseConfig';

export default function LoginScreen() {
  const params = useLocalSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [mostrarToastLogout, setMostrarToastLogout] = useState(false);
  const canContinue = email.trim().length > 0 && password.length > 0 && !loading && !checkingSession;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        router.replace('/(tabs)/home');
      }
      setCheckingSession(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (String(params?.loggedOut || '') !== '1') return;

    setMostrarToastLogout(true);
    const timerId = setTimeout(() => setMostrarToastLogout(false), 1600);

    return () => clearTimeout(timerId);
  }, [params?.loggedOut]);

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      Alert.alert('Faltan datos', 'Ingresa correo y contraseña.');
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {mostrarToastLogout && (
        <View style={styles.toastWrap} pointerEvents="none">
          <Text style={styles.toastText}>Sesion cerrada</Text>
        </View>
      )}

      <StatusBar barStyle="dark-content" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Text style={styles.brandName}>Merlo Conek</Text>
        </View>

        <Text style={styles.title}>Iniciar Sesion</Text>

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="#999"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#999"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />

        <Pressable
          style={[styles.button, !canContinue && styles.buttonDisabled]}
          disabled={!canContinue}
          onPress={handleLogin}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Iniciar sesión</Text>
          )}
        </Pressable>

        <TouchableOpacity 
          style={styles.registerLink} 
          onPress={() => router.push('/registro')}
          disabled={loading}
        >
          <Text style={styles.registerText}>
            ¿No tienes cuenta? <Text style={styles.boldRegister}>Regístrate</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  toastWrap: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    zIndex: 50,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#FF6600',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toastText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 30,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FF6600',
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333333',
    marginBottom: 40,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#F5F5F5',
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#333333',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  button: {
    marginTop: 20,
    backgroundColor: '#FF6600',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#FF6600',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#E0E0E0',
    elevation: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  registerLink: {
    marginTop: 25,
    alignItems: 'center',
  },
  registerText: {
    color: '#666666',
    fontSize: 14,
  },
  boldRegister: {
    color: '#FF6600',
    fontWeight: '700',
  }
});