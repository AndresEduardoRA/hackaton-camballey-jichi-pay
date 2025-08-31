import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import DepositScreen from '@/components/DepositScreen';
import WithdrawScreen from '@/components/WithdrawScreen';
import LoadingScreen from '@/components/LoadingScreen';
import AuthScreen from '@/components/AuthScreen';
import { router } from 'expo-router';

export default function DepositTab() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <View style={styles.container}>
      {user.role === 'passenger' ? (
        <DepositScreen user={user} onBack={() => {router.back()}} />
      ) : (
        <WithdrawScreen user={user} onBack={() => {router.back()}} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});