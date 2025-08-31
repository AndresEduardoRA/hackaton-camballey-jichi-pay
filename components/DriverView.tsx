import { useLocation } from '@/hooks/useLocation';
import { supabase } from '@/lib/supabase';
import { PaymentRequest } from '@/types/database';
import { router } from 'expo-router';
import { Bell, DollarSign, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface DriverViewProps {
  user: any;
  onNavigate: (screen: string) => void;
}

export default function DriverView({ user, onNavigate }: DriverViewProps) {
  const { location } = useLocation();
  const [isOnline, setIsOnline] = useState(false);
  const [earningsToday, setEarningsToday] = useState(0);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [driverBalance, setDriverBalance] = useState<number>(Number(user?.balance ?? 0));

  // Cargar resumen inicial
  useEffect(() => {
    fetchSummary();
    // Realtime: nuevas transacciones para este conductor
    const ch = supabase
      .channel('txn-driver-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `driver_id=eq.${user.id}`,
        },
        (payload) => {
          const tx = payload.new as any;
          if (tx.status === 'completed') {
            // sumar al día y a balance local
            setEarningsToday((prev) => prev + Number(tx.amount));
            setDriverBalance((prev) => prev + Number(tx.amount));
            setRecentTx((prev) => [{ ...tx }, ...prev].slice(0, 20));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user.id]);

  // Actualiza o crea bus + ubicación (igual que ya tenías)
  useEffect(() => {
    if (isOnline && location) {
      updateDriverLocation();
    }
  }, [isOnline, location]);

  const fetchSummary = async () => {
    try {
      // Saldo actual del conductor (users.balance)
      const { data: udata, error: uerr } = await supabase
        .from('users')
        .select('balance')
        .eq('id', user.id)
        .single();
      if (!uerr && udata) setDriverBalance(Number(udata.balance ?? 0));

      // Ganancias de HOY (UTC-> usa created_at de hoy)
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const { data: txs, error: terr } = await supabase
        .from('transactions')
        .select('id, amount, passenger_count, created_at, bus_id')
        .eq('driver_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      if (terr) throw terr;

      const total = (txs ?? []).reduce((s, t) => s + Number(t.amount), 0);
      setEarningsToday(total);
      setRecentTx(txs ?? []);
    } catch (e) {
      console.error('Error fetching driver summary:', e);
    }
  };

  const updateDriverLocation = async () => {
    if (!location || !isOnline) return;

    try {
      // First, get or create the driver's bus
      let { data: buses, error } = await supabase
        .from('buses')
        .select('*')
        .eq('driver_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!buses) {
        // Create new bus entry
        const { error: createError } = await supabase
          .from('buses')
          .insert({
            driver_id: user.id,
            license_plate: `BUS-${user.id.slice(0, 6)}`,
            route: `Ruta ${Math.floor(Math.random() * 100)}`,
            latitude: location.latitude,
            longitude: location.longitude,
            is_active: true,
          });

        if (createError) throw createError;
      } else {
        // Update existing bus location
        const { error: updateError } = await supabase
          .from('buses')
          .update({
            latitude: location.latitude,
            longitude: location.longitude,
            is_active: isOnline,
            updated_at: new Date().toISOString(),
          })
          .eq('id', buses.id);

        if (updateError) throw updateError;
      }
    } catch (error) {
      console.error('Error updating driver location:', error);
    }
  };

  const toggleOnlineStatus = (value: boolean) => {
    setIsOnline(value);
    updateDriverLocation();
  };

  // UI simplificada: header con saldo y ganancias de hoy, lista de últimas transacciones
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Saldo</Text>
        <Text style={styles.earnings}>Bs. {driverBalance.toFixed(2)}</Text>

        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>Ganancias de Hoy</Text>
            <Text style={[styles.statusLabel, { color: '#059669' }]}>
              Bs. {earningsToday.toFixed(2)}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>Estado:</Text>
            <View style={styles.statusIndicator}>
              <Text style={[styles.statusLabel, { color: isOnline ? '#059669' : '#dc2626' }]}>
                {isOnline ? 'En línea' : 'Fuera de línea'}
              </Text>
              <Switch
                value={isOnline}
                onValueChange={toggleOnlineStatus}
                trackColor={{ false: '#e5e7eb', true: '#dcfce7' }}
                thumbColor={isOnline ? '#059669' : '#6b7280'}
              />
            </View>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(tabs)/deposit')}>
            <DollarSign size={20} color="#059669" />
            <Text style={styles.actionButtonText}>Retirar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/profile')}>
            <Users size={20} color="#1E40AF" />
            <Text style={styles.actionButtonText}>Perfil</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.requestsSection}>
        <View style={styles.sectionHeader}>
          <Bell size={20} color="#1E40AF" />
          <Text style={styles.sectionTitle}>Depósitos Recientes</Text>
        </View>

        {recentTx.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={48} color="#d1d5db" />
            <Text style={styles.emptyStateText}>Aún no hay depósitos hoy</Text>
            <Text style={styles.emptyStateSubtext}>
              {isOnline ? 'Cuando recibas pagos aparecerán aquí' : 'Actívate para recibir pagos'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={recentTx}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.paymentCard}>
                <View style={styles.paymentHeader}>
                  <Text style={styles.passengerName}>Pago recibido</Text>
                  <Text style={styles.amount}>Bs. {Number(item.amount).toFixed(2)}</Text>
                </View>
                <Text style={styles.busInfo}>
                  {new Date(item.created_at).toLocaleTimeString()}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 18,
    color: '#64748b',
    textAlign: 'center',
  },
  earnings: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#059669',
    textAlign: 'center',
    marginVertical: 8,
  },
  statusContainer: {
    marginVertical: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#1E40AF',
  },
  requestsSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  badge: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E40AF',
  },
  busInfo: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  amount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },
  passengerCount: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  countText: {
    fontSize: 12,
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  paymentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#fef2f2',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});