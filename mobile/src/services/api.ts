import * as SecureStore from 'expo-secure-store';
import type { AuthTokens, DiscogsRelease, MobileScanHistoryItem, ScanResult, UserInfo } from '../types';

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

  updateProfile: (data: { display_name?: string; email?: string; password?: string }) =>
    request<UserInfo>('/auth/me/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteAccount: async (): Promise<void> => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/auth/me`, {
      method: 'DELETE',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? `HTTP ${res.status}`);
    }
  },

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

  updateDiscogsToken: async (token: string): Promise<void> => {
    await request('/auth/me/discogs', {
      method: 'PUT',
      body: JSON.stringify({ discogs_token: token }),
    });
  },

  getDiscogsSettings: () =>
    request<{ discogs_token_set: boolean; discogs_username: string | null }>('/auth/me/discogs'),

  updateOllamaUrl: async (url: string): Promise<void> => {
    await request('/auth/me/ollama', {
      method: 'PUT',
      body: JSON.stringify({ ollama_url: url }),
    });
  },

  getOllamaSettings: () =>
    request<{ ollama_url: string; global_ollama_url: string }>('/auth/me/ollama'),

  getScanHistory: (page = 1, perPage = 20) =>
    request<{ total: number; page: number; per_page: number; items: MobileScanHistoryItem[] }>(
      `/auth/me/scans?page=${page}&per_page=${perPage}`,
    ),

  updateScanHistoryItem: (id: number, data: { analysis_json?: string; discogs_results_json?: string }) =>
    request<MobileScanHistoryItem>(`/auth/me/scans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteScanHistoryItem: async (id: number): Promise<void> => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/auth/me/scans/${id}`, {
      method: 'DELETE',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? `HTTP ${res.status}`);
    }
  },

  health: () =>
    request<{
      anthropic_key_set: boolean;
      ollama_url: string;
      vision_backend: string;
      vision_model: string;
    }>('/api/health'),

  discogsSearchSuggestions: (params: { artist?: string; album?: string; catno?: string; barcode?: string }) =>
    request<{ results: Array<{ release_id: number; master_id: number | null; title: string; album: string; artist: string; year: number | null; cover_url: string; thumb_url: string; catno: string; label: string }>; confidence: string }>('/api/discogs/suggestions', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  discogsAdd: (releaseId: number) =>
    request<{ success: boolean; release_id: number }>('/api/discogs/add', {
      method: 'POST',
      body: JSON.stringify({ release_id: releaseId }),
    }),
};
