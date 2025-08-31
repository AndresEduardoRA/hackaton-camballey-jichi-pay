import AuthScreen from '@/components/AuthScreen';
import { useAuth } from '@/hooks/useAuth';
import { Tabs } from 'expo-router';
import { DollarSign, House, Plus, User } from 'lucide-react-native';

export default function TabLayout() {
  const { user } = useAuth();

  if (!user) return <AuthScreen />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#1E40AF',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ size, color }) => (
            <House size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="deposit"
        options={{
          title: user.role === 'driver' ? 'Retirar' : 'Depositar',
          tabBarIcon: ({ size, color }) => (
            user.role === 'driver' ? 
            <DollarSign size={size} color={color} /> :
            <Plus size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ size, color }) => (
            <User size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}