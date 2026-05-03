import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Disc } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function AuthScreen() {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email || !password) {
      return;
    }
    setLoading(true);
    try {
      const tokens =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(email, password);
      await login(tokens.access_token);
    } catch (e: any) {
      Alert.alert('Fehler', e.message ?? 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#07111f' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
      >
        <View style={{ marginBottom: 8, alignItems: 'flex-start' }}>
          <Disc size={40} color="#7c5cff" />
          <Text
            style={{
              fontSize: 32,
              fontWeight: 'bold',
              color: '#f5f7ff',
              marginTop: 12,
            }}
          >
            Discify
          </Text>
        </View>
        <Text style={{ color: '#9eaccf', marginBottom: 40 }}>
          {mode === 'login' ? 'Willkommen zurück' : 'Neues Konto erstellen'}
        </Text>

        <TextInput
          style={inputStyle}
          placeholder="E-Mail"
          placeholderTextColor="#9eaccf"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={[inputStyle, { marginTop: 12 }]}
          placeholder="Passwort"
          placeholderTextColor="#9eaccf"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          onPress={submit}
          disabled={loading}
          style={{
            marginTop: 24,
            backgroundColor: '#7c5cff',
            borderRadius: 14,
            padding: 16,
            alignItems: 'center',
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
              {mode === 'login' ? 'Anmelden' : 'Registrieren'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
          style={{ marginTop: 16, alignItems: 'center' }}
        >
          <Text style={{ color: '#9eaccf', fontSize: 14 }}>
            {mode === 'login'
              ? 'Kein Konto? Registrieren'
              : 'Bereits registriert? Anmelden'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: '#0d1e33',
  borderRadius: 12,
  padding: 14,
  color: '#f5f7ff',
  fontSize: 16,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
};
