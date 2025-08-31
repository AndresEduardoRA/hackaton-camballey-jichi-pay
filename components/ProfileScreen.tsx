import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { ArrowLeft, CreditCard as Edit3, FileText, LogOut, User } from 'lucide-react-native';
import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface ProfileScreenProps {
  user: any;
  onBack: () => void;
}

export default function ProfileScreen({ user, onBack }: ProfileScreenProps) {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            const { error } = await signOut();
            if (error) {
              Alert.alert('Error', 'No se pudo cerrar sesión');
            }
          },
        },
      ]
    );
  };

  const getUserTypeLabel = (userType: string) => {
    switch (userType) {
      case 'adult':
        return 'Adulto';
      case 'child':
        return 'Niño';
      case 'student':
        return 'Estudiante';
      case 'driver':
        return 'Conductor';
      default:
        return userType;
    }
  };

  const getRoleLabel = (role: string) => {
    return role === 'passenger' ? 'Pasajero' : 'Conductor';
  };

  const getDocumentLabel = (userType: string) => {
    switch (userType) {
      case 'student':
        return 'Carnet de Estudiante';
      case 'driver':
        return 'Licencia de Conducir';
      default:
        return 'Carnet de Identidad';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={24} color="#266441" />
        </TouchableOpacity>
        <Text style={styles.title}>Mi Perfil</Text>
        <TouchableOpacity style={styles.editButton} onPress={()=> router.push('/(tabs)')}>
          <Edit3 size={20} color="#266441" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <User size={48} color="#266441" />
          </View>
          <Text style={styles.userName}>{user.full_name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{getRoleLabel(user.role)}</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Información Personal</Text>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Nombre Completo</Text>
            <Text style={styles.infoValue}>{user.full_name}</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Correo Electrónico</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Tipo de Usuario</Text>
            <Text style={styles.infoValue}>{getUserTypeLabel(user.user_type)}</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>{getDocumentLabel(user.user_type)}</Text>
            <Text style={styles.infoValue}>{user.document_number}</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Fecha de Registro</Text>
            <Text style={styles.infoValue}>
              {new Date(user.created_at).toLocaleDateString('es-PE')}
            </Text>
          </View>
        </View>

        <View style={styles.actionsSection}>
          <TouchableOpacity style={[styles.actionItem, styles.signOutItem]} onPress={handleSignOut}>
            <LogOut size={20} color="#dc2626" />
            <Text style={[styles.actionText, styles.signOutText]}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#266441',
    textAlign: 'center',
  },
  editButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginTop: 24,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#266441',
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: '#266441',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  infoItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  balanceSection: {
    marginBottom: 24,
  },
  balanceCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#059669',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#059669',
  },
  actionsSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 24,
    marginBottom: 40,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  actionText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  signOutItem: {
    borderBottomWidth: 0,
  },
  signOutText: {
    color: '#dc2626',
    fontWeight: '500',
  },
});