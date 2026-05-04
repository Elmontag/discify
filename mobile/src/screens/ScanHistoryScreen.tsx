import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Clock, Disc3, Save, Trash2, X } from 'lucide-react-native';
import { api } from '../services/api';
import type { AlternativeHit, MobileScanHistoryItem } from '../types';

interface ParsedResult {
  artist: string;
  title: string;
  album?: string;
  catno: string;
  label: string;
  cover_url?: string;
  thumb_url?: string;
  release_id?: number | null;
  master_id?: number | null;
  year?: number | null;
  found?: boolean;
  ai_artist?: string;
  ai_album?: string;
  confidence?: string;
  alternatives?: AlternativeHit[];
}

interface ParsedItem extends MobileScanHistoryItem {
  discogsResults: ParsedResult[];
}

function parseItem(item: MobileScanHistoryItem): ParsedItem {
  let discogsResults: ParsedResult[] = [];
  try { discogsResults = JSON.parse(item.discogs_results_json); } catch { /* */ }
  return { ...item, discogsResults };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ScanHistoryScreen() {
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editItem, setEditItem] = useState<ParsedItem | null>(null);
  const [editResults, setEditResults] = useState<ParsedResult[]>([]);
  const [originalEditResults, setOriginalEditResults] = useState<ParsedResult[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await api.getScanHistory(p);
      setTotal(data.total);
      setPage(p);
      setItems((prev) =>
        p === 1 ? data.items.map(parseItem) : [...prev, ...data.items.map(parseItem)],
      );
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  async function handleDelete(id: number) {
    Alert.alert('Löschen', 'Scan-Eintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          try {
            await api.deleteScanHistoryItem(id);
            setItems((prev) => prev.filter((i) => i.id !== id));
            setTotal((t) => t - 1);
          } catch (e: any) {
            Alert.alert('Fehler', e.message);
          }
        },
      },
    ]);
  }

  function openEdit(item: ParsedItem) {
    const copy = JSON.parse(JSON.stringify(item.discogsResults));
    setEditItem(item);
    setEditResults(copy);
    setOriginalEditResults(copy);
  }

  async function saveEdit() {
    if (!editItem) return;
    setSaving(true);
    try {
      const updated = await api.updateScanHistoryItem(editItem.id, {
        discogs_results_json: JSON.stringify(editResults),
      });
      setItems((prev) => prev.map((i) => (i.id === editItem.id ? parseItem(updated) : i)));
      setEditItem(null);
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    } finally {
      setSaving(false);
    }
  }

  function updateField(idx: number, field: keyof ParsedResult, value: string) {
    setEditResults((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  function swapAlternative(cdIdx: number, alt: AlternativeHit) {
    setEditResults((prev) =>
      prev.map((r, i) =>
        i === cdIdx
          ? {
              ...r,
              artist: alt.artist,
              title: alt.title,
              album: alt.album,
              catno: alt.catno ?? '',
              label: alt.label ?? '',
              cover_url: alt.cover_url ?? '',
              thumb_url: alt.thumb_url ?? '',
              release_id: alt.release_id,
              year: alt.year,
            }
          : r,
      ),
    );
  }

  function restoreOriginalResult(cdIdx: number) {
    setEditResults((prev) =>
      prev.map((r, i) => (i === cdIdx ? originalEditResults[i] : r)),
    );
  }

  const renderCard = ({ item }: { item: ParsedItem }) => {
    const first = item.discogsResults[0];
    const thumb = first?.thumb_url || first?.cover_url;
    return (
      <View style={styles.card}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Disc3 size={28} color="#9eaccf" />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
          {item.discogsResults.slice(0, 2).map((r, i) => (
            <Text key={i} style={styles.cardTitle} numberOfLines={1}>
              {r.artist || '—'}{(r.album || r.title) ? ` – ${r.album || r.title}` : ''}
            </Text>
          ))}
          {item.discogsResults.length > 2 && (
            <Text style={styles.cardSubtitle}>+{item.discogsResults.length - 2} weitere</Text>
          )}
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => openEdit(item)} style={styles.editBtn}>
            <Text style={{ color: '#a88eff', fontSize: 12, fontWeight: '600' }}>Bearbeiten</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
            <Trash2 size={14} color="#ffb0b0" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan-Verlauf</Text>
        <Text style={styles.subtitle}>{total} Scans gespeichert</Text>
      </View>

      {!loading && items.length === 0 ? (
        <View style={styles.empty}>
          <Clock size={56} color="#9eaccf" />
          <Text style={styles.emptyTitle}>Noch keine Scans</Text>
          <Text style={styles.emptyText}>Starte deinen ersten Scan.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 80 }}
          onEndReached={() => {
            if (!loading && items.length < total) load(page + 1);
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loading ? <ActivityIndicator color="#7c5cff" style={{ marginTop: 16 }} /> : null}
        />
      )}

      {/* Edit modal */}
      <Modal visible={!!editItem} animationType="slide" transparent onRequestClose={() => setEditItem(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Scan bearbeiten</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}>
                <X size={22} color="#9eaccf" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
              {editResults.map((r, i) => (
                <View key={i} style={styles.editCard}>
                  <Text style={styles.editCardLabel}>CD {i + 1}</Text>
                  {(['artist', 'album', 'catno', 'label'] as (keyof ParsedResult)[]).map((field) => (
                    <TextInput
                      key={field}
                      style={styles.editInput}
                      value={(r[field] as string) ?? (field === 'album' ? r.title : '')}
                      onChangeText={(v) => updateField(i, field, v)}
                      placeholder={field === 'artist' ? 'Interpret' : field === 'album' ? 'Album' : field === 'catno' ? 'Katalognr.' : 'Label'}
                      placeholderTextColor="#9eaccf"
                      autoCapitalize="none"
                    />
                  ))}
                  {r.alternatives && r.alternatives.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={[styles.editCardLabel, { marginBottom: 6 }]}>Alternativen</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            onPress={() => restoreOriginalResult(i)}
                            style={{ borderRadius: 8, borderWidth: 1, borderColor: 'rgba(124,92,255,0.4)', backgroundColor: 'rgba(124,92,255,0.12)', paddingHorizontal: 8, paddingVertical: 5 }}
                          >
                            <Text style={{ color: '#a88eff', fontSize: 11, fontWeight: '600' }}>↩ Original</Text>
                          </TouchableOpacity>
                          {r.alternatives.slice(0, 6).map((alt, j) => (
                            <TouchableOpacity
                              key={j}
                              onPress={() => swapAlternative(i, alt)}
                              style={{ borderRadius: 8, borderWidth: 1, borderColor: 'rgba(124,92,255,0.3)', backgroundColor: 'rgba(124,92,255,0.06)', paddingHorizontal: 8, paddingVertical: 5 }}
                            >
                              <Text style={{ color: '#a88eff', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                                {alt.artist}{alt.album ? ` – ${alt.album}` : ''}
                              </Text>
                              {alt.year ? <Text style={{ color: '#9eaccf', fontSize: 10 }}>· {alt.year}</Text> : null}
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={saveEdit} disabled={saving} style={styles.saveBtn}>
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Save size={16} color="#fff" />}
                <Text style={styles.saveBtnText}>{saving ? 'Speichert…' : 'Speichern'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#07111f' },
  header: {
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: { fontSize: 20, fontWeight: 'bold' as const, color: '#f5f7ff' },
  subtitle: { fontSize: 12, color: '#9eaccf', marginTop: 2 },
  empty: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold' as const, color: '#f5f7ff' },
  emptyText: { fontSize: 14, color: '#9eaccf', textAlign: 'center' as const },
  card: {
    flex: 1, backgroundColor: '#0d1e33', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' as const,
  },
  thumb: { width: '100%' as any, aspectRatio: 1 },
  thumbPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  cardBody: { padding: 10, gap: 3 },
  cardDate: { fontSize: 10, color: '#9eaccf' },
  cardTitle: { fontSize: 11, fontWeight: '600' as const, color: '#f5f7ff' },
  cardSubtitle: { fontSize: 10, color: '#9eaccf' },
  cardActions: { flexDirection: 'row' as const, padding: 8, gap: 6 },
  editBtn: {
    flex: 1, alignItems: 'center' as const, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(124,92,255,0.3)',
  },
  deleteBtn: {
    alignItems: 'center' as const, justifyContent: 'center' as const,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,100,100,0.3)',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(7,17,31,0.88)', justifyContent: 'flex-end' as const },
  modalSheet: {
    backgroundColor: '#0d1e33', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)', maxHeight: '85%' as any,
  },
  modalHeader: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, padding: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold' as const, color: '#f5f7ff' },
  editCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 12, gap: 8,
  },
  editCardLabel: { fontSize: 10, fontWeight: 'bold' as const, color: '#9eaccf', textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  editInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8,
    padding: 10, color: '#f5f7ff', fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  saveBtn: {
    backgroundColor: '#7c5cff', borderRadius: 14, padding: 14,
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold' as const, fontSize: 15 },
};
