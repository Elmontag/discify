export interface Album {
  id: number;
  discogs_release_id: number | null;
  title: string;
  artist: string;
  year: number | null;
  cover_url: string | null;
  thumb_url: string | null;
  added_at: string;
  source: 'scan' | 'discogs_sync';
}

export interface ScanResult {
  artist: string;
  album: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface DiscogsRelease {
  id: number;
  title: string;
  artist: string;
  year: number | null;
  cover_url: string | null;
  thumb_url: string | null;
  label: string | null;
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

export interface AuthTokens {
  access_token: string;
  token_type: string;
}
