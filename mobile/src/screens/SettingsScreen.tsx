import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { UserInfo } from '../types';

export default function SettingsScreen() {
  const { logout } = useAuth();
  const [discogsToken, setDiscogsToken] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [useOllama, setUseOllama] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('discogs_token').then((v) => v && setDiscogsToken(v));
    SecureStore.getItemAsync('ollama_url').then((v) => v && setOllamaUrl(v));
    SecureStore.getItemAsync('use_ollama').then((v) => setUseOllama(v === 'true'));
    api.me().then(setUserInfo).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await SecureStore.setItemAsync('discogs_token', discogsToken);
      await SecureStore.setItemAsync('ollama_url', ollamaUrl);
      await SecureStore.setItemAsync('use_ollama', String(useOllama));
      Alert.alert('Gespeichert', 'Einstellungen wurden gespeichert.');
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    Alert.alert('Abgemeldet', 'Du wurdest abgemeldet.');
  }

  const TIER_LABEL: Record<string, string> = {
    free: 'Free',
    basic: 'Basic',
    pro: 'Pro',
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#07111f' }}
      contentContainerStyle={{ padding: 20 }}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: 'bold',
          color: '#f5f7ff',
          marginBottom: 20,
        }}
      >
        Einstellungen
      </Text>

      {userInfo && (
        <View style={card}>
          <Text style={label}>Konto</Text>
          <Text style={{ color: '#f5f7ff', marginTop: 4 }}>{userInfo.email}</Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 8,
            }}
          >
            <Text style={{ color: '#9eaccf' }}>Abo: {TIER_LABEL[userInfo.tier]}</Text>
            <Text style={{ color: '#9eaccf' }}>
              Scans: {userInfo.scans_used} /{' '}
              {userInfo.scans_limit === -1 ? '∞' : userInfo.scans_limit}
            </Text>
          </View>
        </View>
      )}

      <View style={[card, { marginTop: 16 }]}>
        <Text style={label}>Discogs Personal Token</Text>
        <TextInput
          style={inputStyle}
          placeholder="dein-discogs-token"
          placeholderTextColor="#9eaccf"
          value={discogsToken}
          onChangeText={setDiscogsToken}
          secureTextEntry
          autoCapitalize="none"
        />
        <Text style={{ color: '#9eaccf', fontSize: 12, marginTop: 4 }}>
          discogs.com/settings/developers
        </Text>
      </View>

      <View style={[card, { marginTop: 16 }]}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={label}>Ollama statt Anthropic nutzen</Text>
          <Switch
            value={useOllama}
            onValueChange={setUseOllama}
            trackColor={{ true: '#7c5cff' }}
          />
        </View>
        {useOllama && (
          <TextInput
            style={[inputStyle, { marginTop: 12 }]}
            placeholder="http://192.168.x.x:11434"
            placeholderTextColor="#9eaccf"
            value={ollamaUrl}
            onChangeText={setOllamaUrl}
            autoCapitalize="none"
          />
        )}
      </View>

      <TouchableOpacity
        onPress={save}
        disabled={saving}
        style={{
          marginTop: 24,
          backgroundColor: '#7c5cff',
          borderRadius: 14,
          padding: 16,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
          {saving ? 'Speichern…' : 'Speichern'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleLogout}
        style={{
          marginTop: 12,
          borderRadius: 14,
          padding: 16,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <Text style={{ color: '#9eaccf', fontSize: 14 }}>Abmelden</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const card = {
  backgroundColor: '#0d1e33',
  borderRadius: 16,
  padding: 16,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.06)',
};

const label = {
  color: '#9eaccf',
  fontSize: 12,
  fontWeight: '600' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.8,
};

const inputStyle = {
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: 10,
  padding: 12,
  color: '#f5f7ff',
  fontSize: 15,
  marginTop: 8,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
};
