import { router } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const handleRegister = async () => {
    try {
      setLoading(true);
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanEmail || !password) {
        Alert.alert('Faltan datos', 'Ingresa correo y contraseña.');
        setLoading(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: cleanEmail,
        createdAt: serverTimestamp(),
      });


      setLoading(false);
      router.replace('/(tabs)/home'); 
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo registrar el usuario.');
      setLoading(false);
    }
  };

  const canContinue = email.trim().length > 0 && password.length > 0 && !loading;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Text style={styles.brandName}>Merlo Conek</Text>
        </View>

        <Text style={styles.title}>Crea tu cuenta</Text>

        <TextInput 
          style={styles.input} 
          placeholder="Correo electrónico" 
          autoCapitalize="none" 
          keyboardType="email-address"
          autoComplete="email"
          value={email} 
          onChangeText={setEmail}
          editable={!loading}
        />
        <View style={styles.passwordContainer}>
          <TextInput 
            style={styles.passwordInput} 
            placeholder="Contraseña" 
            secureTextEntry={!showPassword}
            value={password} 
            onChangeText={setPassword}
            editable={!loading}
          />
          <Pressable
            style={styles.togglePassword}
            onPress={() => setShowPassword(prev => !prev)}
            disabled={loading}
          >
            <Text style={styles.togglePasswordText}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
          </Pressable>
        </View>
        
        <Pressable 
          style={[styles.button, !canContinue && styles.buttonDisabled]} 
          disabled={!canContinue} 
          onPress={handleRegister}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Registrarse</Text>
          )}
        </Pressable>

        <TouchableOpacity style={styles.registerLink} onPress={() => router.push('/')} disabled={loading}>
          <Text style={styles.registerText}>
            ¿Ya tienes cuenta? <Text style={styles.boldRegister}>Iniciar sesión</Text>
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
  passwordContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  passwordInput: {
    backgroundColor: '#F5F5F5',
    padding: 18,
    borderRadius: 16,
    fontSize: 16,
    color: '#333333',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    paddingRight: 96,
  },
  togglePassword: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  togglePasswordText: {
    color: '#FF6600',
    fontSize: 13,
    fontWeight: '700',
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