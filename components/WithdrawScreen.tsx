import { supabase } from '@/lib/supabase';
import { ArrowLeft, DollarSign, RefreshCcw } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  RefreshControl,
} from 'react-native';

interface WithdrawScreenProps {
  user: any;
  onBack: () => void;
}

export default function WithdrawScreen({ user, onBack }: WithdrawScreenProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // saldo actual en DB
  const [availableBalance, setAvailableBalance] = useState<number>(Number(user?.balance ?? 0));
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchBalance();

    // Realtime: cuando cambia mi fila en users, actualizo saldo
    const channel = supabase
      .channel('driver-balance-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}` },
        (payload: any) => {
          setAvailableBalance(Number(payload.new.balance ?? 0));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const fetchBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('balance')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setAvailableBalance(Number(data?.balance ?? 0));
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  const manualRefresh = async () => {
    setRefreshing(true);
    await fetchBalance();
    setRefreshing(false);
  };

  const amounts = [50, 100, 200, 500, 1000];
  const availableAmounts = amounts.filter((amount) => amount <= availableBalance);

  const handleWithdraw = async () => {
    if (!selectedAmount) {
      Alert.alert('Error', 'Selecciona un monto para retirar');
      return;
    }

    if (selectedAmount > availableBalance) {
      Alert.alert('Error', 'No tienes saldo suficiente para este retiro');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('request_withdrawal', {
        p_driver_id: user.id,
        p_amount: selectedAmount,
      });

      if (error) throw error;

      Alert.alert(
        'Retiro solicitado',
        `Se procesará el retiro de Bs. ${selectedAmount.toFixed(2)} en los próxmos 5 minutos.`
      );

      setSelectedAmount(null);
      // Si no quieres esperar al realtime:
      // await fetchBalance();
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      Alert.alert('Error', 'No se pudo procesar el retiro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header fijo */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={24} color="#266441" />
        </TouchableOpacity>
        <Text style={styles.title}>Retirar</Text>

        {/* Botón Recargar */}
        <TouchableOpacity style={styles.refreshButton} onPress={manualRefresh} disabled={refreshing}>
          <RefreshCcw size={18} color="#266441" />
        </TouchableOpacity>
      </View>

      {/* Contenido scrolleable con pull-to-refresh */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={manualRefresh} />}
      >
        <View className="earn" style={styles.earningsSection}>
          <DollarSign size={48} color="#059669" />
          <Text style={styles.earningsTitle}>Ganancias Disponibles</Text>
          <Text style={styles.earningsAmount}>Bs. {availableBalance.toFixed(2)}</Text>
          <Text style={styles.earningsSubtitle}>Dinero disponible para retirar</Text>
        </View>

        {availableBalance > 0 ? (
          <>
            <View style={styles.amountSection}>
              <Text style={styles.sectionTitle}>Seleccionar Monto</Text>
              <View style={styles.amountGrid}>
                {availableAmounts.map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    style={[
                      styles.amountButton,
                      selectedAmount === amount && styles.amountButtonSelected,
                    ]}
                    onPress={() => setSelectedAmount(amount)}
                  >
                    <Text
                      style={[
                        styles.amountText,
                        selectedAmount === amount && styles.amountTextSelected,
                      ]}
                    >
                      Bs. {amount}
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Todo (retiro máximo disponible) */}
                <TouchableOpacity
                  style={[
                    styles.amountButton,
                    styles.customAmountButton,
                    selectedAmount === availableBalance && styles.amountButtonSelected,
                  ]}
                  onPress={() => setSelectedAmount(availableBalance)}
                >
                  <Text
                    style={[
                      styles.amountText,
                      styles.customAmountText,
                      selectedAmount === availableBalance && styles.amountTextSelected,
                    ]}
                  >
                    Todo
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.withdrawalInfo}>
              <Text style={styles.infoTitle}>Información de Retiro</Text>
              <Text style={styles.infoText}>• Los retiros se procesan en  los próximos 5 minutos</Text>
              <Text style={styles.infoText}>• Se depositará en tu cuenta bancaria registrada</Text>
              <Text style={styles.infoText}>• No hay comisiones por retiros</Text>
            </View>

            {selectedAmount !== null && (
              <View style={styles.summary}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Monto a retirar:</Text>
                  <Text style={styles.summaryValue}>Bs. {selectedAmount.toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Saldo restante:</Text>
                  <Text style={styles.totalValue}>
                    Bs. {(availableBalance - selectedAmount).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.withdrawButton,
                (selectedAmount === null || loading) && styles.withdrawButtonDisabled,
              ]}
              onPress={handleWithdraw}
              disabled={selectedAmount === null || loading}
            >
              <Text style={styles.withdrawButtonText}>
                {loading ? 'Procesando...' : 'Solicitar Retiro'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.noEarningsState}>
            <Text style={styles.noEarningsText}>No tienes ganancias disponibles</Text>
            <Text style={styles.noEarningsSubtext}>
              Recibe pagos de pasajeros para generar ganancias
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const BUTTON_WIDTH = (Dimensions.get('window').width - 120) / 3;

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
  // botón recargar
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  refreshText: { marginLeft: 6, color: '#266441', fontWeight: '600', fontSize: 12 },

  /* ScrollView */
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },

  earningsSection: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  earningsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#059669',
    marginTop: 16,
  },
  earningsAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 8,
  },
  earningsSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },

  amountSection: {
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
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  amountButton: {
    width: BUTTON_WIDTH,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  customAmountButton: {
    width: BUTTON_WIDTH,
  },
  amountButtonSelected: {
    borderColor: '#059669',
    backgroundColor: '#059669',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  customAmountText: {
    fontSize: 14,
  },
  amountTextSelected: {
    color: '#fff',
  },

  withdrawalInfo: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#065f46',
    marginBottom: 6,
  },

  summary: {
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },

  withdrawButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  withdrawButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  withdrawButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },

  noEarningsState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noEarningsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  noEarningsSubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
});
