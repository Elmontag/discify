import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Disc, Library, Pencil, Trash2, X } from 'lucide-react-native';
import { api } from '../services/api';
import AddSheetModal from '../components/AddSheetModal';

const { width } = Dimensions.get('window');
const COLS = width >= 600 ? 3 : 2;
const CARD_W = (width - 20 * 2 - (COLS - 1) * 12) / COLS;

interface CollectionRelease {
  instance_id: number;
  release_id: number;
  title: string;
  artist: string;
  year: number | null;
  cover_url: string;
  thumb_url: string;
  catno: string;
  label: string;
  date_added: string;
}

interface EditState {
  instance_id: number;
  release_id: number;
  title: string;
  artist: string;
  year: string;
  catno: string;
  label: string;
}

export default function CollectionScreen() {
  const [releases, setReleases] = useState<CollectionRelease[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getCollection(p);
      setReleases((prev) => (p === 1 ? data.releases : [...prev, ...data.releases]));
      setTotalPages(data.pagination.pages);
      setPage(p);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load(1);
  }, [load]));

  function openEdit(item: CollectionRelease) {
    setEditState({
      instance_id: item.instance_id,
      release_id: item.release_id,
      title: item.title,
      artist: item.artist,
      year: item.year ? String(item.year) : '',
      catno: item.catno ?? '',
      label: item.label ?? '',
    });
  }

  async function saveEdit() {
    if (!editState) return;
    setSaving(true);
    try {
      await api.discogsPatchCollection(editState.release_id, {
        title: editState.title,
        artist: editState.artist,
        catno: editState.catno,
        year: editState.year ? parseInt(editState.year, 10) : null,
        label: editState.label,
      });
      setReleases((prev) =>
        prev.map((r) =>
          r.instance_id === editState.instance_id
            ? { ...r, title: editState.title, artist: editState.artist, year: editState.year ? parseInt(editState.year, 10) : null, catno: editState.catno, label: editState.label }
            : r,
        ),
      );
      setEditState(null);
    } catch (e: unknown) {
      Alert.alert('Fehler', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(item: CollectionRelease) {
    Alert.alert(
      'Album entfernen',
      `"${item.title}" aus der Sammlung entfernen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.discogsRemove(item.instance_id, item.release_id);
              setReleases((prev) => prev.filter((r) => r.instance_id !== item.instance_id));
              setEditState(null);
            } catch (e: unknown) {
              Alert.alert('Fehler', (e as Error).message);
            }
          },
        },
      ],
    );
  }

  const filtered = releases.filter((r) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.artist.toLowerCase().includes(q);
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#07111f' }}>
      <View
        style={{
          paddingTop: 56,
          paddingHorizontal: 20,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Library size={20} color="#f5f7ff" />
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#f5f7ff', marginLeft: 8 }}>
              Sammlung
            </Text>
          </View>
          <Text style={{ color: '#9eaccf', fontSize: 13 }}>{releases.length} Alben</Text>
        </View>
        <TextInput
          style={{
            marginTop: 12,
            backgroundColor: '#0d1e33',
            borderRadius: 12,
            padding: 12,
            color: '#f5f7ff',
            fontSize: 15,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)',
          }}
          placeholder="Suchen…"
          placeholderTextColor="#9eaccf"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {error ? (
        <View style={{ margin: 20, padding: 16, backgroundColor: 'rgba(255,100,100,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,100,100,0.2)' }}>
          <Text style={{ color: '#ffb0b0', fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.instance_id)}
        numColumns={COLS}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        columnWrapperStyle={COLS > 1 ? { gap: 12 } : undefined}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(1)} tintColor="#7c5cff" />}
        onEndReached={() => { if (page < totalPages && !loading) void load(page + 1); }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', paddingTop: 80 }}>
              <Disc size={48} color="#9eaccf" />
              <Text style={{ color: '#f5f7ff', fontWeight: 'bold', marginTop: 16, fontSize: 18 }}>
                {query ? 'Keine Treffer' : 'Sammlung ist leer'}
              </Text>
              <Text style={{ color: '#9eaccf', marginTop: 8, textAlign: 'center' }}>
                {query ? 'Versuche einen anderen Suchbegriff.' : 'Tippe auf + um deine ersten CDs zu scannen'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View
            style={{
              width: CARD_W,
              backgroundColor: '#0d1e33',
              borderRadius: 12,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
            }}
          >
            {(item.thumb_url || item.cover_url) ? (
              <Image
                source={{ uri: item.thumb_url || item.cover_url }}
                style={{ width: CARD_W, height: CARD_W }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: CARD_W,
                  height: CARD_W,
                  backgroundColor: '#1a2a3f',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Disc size={40} color="#9eaccf" />
              </View>
            )}
            <View style={{ padding: 10 }}>
              <Text style={{ color: '#f5f7ff', fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={{ color: '#9eaccf', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                {item.artist}
              </Text>
              {(item.year || item.label) ? (
                <Text style={{ color: '#9eaccf', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                  {[item.label, item.year].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {item.catno ? (
                <Text style={{ color: '#9eaccf', fontSize: 10, marginTop: 1, opacity: 0.6 }} numberOfLines={1}>
                  {item.catno}
                </Text>
              ) : null}
              <TouchableOpacity
                onPress={() => openEdit(item)}
                style={{
                  marginTop: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  alignSelf: 'flex-start',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(124,92,255,0.3)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Pencil size={11} color="#a88eff" />
                <Text style={{ color: '#a88eff', fontSize: 11, fontWeight: '600' }}>Bearbeiten</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity
        onPress={() => setAddSheetOpen(true)}
        style={{
          position: 'absolute',
          bottom: 90,
          right: 20,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: '#7c5cff',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#7c5cff',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Text style={{ fontSize: 28, color: '#fff' }}>+</Text>
      </TouchableOpacity>

      {addSheetOpen && (
        <AddSheetModal onClose={() => setAddSheetOpen(false)} onAlbumAdded={() => load(1)} />
      )}

      {/* Edit Modal */}
      <Modal visible={!!editState} animationType="slide" transparent onRequestClose={() => setEditState(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(7,17,31,0.88)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#0d1e33',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
              padding: 20,
              paddingBottom: 40,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#f5f7ff' }}>Album bearbeiten</Text>
              <TouchableOpacity onPress={() => setEditState(null)}>
                <X size={22} color="#9eaccf" />
              </TouchableOpacity>
            </View>

            {editState && (
              <View style={{ gap: 12 }}>
                {([['title', 'Albumtitel'], ['artist', 'Interpret'], ['year', 'Jahr'], ['catno', 'Katalognummer'], ['label', 'Label']] as const).map(([field, lbl]) => (
                  <View key={field}>
                    <Text style={{ color: '#9eaccf', fontSize: 12, marginBottom: 4 }}>{lbl}</Text>
                    <TextInput
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 10,
                        padding: 12,
                        color: '#f5f7ff',
                        fontSize: 14,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                      }}
                      value={editState[field]}
                      onChangeText={(v) => setEditState((prev) => prev ? { ...prev, [field]: v } : prev)}
                      placeholder={lbl}
                      placeholderTextColor="#9eaccf"
                      keyboardType={field === 'year' ? 'numeric' : 'default'}
                      autoCapitalize={field === 'year' ? 'none' : 'sentences'}
                    />
                  </View>
                ))}

                <TouchableOpacity
                  onPress={saveEdit}
                  disabled={saving}
                  style={{
                    marginTop: 8,
                    backgroundColor: '#7c5cff',
                    borderRadius: 14,
                    padding: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Speichern</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => editState && confirmDelete({ instance_id: editState.instance_id, release_id: editState.release_id, title: editState.title, artist: editState.artist, year: editState.year ? parseInt(editState.year, 10) : null, cover_url: '', thumb_url: '', catno: editState.catno, label: editState.label, date_added: '' })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    borderRadius: 14,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(255,100,100,0.3)',
                  }}
                >
                  <Trash2 size={16} color="#ffb0b0" />
                  <Text style={{ color: '#ffb0b0', fontWeight: '600', fontSize: 15 }}>Aus Sammlung entfernen</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
