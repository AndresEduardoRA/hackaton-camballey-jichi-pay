import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CreditCard } from 'lucide-react-native';

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <CreditCard size={64} color="#266441" />
      <Text style={styles.title}>Jichi Pay</Text>
      <Text style={styles.subtitle}>Cargando...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#266441',
    marginTop: 24,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 8,
  },
});