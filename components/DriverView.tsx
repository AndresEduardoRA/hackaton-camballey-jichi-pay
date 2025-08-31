import { useLocation } from '@/hooks/useLocation';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { Bell, DollarSign, Users, RefreshCcw } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
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

export default function DriverView({ user }: DriverViewProps) {
  const { location } = useLocation();
  const [isOnline, setIsOnline] = useState(false);
  const [earningsToday, setEarningsToday] = useState(0);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [driverBalance, setDriverBalance] = useState<number>(Number(user?.balance ?? 0));
  const [refreshing, setRefreshing] = useState(false);

  // --- Cargar resumen inicial + Realtime ---
  useEffect(() => {
    fetchSummary();

    // Realtime: nuevas transacciones para este conductor
    const txCh = supabase
      .channel('txn-driver-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions', filter: `driver_id=eq.${user.id}` },
        (payload) => {
          const tx = payload.new as any;
          if (tx?.status === 'completed') {
            // sumamos al día y al balance local
            const created = new Date(tx.created_at);
            const start = new Date(); start.setHours(0,0,0,0);
            const end = new Date();   end.setHours(23,59,59,999);
            if (created >= start && created <= end) {
              setEarningsToday((prev) => prev + Number(tx.amount));
              setRecentTx((prev) => [{ ...tx }, ...prev].slice(0, 20));
            }
            setDriverBalance((prev) => prev + Number(tx.amount));
          }
        }
      )
      .subscribe();

    // Realtime: cambios en mi fila de users (saldo sube/baja por depósitos/retiros)
    const userCh = supabase
      .channel('driver-balance-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}` },
        (payload: any) => {
          setDriverBalance(Number(payload.new?.balance ?? 0));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(txCh);
      supabase.removeChannel(userCh);
    };
  }, [user.id]);

  // --- Heartbeat de ubicación mientras esté online ---
  useEffect(() => {
    let timer: any;
    if (isOnline) {
      // primer update inmediato
      updateDriverLocation();
      // cada 20s para mantener updated_at “vivo”
      timer = setInterval(() => {
        updateDriverLocation();
      }, 20000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOnline, location?.latitude, location?.longitude]);

  // --- Funciones de datos ---
  const fetchSummary = async () => {
    try {
      // saldo actual
      const { data: udata } = await supabase
        .from('users')
        .select('balance')
        .eq('id', user.id)
        .single();
      if (udata) setDriverBalance(Number(udata.balance ?? 0));

      // ganancias de HOY
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date();   end.setHours(23, 59, 59, 999);

      const { data: txs } = await supabase
        .from('transactions')
        .select('id, amount, passenger_count, created_at, bus_id, status')
        .eq('driver_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      const total = (txs ?? []).reduce((s, t) => s + Number(t.amount), 0);
      setEarningsToday(total);
      setRecentTx(txs ?? []);
    } catch (e) {
      console.error('Error fetching driver summary:', e);
    }
  };

  const manualRefresh = async () => {
    setRefreshing(true);
    await fetchSummary();
    setRefreshing(false);
  };

  const updateDriverLocation = async () => {
    if (!location) return;
    try {
      let { data: bus, error } = await supabase
        .from('buses')
        .select('*')
        .eq('driver_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!bus) {
        const { error: createError } = await supabase
          .from('buses')
          .insert({
            driver_id: user.id,
            license_plate: `BUS-${String(user.id).slice(0, 6)}`,
            route: `Ruta ${Math.floor(Math.random() * 100)}`,
            latitude: location.latitude,
            longitude: location.longitude,
            is_active: isOnline,
          });
        if (createError) throw createError;
      } else {
        const { error: updateError } = await supabase
          .from('buses')
          .update({
            latitude: location.latitude,
            longitude: location.longitude,
            is_active: isOnline,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bus.id);
        if (updateError) throw updateError;
      }
    } catch (error) {
      console.error('Error updating driver location:', error);
    }
  };

  const toggleOnlineStatus = (value: boolean) => {
    setIsOnline(value);
    // hacemos un update inmediato para reflejar el cambio de estado
    updateDriverLocation();
  };

  // --- UI ---
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
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/deposit')} // <-- ajusta si tu ruta es distinta
          >
            <DollarSign size={20} color="#059669" />
            <Text style={styles.actionButtonText}>Retirar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Users size={20} color="#1E40AF" />
            <Text style={styles.actionButtonText}>Perfil</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.requestsSection}>
        <View style={styles.sectionHeader}>
          <Bell size={20} color="#1E40AF" />
          <Text style={styles.sectionTitle}>Depósitos</Text>

          <TouchableOpacity
            onPress={manualRefresh}
            style={styles.refreshButton}
            disabled={refreshing}
          >
            <RefreshCcw size={16} color="#1E40AF" />
          </TouchableOpacity>
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
            onRefresh={manualRefresh}
            refreshing={refreshing}
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
  container: { flex: 1, backgroundColor: '#f8fafc' },
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
  title: { fontSize: 18, color: '#64748b', textAlign: 'center' },
  earnings: { fontSize: 36, fontWeight: 'bold', color: '#059669', textAlign: 'center', marginVertical: 8 },
  statusContainer: { marginVertical: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusText: { fontSize: 16, color: '#374151', fontWeight: '500' },
  statusIndicator: { flexDirection: 'row', alignItems: 'center' },
  statusLabel: { fontSize: 16, fontWeight: '600', marginRight: 12 },
  actionButtons: { flexDirection: 'row', gap: 16, marginTop: 16 },
  actionButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f1f5f9', paddingVertical: 12, borderRadius: 12,
  },
  actionButtonText: { marginLeft: 8, fontSize: 16, fontWeight: '500', color: '#1E40AF' },

  requestsSection: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#374151', marginLeft: 8, flex: 1 },

  refreshButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#eef2ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  refreshText: { marginLeft: 6, color: '#1E40AF', fontWeight: '600', fontSize: 12 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateText: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 16 },
  emptyStateSubtext: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },

  paymentCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
  },
  paymentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  passengerName: { fontSize: 18, fontWeight: '600', color: '#1E40AF' },
  busInfo: { fontSize: 14, color: '#64748b', marginTop: 2 },
  amount: { fontSize: 20, fontWeight: 'bold', color: '#059669' },
});
