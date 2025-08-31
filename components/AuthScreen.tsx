import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { User, FileText, Eye, EyeOff } from 'lucide-react-native';

const favicon = require('../assets/favicon.png');

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'passenger' | 'driver'>('passenger');
  const [userType, setUserType] = useState<'adult' | 'child' | 'student' | 'driver'>('adult');
  const [documentNumber, setDocumentNumber] = useState('');

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase().replace(/\s+/g, '');
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

    if (!normalizedEmail || !password || (!isLogin && (!fullName || !documentNumber))) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }
    if (!validEmail) {
      Alert.alert('Error', 'El correo no tiene un formato válido');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await signIn(normalizedEmail, password);
        if (error) Alert.alert('Error', error.message);
      } else {
        const effectiveUserType =
          role === 'driver' ? 'driver' : userType; // ver nota 3 abajo
        const { error } = await signUp(
          normalizedEmail,
          password,
          fullName,
          role,
          effectiveUserType,
          documentNumber
        );
        if (error) {
          // Log más detallado para depurar
          console.log('SignUp error:', JSON.stringify(error, null, 2));
          Alert.alert('Error', error.message);
        } else {
          Alert.alert('Éxito', 'Cuenta creada exitosamente');
          setIsLogin(true);
        }
      }
    } catch (e: any) {
      console.log('Unexpected error:', e);
      Alert.alert('Error', 'Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image source={favicon} style={{
          width: 64, height: 64, borderRadius: 16
        }} />
        <Text style={styles.title}>Jichi Pay</Text>
        <Text style={styles.subtitle}>
          {isLogin ? 'Inicia sesión' : 'Crear cuenta'}
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCorrect={false}
          autoCapitalize="none"
          onBlur={() => {
            const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
            if (!ok) Alert.alert('Correo inválido', 'Revisa el formato del correo');
          }}
        />

        <View style={styles.passwordWrapper}>
          <TextInput
            style={[styles.input, { paddingRight: 48 }]}
            placeholder="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity
            accessible
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onPress={() => setShowPassword((prev) => !prev)}
            style={styles.eyeButton}
          >
            {showPassword ? <EyeOff size={24} color="#64748b" style={{ marginBottom: 16 }} /> : <Eye size={24} color="#64748b" style={{ marginBottom: 16 }} />}
          </TouchableOpacity>
        </View>


        {!isLogin && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Nombre completo"
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={styles.label}>Tipo de usuario</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[styles.roleButton, role === 'passenger' && styles.roleButtonActive]}
                onPress={() => setRole('passenger')}
              >
                <User size={20} color={role === 'passenger' ? '#fff' : '#266441'} />
                <Text style={[styles.roleText, role === 'passenger' && styles.roleTextActive]}>
                  Pasajero
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleButton, role === 'driver' && styles.roleButtonActive]}
                onPress={() => setRole('driver')}
              >
                <FileText size={20} color={role === 'driver' ? '#fff' : '#266441'} />
                <Text style={[styles.roleText, role === 'driver' && styles.roleTextActive]}>
                  Conductor
                </Text>
              </TouchableOpacity>
            </View>

            {role === 'passenger' && (
              <>
                <Text style={styles.label}>Categoría</Text>
                <View style={styles.categoryContainer}>
                  {['adult', 'student', 'child'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.categoryButton, userType === type && styles.categoryButtonActive]}
                      onPress={() => setUserType(type as any)}
                    >
                      <Text style={[styles.categoryText, userType === type && styles.categoryTextActive]}>
                        {type === 'adult' ? 'Adulto' : type === 'student' ? 'Estudiante' : 'Niño'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TextInput
              style={styles.input}
              placeholder={
                role === 'driver'
                  ? 'Número de licencia'
                  : userType === 'student'
                    ? 'Carnet de estudiante'
                    : 'Carnet de identidad'
              }
              value={documentNumber}
              onChangeText={setDocumentNumber}
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Cargando...' : isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => setIsLogin(!isLogin)}
        >
          <Text style={styles.switchButtonText}>
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#266441',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#64748b',
    marginTop: 8,
  },
  form: {
    paddingHorizontal: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  passwordWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#266441',
    backgroundColor: '#fff',
  },
  roleButtonActive: {
    backgroundColor: '#266441',
  },
  roleText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#266441',
  },
  roleTextActive: {
    color: '#fff',
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  categoryButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  categoryButtonActive: {
    backgroundColor: '#266441',
    borderColor: '#266441',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  categoryTextActive: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#266441',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  switchButtonText: {
    color: '#266441',
    fontSize: 16,
    fontWeight: '500',
  },
});