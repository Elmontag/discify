import type {
  AdminUser,
  CollectionResponse,
  DiscogsHit,
  HealthStatus,
  Models,
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
  me: () => requestUrl<UserMe>('/auth/me'),

  // Settings
  getSettings: () => request<Settings>('/settings'),
  updateSettings: (data: Partial<Settings>) =>
    request<Settings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getModels: () => request<Models>('/settings/models'),

  // Health
  getHealth: () => request<HealthStatus>('/health'),

  // Collection
  getCollection: (page = 1, perPage = 50) =>
    request<CollectionResponse>(`/collection?page=${page}&per_page=${perPage}`),

  // Scan
  scanImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return fetch(`${BASE}/scan`, {
      method: 'POST',
      body: form,
      headers: buildHeaders({ body: form }),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      return res.json() as Promise<ScanResponse>
    })
  },

  // Discogs
  discogsSearch: (artist: string, album: string) =>
    request<DiscogsHit>('/discogs/search', {
      method: 'POST',
      body: JSON.stringify({ artist, album }),
    }),
  discogsManualSearch: (query: string) =>
    request<DiscogsHit>('/discogs/search/manual', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
  discogsAdd: (releaseId: number) =>
    request<{ success: boolean; release_id: number }>('/discogs/add', {
      method: 'POST',
      body: JSON.stringify({ release_id: releaseId }),
    }),

  adminListUsers: () => requestUrl<AdminUser[]>('/admin/users'),
  adminUpdateUser: (
    id: number,
    update: { tier?: 'free' | 'basic' | 'pro'; is_admin?: boolean },
  ) =>
    requestUrl<AdminUser>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    }),
  adminDeleteUser: (id: number) =>
    requestUrl<void>(`/admin/users/${id}`, { method: 'DELETE' }),
}
