import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Lock,
  LogOut,
  Mail,
  Save,
  Trash2,
  User,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { UserInfo } from '../types';

const TIER_LABEL: Record<string, string> = { free: 'Free', basic: 'Basic', pro: 'Pro' };
const TIER_COLOR: Record<string, string> = { free: '#9eaccf', basic: '#8ee8ff', pro: '#ffe29e' };

export default function AccountScreen() {
  const { logout } = useAuth();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [section, setSection] = useState<'info' | 'profile' | 'password'>('info');

  useFocusEffect(useCallback(() => {
    api.me()
      .then((me) => {
        setUserInfo(me);
        setDisplayName(me.display_name ?? '');
        setEmail(me.email);
      })
      .catch(() => {});
  }, []));

  async function saveProfile() {
    if (password && password !== passwordConfirm) {
      setProfileErr('Passwörter stimmen nicht überein.');
      return;
    }
    setSavingProfile(true);
    setProfileErr('');
    setProfileMsg('');
    try {
      const payload: { display_name?: string; email?: string; password?: string } = {};
      if (displayName !== (userInfo?.display_name ?? '')) payload.display_name = displayName;
      if (email !== userInfo?.email) payload.email = email;
      if (password) payload.password = password;
      if (Object.keys(payload).length === 0) { setProfileMsg('Keine Änderungen.'); return; }
      const updated = await api.updateProfile(payload);
      setUserInfo(updated);
      setDisplayName(updated.display_name ?? '');
      setEmail(updated.email);
      setPassword('');
      setPasswordConfirm('');
      if (updated.email !== userInfo?.email) { await logout(); return; }
      setProfileMsg('Profil gespeichert.');
    } catch (e: any) {
      setProfileErr(e.message);
    } finally {
      setSavingProfile(false);
    }
  }

  function handleLogout() {
    Alert.alert('Abmelden', 'Möchtest du dich abmelden?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Abmelden', style: 'destructive', onPress: () => logout() },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Konto löschen',
      'Alle deine Daten werden unwiderruflich gelöscht. Bist du sicher?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Endgültig löschen',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try { await api.deleteAccount(); await logout(); }
            catch (e: any) { Alert.alert('Fehler', e.message); setDeleting(false); }
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#07111f' }}
      contentContainerStyle={{ paddingTop: 56, paddingBottom: 40 }}
    >
      <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#f5f7ff' }}>Konto</Text>
        {userInfo && (
          <Text style={{ color: '#9eaccf', fontSize: 14, marginTop: 4 }}>{userInfo.email}</Text>
        )}
      </View>

      {/* Plan banner */}
      {userInfo && (
        <View style={{ marginHorizontal: 20, marginBottom: 20, ...card, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: '#9eaccf', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Abo-Plan</Text>
            <Text style={{ color: TIER_COLOR[userInfo.tier] ?? '#f5f7ff', fontSize: 18, fontWeight: 'bold', marginTop: 2 }}>
              {TIER_LABEL[userInfo.tier]}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#9eaccf', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Scans</Text>
            <Text style={{ color: '#f5f7ff', fontSize: 18, fontWeight: 'bold', marginTop: 2 }}>
              {userInfo.scans_used} / {userInfo.scans_limit === -1 ? '∞' : userInfo.scans_limit}
            </Text>
          </View>
        </View>
      )}

      {/* Profile section */}
      <View style={{ marginHorizontal: 20, marginBottom: 12, ...card }}>
        <TouchableOpacity
          onPress={() => setSection(section === 'profile' ? 'info' : 'profile')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <User size={18} color="#7c5cff" />
          <Text style={{ flex: 1, color: '#f5f7ff', fontSize: 15, fontWeight: '600' }}>Profil bearbeiten</Text>
          <ChevronRight size={16} color="#9eaccf" style={{ transform: [{ rotate: section === 'profile' ? '90deg' : '0deg' }] }} />
        </TouchableOpacity>

        {section === 'profile' && (
          <View style={{ marginTop: 16, gap: 12 }}>
            {profileErr ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={14} color="#ffb0b0" />
                <Text style={{ color: '#ffb0b0', fontSize: 13 }}>{profileErr}</Text>
              </View>
            ) : null}
            {profileMsg ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} color="#86f0c9" />
                <Text style={{ color: '#86f0c9', fontSize: 13 }}>{profileMsg}</Text>
              </View>
            ) : null}
            <View>
              <Text style={fieldLabel}>Anzeigename</Text>
              <View style={inputRow}>
                <User size={14} color="#9eaccf" />
                <TextInput style={inlineInput} placeholder="Anzeigename" placeholderTextColor="#9eaccf" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" />
              </View>
            </View>
            <View>
              <Text style={fieldLabel}>E-Mail</Text>
              <View style={inputRow}>
                <Mail size={14} color="#9eaccf" />
                <TextInput style={inlineInput} placeholder="E-Mail" placeholderTextColor="#9eaccf" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              </View>
            </View>
            <View>
              <Text style={fieldLabel}>Neues Passwort (optional)</Text>
              <View style={inputRow}>
                <Lock size={14} color="#9eaccf" />
                <TextInput style={inlineInput} placeholder="Neues Passwort" placeholderTextColor="#9eaccf" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
              </View>
            </View>
            {password ? (
              <View>
                <Text style={fieldLabel}>Passwort bestätigen</Text>
                <View style={inputRow}>
                  <Lock size={14} color="#9eaccf" />
                  <TextInput style={inlineInput} placeholder="Passwort bestätigen" placeholderTextColor="#9eaccf" value={passwordConfirm} onChangeText={setPasswordConfirm} secureTextEntry autoCapitalize="none" />
                </View>
              </View>
            ) : null}
            <TouchableOpacity onPress={saveProfile} disabled={savingProfile} style={btnPrimary}>
              {savingProfile ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Save size={15} color="#fff" />
                  <Text style={btnPrimaryText}>Speichern</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity onPress={handleLogout} style={{ marginHorizontal: 20, marginBottom: 12, ...btnSecondary }}>
        <LogOut size={16} color="#9eaccf" />
        <Text style={{ color: '#9eaccf', fontSize: 15, fontWeight: '600' }}>Abmelden</Text>
      </TouchableOpacity>

      {/* Delete account */}
      <View style={{ marginHorizontal: 20, ...card, borderColor: 'rgba(255,100,100,0.2)', backgroundColor: 'rgba(255,100,100,0.04)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Trash2 size={18} color="#ffb0b0" />
          <Text style={{ color: '#ffb0b0', fontSize: 15, fontWeight: '600' }}>Konto löschen</Text>
        </View>
        <Text style={{ color: '#9eaccf', fontSize: 13, marginBottom: 12 }}>
          Alle deine Daten werden unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
        </Text>
        <TouchableOpacity
          onPress={handleDeleteAccount}
          disabled={deleting}
          style={{ ...btnSecondary, borderColor: 'rgba(255,100,100,0.3)', opacity: deleting ? 0.5 : 1 }}
        >
          <Trash2 size={15} color="#ffb0b0" />
          <Text style={{ color: '#ffb0b0', fontSize: 14, fontWeight: '600' }}>
            {deleting ? 'Wird gelöscht…' : 'Konto endgültig löschen'}
          </Text>
        </TouchableOpacity>
      </View>
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

const fieldLabel = {
  color: '#9eaccf',
  fontSize: 11,
  fontWeight: '600' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.8,
  marginBottom: 6,
};

const inputRow = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 10,
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: 10,
  paddingHorizontal: 12,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
};

const inlineInput = {
  flex: 1,
  padding: 12,
  color: '#f5f7ff',
  fontSize: 15,
};

const btnPrimary = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 8,
  backgroundColor: '#7c5cff',
  borderRadius: 14,
  padding: 14,
};

const btnPrimaryText = {
  color: '#fff',
  fontWeight: 'bold' as const,
  fontSize: 15,
};

const btnSecondary = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 8,
  borderRadius: 14,
  padding: 14,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
};
