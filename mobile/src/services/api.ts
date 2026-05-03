import * as SecureStore from 'expo-secure-store';
import type { AuthTokens, UserInfo, ScanResult, DiscogsRelease } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('auth_token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...((options?.headers as Record<string, string> | undefined) ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  register: (email: string, password: string) =>
    request<AuthTokens>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string): Promise<AuthTokens> => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    return fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      return res.json();
    });
  },

  me: () => request<UserInfo>('/auth/me'),

  scan: async (imageBase64: string, mimeType: string): Promise<ScanResult[]> => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/api/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ image_base64: imageBase64, mime_type: mimeType }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? `HTTP ${res.status}`);
    }
    return res.json();
  },

  discogsSearch: (artist: string, album: string) =>
    request<DiscogsRelease>('/api/discogs/search', {
      method: 'POST',
      body: JSON.stringify({ artist, album }),
    }),

  health: () =>
    request<{
      discogs_connected: boolean;
      anthropic_key_set: boolean;
      vision_backend: string;
    }>('/api/health'),
};
