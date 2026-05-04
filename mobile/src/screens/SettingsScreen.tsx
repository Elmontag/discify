import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CheckCircle2,
  Disc3,
  LogOut,
  Save,
  Server,
  User,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { UserInfo } from '../types';

export default function SettingsScreen() {
  const { logout } = useAuth();
  const [discogsToken, setDiscogsToken] = useState('');
  const [discogsTokenSet, setDiscogsTokenSet] = useState(false);
  const [discogsUsername, setDiscogsUsername] = useState<string | null>(null);
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [savingDiscogs, setSavingDiscogs] = useState(false);
  const [savingOllama, setSavingOllama] = useState(false);

  useEffect(() => {
    Promise.all([api.me(), api.getDiscogsSettings(), api.getOllamaSettings()])
      .then(([me, discogs, ollama]) => {
        setUserInfo(me);
        setDiscogsTokenSet(discogs.discogs_token_set);
        setDiscogsUsername(discogs.discogs_username);
        setOllamaUrl(ollama.ollama_url || ollama.global_ollama_url || 'http://localhost:11434');
      })
      .catch(() => {});
  }, []);

  async function saveDiscogs() {
    setSavingDiscogs(true);
    try {
      await api.updateDiscogsToken(discogsToken);
      const updated = await api.getDiscogsSettings();
      setDiscogsToken('');
      setDiscogsTokenSet(updated.discogs_token_set);
      setDiscogsUsername(updated.discogs_username);
      Alert.alert('Gespeichert', 'Discogs-Einstellungen wurden gespeichert.');
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setSavingDiscogs(false);
    }
  }

  async function saveOllama() {
    setSavingOllama(true);
    try {
      await api.updateOllamaUrl(ollamaUrl);
      const updated = await api.getOllamaSettings();
      setOllamaUrl(updated.ollama_url || updated.global_ollama_url || 'http://localhost:11434');
      Alert.alert('Gespeichert', 'Ollama-URL wurde gespeichert.');
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setSavingOllama(false);
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
      contentContainerStyle={{ padding: 20, gap: 16 }}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: 'bold',
          color: '#f5f7ff',
          marginBottom: 4,
        }}
      >
        Einstellungen
      </Text>

      {userInfo && (
        <View style={card}>
          <View style={sectionHeader}>
            <User size={18} color="#7c5cff" />
            <Text style={label}>Konto</Text>
          </View>
          <Text style={{ color: '#f5f7ff', marginTop: 10, fontSize: 16, fontWeight: '600' }}>
            {userInfo.email}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <Text style={{ color: '#9eaccf' }}>Abo: {TIER_LABEL[userInfo.tier]}</Text>
            <Text style={{ color: '#9eaccf' }}>
              Scans: {userInfo.scans_used} / {userInfo.scans_limit === -1 ? '∞' : userInfo.scans_limit}
            </Text>
          </View>
        </View>
      )}

      <View style={card}>
        <View style={sectionHeader}>
          <Disc3 size={18} color="#00c2ff" />
          <Text style={label}>Discogs</Text>
        </View>
        <TextInput
          style={inputStyle}
          placeholder="Neuen Discogs-Token eingeben"
          placeholderTextColor="#9eaccf"
          value={discogsToken}
          onChangeText={setDiscogsToken}
          secureTextEntry
          autoCapitalize="none"
        />
        <Text style={{ color: '#9eaccf', fontSize: 12, marginTop: 6 }}>
          discogs.com/settings/developers
        </Text>
        <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} color={discogsTokenSet ? '#86f0c9' : '#9eaccf'} />
          <Text style={{ color: discogsTokenSet ? '#86f0c9' : '#9eaccf', fontSize: 13 }}>
            {discogsTokenSet
              ? discogsUsername
                ? `Verbunden als ${discogsUsername}`
                : 'Token gespeichert'
              : 'Kein Token hinterlegt'}
          </Text>
        </View>
        <TouchableOpacity onPress={saveDiscogs} disabled={savingDiscogs} style={buttonPrimary}>
          <Save size={16} color="#fff" />
          <Text style={buttonPrimaryText}>{savingDiscogs ? 'Speichern…' : 'Discogs speichern'}</Text>
        </TouchableOpacity>
      </View>

      <View style={card}>
        <View style={sectionHeader}>
          <Server size={18} color="#7c5cff" />
          <Text style={label}>Ollama</Text>
        </View>
        <TextInput
          style={inputStyle}
          placeholder="http://192.168.x.x:11434"
          placeholderTextColor="#9eaccf"
          value={ollamaUrl}
          onChangeText={setOllamaUrl}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={saveOllama} disabled={savingOllama} style={buttonPrimary}>
          <Save size={16} color="#fff" />
          <Text style={buttonPrimaryText}>{savingOllama ? 'Speichern…' : 'Ollama speichern'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleLogout} style={buttonSecondary}>
        <LogOut size={16} color="#9eaccf" />
        <Text style={{ color: '#9eaccf', fontSize: 14, fontWeight: '600' }}>Abmelden</Text>
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

const sectionHeader = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 8,
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
  marginTop: 10,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
};

const buttonPrimary = {
  marginTop: 14,
  backgroundColor: '#7c5cff',
  borderRadius: 14,
  padding: 14,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  flexDirection: 'row' as const,
  gap: 8,
};

const buttonPrimaryText = {
  color: '#fff',
  fontWeight: 'bold' as const,
  fontSize: 15,
};

const buttonSecondary = {
  borderRadius: 14,
  padding: 16,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  flexDirection: 'row' as const,
  gap: 8,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
};
