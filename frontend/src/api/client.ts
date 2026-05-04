import type {
  AdminUser,
  CollectionResponse,
  DiscogsHit,
  HealthStatus,
  Models,
  ScanHistoryItem,
  ScanResponse,
  ScanResult,
  Settings,
  UserMe,
} from './types'

const BASE = '/api'
const TOKEN_KEY = 'discify_web_token'

let authToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null

export function setToken(token: string | null) {
  authToken = token
}

export function getToken(): string | null {
  return authToken
}

function buildHeaders(options?: RequestInit) {
  const headers = new Headers(options?.headers)
  const body = options?.body

  if (
    body !== undefined &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }

  return headers
}

async function requestUrl<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: buildHeaders(options),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

async function request<T>(path: string, options: RequestInit = {}) {
  return requestUrl<T>(`${BASE}${path}`, options)
}

async function authRequest<T>(path: string, options: RequestInit = {}) {
  return requestUrl<T>(path, options)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Bild konnte nicht gelesen werden.'))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Bild konnte nicht gelesen werden.'))
    reader.readAsDataURL(file)
  })
}

export const api = {
  login: (email: string, password: string) =>
    requestUrl<{ access_token: string; token_type: string }>('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ username: email, password }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),
  register: (email: string, password: string) =>
    requestUrl<{ access_token: string; token_type: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => authRequest<UserMe>('/auth/me'),
  updateProfile: (data: { display_name?: string; email?: string; password?: string }) =>
    authRequest<UserMe>('/auth/me/profile', { method: 'PUT', body: JSON.stringify(data) }),
  getDiscogsSettings: () =>
    authRequest<{ discogs_token_set: boolean; discogs_username: string | null }>('/auth/me/discogs'),
  updateDiscogsToken: (token: string) =>
    authRequest<{ discogs_token_set: boolean }>('/auth/me/discogs', {
      method: 'PUT',
      body: JSON.stringify({ discogs_token: token }),
    }),
  getOllamaSettings: () =>
    authRequest<{ ollama_url: string; global_ollama_url: string }>('/auth/me/ollama'),
  updateOllamaUrl: (url: string) =>
    authRequest<{ ollama_url: string }>('/auth/me/ollama', {
      method: 'PUT',
      body: JSON.stringify({ ollama_url: url }),
    }),
  getScanHistory: (page = 1) =>
    authRequest<{ total: number; page: number; per_page: number; items: ScanHistoryItem[] }>(
      `/auth/me/scans?page=${page}`,
    ),

  // Settings
  getSettings: () => authRequest<Settings>('/api/settings'),
  updateSettings: (data: Partial<Settings>) =>
    authRequest<Settings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getModels: () => authRequest<Models>('/api/settings/models'),

  // Health
  getHealth: () => request<HealthStatus>('/health'),

  // Collection
  getCollection: (page = 1, perPage = 50) =>
    authRequest<CollectionResponse>(`/api/collection?page=${page}&per_page=${perPage}`),

  // Scan
  scanImage: async (file: File) => {
    const imageBase64 = await fileToBase64(file)
    const results = await authRequest<Array<{
      ai_artist: string; ai_album: string; ai_catalog_number: string; ai_barcode: string; ai_edition?: string;
      found: boolean; confidence?: string; release_id: number | null; master_id: number | null;
      title: string; album: string; artist: string; year: number | null;
      cover_url: string; thumb_url: string; catno: string; label: string;
      alternatives?: Array<{
        release_id: number | null; master_id: number | null;
        title: string; album: string; artist: string; year: number | null;
        cover_url: string; thumb_url: string; catno: string; label: string;
      }>;
    }>>(
      '/api/scan',
      {
        method: 'POST',
        body: JSON.stringify({
          image_base64: imageBase64,
          mime_type: file.type || 'image/jpeg',
        }),
      },
    )

    const albums: ScanResult[] = results.map((item, idx) => ({
      idx,
      ai_artist: item.ai_artist,
      ai_album: item.ai_album,
      ai_catalog_number: item.ai_catalog_number,
      ai_barcode: item.ai_barcode,
      ai_edition: item.ai_edition ?? '',
      found: item.found,
      confidence: (item.confidence as ScanResult['confidence']) ?? 'low',
      title: item.title,
      album: item.album ?? '',
      artist: item.artist,
      year: item.year ? String(item.year) : '',
      cover_url: item.cover_url ?? '',
      thumb_url: item.thumb_url ?? '',
      catno: item.catno ?? '',
      label: item.label ?? '',
      release_id: item.release_id,
      master_id: item.master_id,
      in_collection: false,
      status: item.found ? ('new' as const) : ('not_found' as const),
      include: item.found,
      alternatives: (item.alternatives ?? []).map((a) => ({
        release_id: a.release_id,
        master_id: a.master_id,
        title: a.title,
        album: a.album ?? '',
        artist: a.artist,
        year: a.year,
        cover_url: a.cover_url ?? '',
        thumb_url: a.thumb_url ?? '',
        catno: a.catno ?? '',
        label: a.label ?? '',
      })),
    }))

    return { albums, username: null } satisfies ScanResponse
  },

  // Discogs
  discogsSearch: (artist: string, album: string) =>
    authRequest<DiscogsHit>('/api/discogs/search', {
      method: 'POST',
      body: JSON.stringify({ artist, album }),
    }),
  discogsManualSearch: (query: string) =>
    authRequest<DiscogsHit>('/api/discogs/search/manual', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
  discogsSearchSuggestions: (params: {
    artist?: string
    album?: string
    catno?: string
    barcode?: string
  }) =>
    authRequest<import('./types').DiscogsSearchSuggestionsResult>('/api/discogs/suggestions', {
      method: 'POST',
      body: JSON.stringify({
        artist: params.artist ?? '',
        album: params.album ?? '',
        catno: params.catno ?? '',
        barcode: params.barcode ?? '',
      }),
    }),
  discogsAdd: (releaseId: number) =>
    authRequest<{ success: boolean; release_id: number }>('/api/discogs/add', {
      method: 'POST',
      body: JSON.stringify({ release_id: releaseId }),
    }),

  // Scan history
  updateScanHistoryItem: (id: number, data: { analysis_json?: string; discogs_results_json?: string }) =>
    authRequest<ScanHistoryItem>(`/auth/me/scans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteScanHistoryItem: (id: number) =>
    authRequest<void>(`/auth/me/scans/${id}`, { method: 'DELETE' }),

  // Account deletion
  deleteAccount: () => authRequest<void>('/auth/me', { method: 'DELETE' }),

  adminListUsers: () => authRequest<AdminUser[]>('/admin/users'),
  adminUpdateUser: (
    id: number,
    update: { tier?: 'free' | 'basic' | 'pro'; is_admin?: boolean },
  ) =>
    authRequest<AdminUser>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    }),
  adminDeleteUser: (id: number) => authRequest<void>(`/admin/users/${id}`, { method: 'DELETE' }),
}
