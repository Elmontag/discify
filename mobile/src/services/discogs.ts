import * as SecureStore from 'expo-secure-store';
import type { DiscogsRelease } from '../types';

const BASE = 'https://api.discogs.com';

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('discogs_token');
}

async function discogsRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'User-Agent': 'Discify/1.0',
    ...(token ? { Authorization: `Discogs token=${token}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    throw new Error(`Discogs error: HTTP ${res.status}`);
  }
  return res.json();
}

export async function getDiscogsUsername(): Promise<string | null> {
  try {
    const data = await discogsRequest<{ username: string }>('/oauth/identity');
    return data.username;
  } catch {
    return null;
  }
}

export async function getCollection(
  username: string,
  page = 1,
): Promise<{ releases: DiscogsRelease[]; total_pages: number }> {
  const data = await discogsRequest<any>(
    `/users/${username}/collection/folders/0/releases?page=${page}&per_page=50&sort=added&sort_order=desc`,
  );
  const releases: DiscogsRelease[] = (data.releases ?? []).map((r: any) => ({
    id: r.id,
    title: r.basic_information?.title ?? '',
    artist: r.basic_information?.artists?.[0]?.name ?? '',
    year: r.basic_information?.year ?? null,
    cover_url: r.basic_information?.cover_image ?? null,
    thumb_url: r.basic_information?.thumb ?? null,
    label: r.basic_information?.labels?.[0]?.name ?? null,
    format: r.basic_information?.formats?.[0]?.name ?? null,
  }));
  return { releases, total_pages: data.pagination?.pages ?? 1 };
}

export async function addToCollection(
  username: string,
  releaseId: number,
): Promise<boolean> {
  try {
    const token = await getToken();
    const res = await fetch(
      `${BASE}/users/${username}/collection/folders/1/releases/${releaseId}`,
      {
        method: 'POST',
        headers: {
          'User-Agent': 'Discify/1.0',
          Authorization: `Discogs token=${token}`,
        },
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
