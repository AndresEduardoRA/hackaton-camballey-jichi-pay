import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
} from 'react-native';
import { supabase, PRICES } from '@/lib/supabase';
import { useLocation } from '@/hooks/useLocation';
import { Bus } from '@/types/database';
import { MapPin, CreditCard, Users, Plus, Minus, RefreshCcw } from 'lucide-react-native';
import { router } from 'expo-router';

interface PassengerViewProps {
  user: any;
  onNavigate: (screen: string) => void;
}

interface PassengerCount {
  adults: number;
  children: number;
  students: number;
}

const ONLINE_MAX_AGE_MS = 90 * 1000; // 90s: solo mostramos buses con updated_at reciente

export default function PassengerView({ user }: PassengerViewProps) {
  const [loading, setLoading] = useState(false);
  const { location } = useLocation();
  const [nearbyBuses, setNearbyBuses] = useState<Bus[]>([]);
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [passengerCount, setPassengerCount] = useState<PassengerCount>({
    adults: user.user_type === 'adult' ? 1 : 0,
    children: user.user_type === 'child' ? 1 : 0,
    students: user.user_type === 'student' ? 1 : 0,
  });

  // ------------ Helpers ------------
  const deg2rad = (deg: number) => deg * (Math.PI / 180);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // km
  };

  const isFresh = (updatedAt: string | Date | null | undefined) => {
    if (!updatedAt) return false;
    const ts = new Date(updatedAt).getTime();
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts <= ONLINE_MAX_AGE_MS;
  };

  const computeList = (rows: any[]) => {
    if (!location) return [];
    const nowList =
      rows
        // Aseguramos que estén en línea y “frescos”
        .filter((b) => b.is_active === true && isFresh(b.updated_at))
        // Enriquecemos con distancia (coerción a number por si viniera como string)
        .map((bus) => {
          const lat = Number(bus.latitude);
          const lon = Number(bus.longitude);
          const distance = calculateDistance(location.latitude, location.longitude, lat, lon);
          return { ...bus, distance };
        })
        // Orden por cercanía
        .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
    return nowList;
  };

  // ------------ Fetch + Refresh ------------
  const fetchNearbyBuses = async () => {
    if (!location) return;
    try {
      const thresholdISO = new Date(Date.now() - ONLINE_MAX_AGE_MS).toISOString();
      const { data, error } = await supabase
        .from('buses')
        .select(`
          *,
          users!buses_driver_id_fkey(full_name)
        `)
        .eq('is_active', true)
        .gte('updated_at', thresholdISO); // solo buses con actividad reciente

      if (error) throw error;
      setNearbyBuses(computeList(data ?? []));
    } catch (error) {
      console.error('Error fetching buses:', error);
    }
  };

  const manualRefresh = async () => {
    setRefreshing(true);
    await fetchNearbyBuses();
    setRefreshing(false);
  };

  // Primer load y cuando cambia la ubicación
  useEffect(() => {
    fetchNearbyBuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude]);

  // ------------ Realtime ------------
  useEffect(() => {
    // Suscripción realtime: INSERT/UPDATE/DELETE sobre buses
    const channel = supabase
      .channel('realtime-buses')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'buses' },
        (payload: any) => {
          if (!location) return;

          if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (!deletedId) return;
            setNearbyBuses((curr: any[]) => curr.filter((b) => b.id !== deletedId));
            return;
          }

          const row = payload.new;
          if (!row) return;

          // Si está offline o “stale”, lo quitamos
          if (row.is_active !== true || !isFresh(row.updated_at)) {
            setNearbyBuses((curr: any[]) => curr.filter((b) => b.id !== row.id));
            return;
          }

          // Recalcular distancia y actualizar/incluir
          const lat = Number(row.latitude);
          const lon = Number(row.longitude);
          const distance = calculateDistance(location.latitude, location.longitude, lat, lon);

          setNearbyBuses((curr: any[]) => {
            const others = curr.filter((b) => b.id !== row.id);
            const next = [...others, { ...row, distance }];
            return next.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [location]);

  // ------------ Pago ------------
  const calculateTotal = () =>
    passengerCount.adults * PRICES.adult +
    passengerCount.children * PRICES.child +
    passengerCount.students * PRICES.student;

  const updatePassengerCount = (type: keyof PassengerCount, increment: boolean) => {
    setPassengerCount((prev) => ({
      ...prev,
      [type]: Math.max(0, prev[type] + (increment ? 1 : -1)),
    }));
  };

  const handlePayment = async () => {
    if (!selectedBus) return;

    const total = calculateTotal();
    if (total === 0) {
      Alert.alert('Error', 'Selecciona al menos un pasajero');
      return;
    }
    if (Number(user.balance ?? 0) < total) {
      Alert.alert('Saldo insuficiente', 'No tienes suficiente saldo');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.rpc('process_ticket_payment', {
        p_passenger_id: user.id,
        p_bus_id: selectedBus.id,
        p_amount: total,
        p_passenger_count: passengerCount,
      });

      if (error) throw error;

      Alert.alert('Pago exitoso', 'Tu pasaje ha sido pagado');
      setShowPaymentModal(false);
      setSelectedBus(null);
    } catch (e) {
      console.error('Error creating payment:', e);
      Alert.alert('Error', 'No se pudo procesar el pago');
    } finally {
      setLoading(false);
    }
  };

  const paySingleTicket = async (bus: Bus) => {
    if (!bus) return;

    const singleCount = {
      adults: user.user_type === 'adult' ? 1 : 0,
      students: user.user_type === 'student' ? 1 : 0,
      children: user.user_type === 'child' ? 1 : 0,
    };

    const amount =
      singleCount.adults * PRICES.adult +
      singleCount.students * PRICES.student +
      singleCount.children * PRICES.child;

    if (amount <= 0) {
      Alert.alert('Error', 'Tu tipo de usuario no tiene pasaje asignado');
      return;
    }

    if (Number(user.balance ?? 0) < amount) {
      Alert.alert('Saldo insuficiente', 'Recarga tu saldo para continuar');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.rpc('process_ticket_payment', {
        p_passenger_id: user.id,
        p_bus_id: bus.id,
        p_amount: amount,
        p_passenger_count: singleCount,
      });

      if (error) throw error;

      Alert.alert('Pago exitoso', '¡Buen viaje!');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo procesar el pago');
    } finally {
      setLoading(false);
    }
  };

  // ------------ UI ------------
  const renderBusItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.busCard}
      onPress={() => {
        setSelectedBus(item);
        setShowPaymentModal(true); // múltiple aquí
      }}
    >
      <View style={styles.busHeader}>
        <View style={styles.busInfo}>
          <Text style={styles.busRoute}>{item.route}</Text>
          <Text style={styles.busPlate}>{item.license_plate}</Text>
          <Text style={styles.driverName}>{item?.users?.full_name}</Text>
        </View>
        <View style={styles.distanceContainer}>
          <MapPin size={16} color="#059669" />
          <Text style={styles.distance}>{item.distance?.toFixed(1)} km</Text>
        </View>
      </View>

      {/* Botón: pagar pasaje individual */}
      <TouchableOpacity
        style={styles.payButton}
        onPress={() => paySingleTicket(item)}
        disabled={loading}
      >
        <CreditCard size={20} color="#fff" />
        <Text style={styles.payButtonText}>{loading ? 'Procesando...' : 'Pagar Pasaje'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mi Saldo</Text>
        <Text style={styles.balance}>Bs. {Number(user?.balance ?? 0).toFixed(2)}</Text>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/deposit')}
          >
            <Plus size={20} color="#059669" />
            <Text style={styles.actionButtonText}>Depositar</Text>
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

      <View style={styles.busesSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Buses Cercanos</Text>

          <TouchableOpacity
            onPress={manualRefresh}
            style={styles.refreshButton}
            disabled={refreshing}
          >
            <RefreshCcw size={16} color="#1E40AF" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={nearbyBuses}
          renderItem={renderBusItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={manualRefresh}
          ListEmptyComponent={
            <View style={{ paddingVertical: 24 }}>
              <Text style={{ textAlign: 'center', color: '#64748b' }}>
                No hay buses en línea cerca en este momento
              </Text>
            </View>
          }
        />
      </View>

      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmar Pago</Text>

            {selectedBus && (
              <View style={styles.selectedBusInfo}>
                <Text style={styles.selectedBusRoute}>{selectedBus.route}</Text>
                <Text style={styles.selectedBusPlate}>{selectedBus.license_plate}</Text>
              </View>
            )}

            <View style={styles.passengerSelection}>
              <Text style={styles.selectionTitle}>Seleccionar Pasajeros</Text>

              <View className="row" style={styles.passengerRow}>
                <Text style={styles.passengerType}>Adultos (Bs. {PRICES.adult})</Text>
                <View style={styles.counter}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updatePassengerCount('adults', false)}
                  >
                    <Minus size={16} color="#1E40AF" />
                  </TouchableOpacity>
                  <Text style={styles.counterText}>{passengerCount.adults}</Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updatePassengerCount('adults', true)}
                  >
                    <Plus size={16} color="#1E40AF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.passengerRow}>
                <Text style={styles.passengerType}>Estudiantes (Bs. {PRICES.student})</Text>
                <View style={styles.counter}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updatePassengerCount('students', false)}
                  >
                    <Minus size={16} color="#1E40AF" />
                  </TouchableOpacity>
                  <Text style={styles.counterText}>{passengerCount.students}</Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updatePassengerCount('students', true)}
                  >
                    <Plus size={16} color="#1E40AF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.passengerRow}>
                <Text style={styles.passengerType}>Niños (Bs. {PRICES.child})</Text>
                <View style={styles.counter}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updatePassengerCount('children', false)}
                  >
                    <Minus size={16} color="#1E40AF" />
                  </TouchableOpacity>
                  <Text style={styles.counterText}>{passengerCount.children}</Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updatePassengerCount('children', true)}
                  >
                    <Plus size={16} color="#1E40AF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.totalSection}>
              <Text style={styles.totalText}>Total: Bs. {calculateTotal().toFixed(2)}</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPaymentModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, loading && { opacity: 0.6 }]}
                onPress={handlePayment}
                disabled={loading}
              >
                <Text style={styles.confirmButtonText}>
                  {loading ? 'Enviando...' : 'Confirmar Pago'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  balance: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1E40AF',
    textAlign: 'center',
    marginVertical: 8,
  },
  actionButtons: { flexDirection: 'row', gap: 16, marginTop: 16 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionButtonText: { marginLeft: 8, fontSize: 16, fontWeight: '500', color: '#1E40AF' },

  busesSection: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#374151', flex: 1 },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  refreshText: { marginLeft: 6, color: '#1E40AF', fontWeight: '600', fontSize: 12 },

  busCard: {
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
  busHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  busInfo: { flex: 1 },
  busRoute: { fontSize: 18, fontWeight: '600', color: '#1E40AF' },
  busPlate: { fontSize: 14, color: '#64748b', marginTop: 2 },
  driverName: { fontSize: 14, color: '#64748b', marginTop: 2 },
  distanceContainer: { flexDirection: 'row', alignItems: 'center' },
  distance: { fontSize: 14, color: '#059669', fontWeight: '500', marginLeft: 4 },

  payButton: {
    backgroundColor: '#1E40AF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  payButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E40AF', textAlign: 'center', marginBottom: 16 },
  selectedBusInfo: { backgroundColor: '#f1f5f9', padding: 16, borderRadius: 12, marginBottom: 24, alignItems: 'center' },
  selectedBusRoute: { fontSize: 18, fontWeight: '600', color: '#1E40AF' },
  selectedBusPlate: { fontSize: 14, color: '#64748b', marginTop: 4 },

  passengerSelection: { marginBottom: 24 },
  selectionTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 16 },
  passengerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  passengerType: { fontSize: 16, color: '#374151' },
  counter: { flexDirection: 'row', alignItems: 'center' },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: { fontSize: 18, fontWeight: '600', color: '#1E40AF', marginHorizontal: 16 },

  totalSection: { backgroundColor: '#f1f5f9', padding: 16, borderRadius: 12, marginBottom: 24, alignItems: 'center' },
  totalText: { fontSize: 24, fontWeight: 'bold', color: '#1E40AF' },

  modalActions: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  confirmButton: { flex: 1, backgroundColor: '#1E40AF', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  confirmButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
