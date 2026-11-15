import { router } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [aceptaTerminos, setAceptaTerminos] = useState(false);

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
      const uid = userCredential.user.uid;
      const defaultName = cleanEmail.split('@')[0] || 'Vecino';

      // Escribir perfil inicial correcto en la colección 'usuarios' (no 'users')
      await setDoc(doc(db, 'usuarios', uid), {
        nombre: defaultName,
        email: cleanEmail,
        fotoUrl: null,
        provincia: 'Buenos Aires',
        partido: 'Merlo',
        localidad: 'Merlo',
        barrio: '',
        bio: 'Vecino de Merlo Conektad@',
        online: true,
        siguiendo: [],
        bloqueados: [],
        createdAt: serverTimestamp(),
      });

      setLoading(false);
      router.replace('/(tabs)/home'); 
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo registrar el usuario.');
      setLoading(false);
    }
  };

  const canContinue = email.trim().length > 0 && password.length > 0 && aceptaTerminos && !loading;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Text style={styles.brandName}>
            Merlo Cone<Text style={{ color: '#4B5563' }}>K</Text>tad@
          </Text>
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

        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setAceptaTerminos(!aceptaTerminos)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={aceptaTerminos ? "checkbox" : "square-outline"}
            size={24}
            color={aceptaTerminos ? "#FF6600" : "#9CA3AF"}
          />
          <Text style={styles.checkboxText}>
            He leído y acepto los <Text style={styles.linkText} onPress={(e) => { e.stopPropagation(); router.push('/politica-privacidad'); }}>Términos de Uso y Privacidad</Text> de Merlo Conektad@.
          </Text>
        </TouchableOpacity>

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
    padding: 30,
    paddingTop: 80,
    paddingBottom: 380,
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: -5,
    paddingRight: 20
  },
  checkboxText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    flex: 1
  },
  linkText: {
    color: '#FF6600',
    fontWeight: 'bold',
  },
  button: {
    marginTop: 15,
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