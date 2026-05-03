import type {
  CollectionResponse,
  DiscogsHit,
  HealthStatus,
  Models,
  ScanResponse,
  Settings,
} from './types'

const BASE = '/api'

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
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
    return fetch(`${BASE}/scan`, { method: 'POST', body: form }).then(async (res) => {
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
}
