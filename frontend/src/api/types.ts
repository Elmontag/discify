// API types shared across the frontend

export interface Settings {
  vision_backend: 'anthropic' | 'ollama'
  anthropic_model: string
  ollama_model: string
  ollama_url: string
  anthropic_api_key: string
  discogs_token: string
  anthropic_api_key_set?: boolean
  discogs_token_set?: boolean
}

export interface HealthStatus {
  discogs_connected: boolean
  discogs_username: string | null
  anthropic_key_set: boolean
  ollama_url: string
  vision_backend: string
  vision_model: string
}

export interface Release {
  instance_id: number
  release_id: number
  title: string
  artist: string
  year: number | null
  cover_url: string
  thumb_url: string
  formats: string[]
  labels: string[]
  date_added: string
}

export interface CollectionResponse {
  releases: Release[]
  pagination: {
    page: number
    pages: number
    per_page: number
    items: number
  }
  username: string
}

export interface ScanResult {
  idx: number
  recognized_artist: string
  recognized_album: string
  found: boolean
  discogs_title: string
  discogs_artist: string
  release_id: number | null
  master_id: number | null
  year: string
  cover_url: string
  thumb_url: string
  in_collection: boolean
  status: 'new' | 'in_collection' | 'not_found'
  include: boolean
}

export interface ScanResponse {
  albums: ScanResult[]
  username: string | null
}

export interface DiscogsHit {
  release_id: number
  master_id: number | null
  title: string
  artist: string
  year: number | null
  cover_url: string
  thumb_url: string
}

export interface Models {
  anthropic: string[]
  ollama: string[]
}
