// API types shared across the frontend

export interface Settings {
  vision_backend: 'anthropic' | 'ollama'
  anthropic_model: string
  ollama_model: string
  ollama_url: string
  anthropic_api_key: string
  anthropic_api_key_set?: boolean
}

export interface UserMe {
  id: number
  email: string
  display_name: string | null
  tier: string
  scans_used: number
  scans_limit: number
  is_admin: boolean
  discogs_token_set: boolean
  ollama_url: string
  created_at?: string | null
}

export interface ScanHistoryItem {
  id: number
  created_at: string
  has_image: boolean
  analysis_json: string
  discogs_results_json: string
  status: string
}

export interface ScanHistoryDetail {
  id: number
  created_at: string
  has_image: boolean
  analysis: Array<{
    artist: string
    album: string
    catalog_number: string
    barcode: string
    sticker_text: string
    confidence: string
  }>
  discogsResults: Array<{
    ai_artist: string
    ai_album: string
    ai_catalog_number: string
    ai_barcode: string
    ai_edition?: string
    found: boolean
    confidence?: string
    release_id: number | null
    title: string
    album?: string
    artist: string
    year: number | null
    cover_url: string
    thumb_url: string
    catno: string
    label: string
    alternatives?: AlternativeHit[]
  }>
  status: string
}

export interface AdminUser {
  id: number
  email: string
  tier: string
  is_admin: boolean
  scans_used: number
  created_at: string
}

export interface HealthStatus {
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
  catno: string
  label: string
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

export interface AlternativeHit {
  release_id: number | null
  master_id: number | null
  title: string
  album: string
  artist: string
  year: number | null
  cover_url: string
  thumb_url: string
  catno: string
  label: string
}

export interface ScanResult {
  idx: number
  ai_artist: string
  ai_album: string
  ai_catalog_number: string
  ai_barcode: string
  ai_edition: string
  found: boolean
  confidence: 'high' | 'medium' | 'low'
  search_reason?: string
  is_suspect: boolean
  match_details: {
    artist_sim: number
    album_sim: number
    catno_match: 'exact' | 'partial' | 'none'
    match_quality: 'high' | 'medium' | 'low' | 'suspect'
    is_suspect: boolean
  } | null
  title: string
  album: string
  artist: string
  year: string
  cover_url: string
  thumb_url: string
  catno: string
  label: string
  release_id: number | null
  master_id: number | null
  in_collection: boolean
  status: 'new' | 'in_collection' | 'not_found'
  include: boolean
  alternatives: AlternativeHit[]
}

export interface ScanResponse {
  albums: ScanResult[]
  username: string | null
}

export interface DiscogsHit {
  release_id: number
  master_id: number | null
  title: string
  album: string
  artist: string
  year: number | null
  cover_url: string
  thumb_url: string
  catno: string
  label: string
}

export interface DiscogsSearchSuggestionsResult {
  results: DiscogsHit[]
  confidence: 'high' | 'medium' | 'low'
}

export interface Models {
  anthropic: string[]
  ollama: string[]
}
