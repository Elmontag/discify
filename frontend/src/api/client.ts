import type {
  AdminUser,
  CollectionResponse,
  DiscogsHit,
  HealthStatus,
  Models,
  ScanHistoryItem,
  ScanResponse,
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
  getSettings: () => request<Settings>('/settings'),
  updateSettings: (data: Partial<Settings>) =>
    authRequest<Settings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getModels: () => request<Models>('/settings/models'),

  // Health
  getHealth: () => request<HealthStatus>('/health'),

  // Collection
  getCollection: (page = 1, perPage = 50) =>
    authRequest<CollectionResponse>(`/api/collection?page=${page}&per_page=${perPage}`),

  // Scan
  scanImage: async (file: File) => {
    const imageBase64 = await fileToBase64(file)
    const results = await authRequest<Array<{ artist: string; album: string; confidence: string }>>(
      '/api/scan',
      {
        method: 'POST',
        body: JSON.stringify({
          image_base64: imageBase64,
          mime_type: file.type || 'image/jpeg',
        }),
      },
    )

    const albums = await Promise.all(
      results.map(async (item, idx) => {
        try {
          const hit = await authRequest<DiscogsHit>('/api/discogs/search', {
            method: 'POST',
            body: JSON.stringify({ artist: item.artist, album: item.album }),
          })
          return {
            idx,
            recognized_artist: item.artist,
            recognized_album: item.album,
            found: true,
            discogs_title: hit.title,
            discogs_artist: hit.artist,
            release_id: hit.release_id,
            master_id: hit.master_id,
            year: hit.year ? String(hit.year) : '',
            cover_url: hit.cover_url ?? '',
            thumb_url: hit.thumb_url ?? '',
            in_collection: false,
            status: 'new' as const,
            include: true,
          }
        } catch {
          return {
            idx,
            recognized_artist: item.artist,
            recognized_album: item.album,
            found: false,
            discogs_title: '',
            discogs_artist: '',
            release_id: null,
            master_id: null,
            year: '',
            cover_url: '',
            thumb_url: '',
            in_collection: false,
            status: 'not_found' as const,
            include: false,
          }
        }
      }),
    )

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
  discogsAdd: (releaseId: number) =>
    authRequest<{ success: boolean; release_id: number }>('/api/discogs/add', {
      method: 'POST',
      body: JSON.stringify({ release_id: releaseId }),
    }),

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
