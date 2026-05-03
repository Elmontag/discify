import './global.css';
import React, { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import Navigation from './src/navigation';
import { initDb } from './src/services/db';

export default function App() {
  const [initialLoggedIn, setInitialLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        initDb();
        const token = await SecureStore.getItemAsync('auth_token');
        setInitialLoggedIn(!!token);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#07111f',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  return (
    <AuthProvider initialLoggedIn={initialLoggedIn}>
      <StatusBar style="light" />
      <Navigation />
    </AuthProvider>
  );
}
