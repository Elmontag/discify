export interface Album {
  id: number;
  discogs_release_id: number | null;
  instance_id?: number | null;
  title: string;
  artist: string;
  year: number | null;
  cover_url: string | null;
  thumb_url: string | null;
  catno: string;
  label: string;
  barcode: string;
  added_at: string;
  source: 'scan' | 'discogs_sync' | 'manual' | 'barcode';
}

export interface AlternativeHit {
  release_id: number | null;
  master_id: number | null;
  title: string;
  album: string;
  artist: string;
  year: number | null;
  cover_url: string;
  thumb_url: string;
  catno: string;
  label: string;
}

export interface ScanResult {
  ai_artist: string;
  ai_album: string;
  ai_catalog_number: string;
  ai_barcode: string;
  ai_edition?: string;
  found: boolean;
  confidence?: 'high' | 'medium' | 'low';
  search_reason?: string;
  is_suspect?: boolean;
  match_details?: {
    artist_sim: number;
    album_sim: number;
    catno_match: 'exact' | 'partial' | 'none';
    match_quality: 'high' | 'medium' | 'low' | 'suspect';
    is_suspect: boolean;
  } | null;
  release_id: number | null;
  master_id: number | null;
  title: string;
  album: string;
  artist: string;
  year: number | null;
  cover_url: string | null;
  thumb_url: string | null;
  catno: string;
  label: string;
  alternatives?: AlternativeHit[];
}

export interface DiscogsRelease {
  id: number;
  title: string;
  artist: string;
  year: number | null;
  cover_url: string | null;
  thumb_url: string | null;
  label: string | null;
  catno: string | null;
  format: string | null;
}

export interface UserInfo {
  id: number;
  email: string;
  display_name?: string | null;
  tier: 'free' | 'basic' | 'pro';
  scans_used: number;
  scans_limit: number;
  is_admin?: boolean;
  discogs_token_set?: boolean;
  ollama_url?: string;
  created_at?: string | null;
}

export interface MobileScanHistoryItem {
  id: number;
  created_at: string;
  has_image: boolean;
  analysis_json: string;
  discogs_results_json: string;
  status: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
}
