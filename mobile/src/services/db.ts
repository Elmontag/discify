import * as SQLite from 'expo-sqlite';
import type { Album } from '../types';

const db = SQLite.openDatabaseSync('discify.db');

export function initDb() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discogs_release_id INTEGER,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      year INTEGER,
      cover_url TEXT,
      thumb_url TEXT,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      source TEXT NOT NULL DEFAULT 'scan'
    );
  `);
}

export function getAlbums(): Album[] {
  return db.getAllSync<Album>('SELECT * FROM albums ORDER BY added_at DESC');
}

export function insertAlbum(album: Omit<Album, 'id' | 'added_at'>): number {
  const result = db.runSync(
    `INSERT INTO albums (discogs_release_id, title, artist, year, cover_url, thumb_url, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    album.discogs_release_id ?? null,
    album.title,
    album.artist,
    album.year ?? null,
    album.cover_url ?? null,
    album.thumb_url ?? null,
    album.source,
  );
  return Number(result.lastInsertRowId);
}

export function deleteAlbum(id: number) {
  db.runSync('DELETE FROM albums WHERE id = ?', id);
}

export function albumExists(discogsReleaseId: number): boolean {
  const row = db.getFirstSync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM albums WHERE discogs_release_id = ?',
    discogsReleaseId,
  );
  return (row?.cnt ?? 0) > 0;
}
