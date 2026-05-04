import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { BarcodeScanningResult } from 'expo-camera';
import {
  Camera as CameraIcon,
  FileImage,
  Loader2,
  Search,
  ScanLine,
  X,
  Plus,
  CheckCircle2,
} from 'lucide-react-native';
import { api } from '../services/api';
import { albumExists, insertAlbum } from '../services/db';
import type { ScanResult, AlternativeHit } from '../types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Tab = 'search' | 'barcode' | 'ai-camera' | 'ai-file';

interface Suggestion {
  release_id: number;
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

interface ResultItem {
  scan: ScanResult;
  selected: boolean;
  editArtist: string;
  editAlbum: string;
  editCatno: string;
  editYear: string;
  editBarcode: string;
  alternatives: AlternativeHit[];
}

function SuggestionCard({ suggestion: s, onAdd }: { suggestion: Suggestion; onAdd: () => void }) {
  const thumb = s.thumb_url || s.cover_url;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, marginBottom: 6 }}>
      <View style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' }}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={{ width: 44, height: 44 }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#9eaccf', fontSize: 20 }}>💿</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: '#f5f7ff', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{s.artist}</Text>
        <Text style={{ color: '#9eaccf', fontSize: 12 }} numberOfLines={1}>{s.album || s.title}</Text>
        <Text style={{ color: 'rgba(158,172,207,0.6)', fontSize: 10 }} numberOfLines={1}>
          {[s.year, s.catno, s.label].filter(Boolean).join(' · ') || '–'}
        </Text>
      </View>
      <TouchableOpacity onPress={onAdd} style={{ backgroundColor: 'rgba(124,92,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
        <Text style={{ color: '#a88eff', fontSize: 12, fontWeight: '700' }}>+ Hinzufügen</Text>
      </TouchableOpacity>
    </View>
  );
}

interface Props {
  onClose: () => void;
  onAlbumAdded?: () => void;
}

export default function AddSheetModal({ onClose, onAlbumAdded }: Props) {
  const [tab, setTab] = useState<Tab>('search');
  const handleAdded = useCallback(() => { onAlbumAdded?.(); onClose(); }, [onAlbumAdded, onClose]);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Hinzufügen</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color="#9eaccf" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            {([
              ['search', 'Suche', Search],
              ['barcode', 'Barcode', ScanLine],
              ['ai-camera', 'KI-Kamera', CameraIcon],
              ['ai-file', 'KI-Datei', FileImage],
            ] as [Tab, string, React.ComponentType<any>][]).map(([id, label, Icon]) => (
              <TouchableOpacity
                key={id}
                onPress={() => setTab(id)}
                style={[styles.tabBtn, tab === id && styles.tabBtnActive]}
              >
                <Icon size={16} color={tab === id ? '#7c5cff' : '#9eaccf'} />
                <Text style={[styles.tabLabel, tab === id && styles.tabLabelActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>
            {tab === 'search' && <SearchTab onAdded={handleAdded} />}
            {tab === 'barcode' && <BarcodeTab onAdded={handleAdded} />}
            {tab === 'ai-camera' && <AiCameraTab onAdded={handleAdded} />}
            {tab === 'ai-file' && <AiFileTab onAdded={handleAdded} />}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Search Tab ──────────────────────────────────────────────────────────────

function SearchTab({ onAdded }: { onAdded: () => void }) {
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [catno, setCatno] = useState('');
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState('');

  async function search() {
    if (!artist && !album && !catno && !barcode) return;
    Keyboard.dismiss();
    setLoading(true);
    setError('');
    try {
      const res = await api.discogsSearchSuggestions({
        artist: artist || undefined,
        album: album || undefined,
        catno: catno || undefined,
        barcode: barcode || undefined,
      });
      setSuggestions(
        (res.results ?? []).map((r: any) => ({
          release_id: r.release_id,
          master_id: r.master_id ?? null,
          title: r.title ?? '',
          album: r.album ?? '',
          artist: r.artist ?? '',
          year: r.year ?? null,
          cover_url: r.cover_url ?? '',
          thumb_url: r.thumb_url ?? '',
          catno: r.catno ?? '',
          label: r.label ?? '',
        })),
      );
    } catch (e: any) {
      setError(e.message ?? 'Suche fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  async function addSuggestion(s: Suggestion) {
    if (albumExists(s.release_id)) {
      Alert.alert('Bereits vorhanden', 'Dieses Album ist bereits in deiner Sammlung.');
      return;
    }
    insertAlbum({
      discogs_release_id: s.release_id,
      title: s.album || s.title,
      artist: s.artist,
      year: s.year,
      cover_url: s.cover_url,
      thumb_url: s.thumb_url,
      catno: s.catno,
      label: s.label,
      barcode: '',
      source: 'manual',
    });
    api.discogsAdd(s.release_id).catch(() => {});
    Alert.alert('Hinzugefügt', `"${s.album || s.title}" wurde zur Sammlung hinzugefügt.`, [
      { text: 'OK', onPress: onAdded },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        keyboardShouldPersistTaps="handled"
      >
        {([
          [artist, setArtist, 'Interpret'],
          [album, setAlbum, 'Album'],
          [catno, setCatno, 'Katalognummer'],
          [barcode, setBarcode, 'EAN / Barcode'],
        ] as [string, (v: string) => void, string][]).map(([val, setter, placeholder]) => (
          <TextInput
            key={placeholder}
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#9eaccf"
            value={val}
            onChangeText={setter}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={search}
          />
        ))}
        <TouchableOpacity
          onPress={search}
          disabled={loading}
          style={[styles.btnPrimary, { opacity: loading ? 0.6 : 1 }]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Search size={16} color="#fff" />
              <Text style={styles.btnPrimaryText}>Suchen</Text>
            </>
          )}
        </TouchableOpacity>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {suggestions.map((s) => (
          <SuggestionCard key={s.release_id} suggestion={s} onAdd={() => addSuggestion(s)} />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Barcode Tab ─────────────────────────────────────────────────────────────

function BarcodeTab({ onAdded }: { onAdded: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');

  const FRAME_W = SCREEN_W - 64;
  const FRAME_H = 120;
  const CORNER = 20;

  async function lookupBarcode(code: string) {
    setScanned(true);
    setBarcode(code);
    setLoading(true);
    setError('');
    try {
      const res = await api.discogsSearchSuggestions({ barcode: code });
      setSuggestions(
        (res.results ?? []).map((r: any) => ({
          release_id: r.release_id,
          master_id: r.master_id ?? null,
          title: r.title ?? '',
          album: r.album ?? '',
          artist: r.artist ?? '',
          year: r.year ?? null,
          cover_url: r.cover_url ?? '',
          thumb_url: r.thumb_url ?? '',
          catno: r.catno ?? '',
          label: r.label ?? '',
        })),
      );
    } catch (e: any) {
      setError(e.message ?? 'Barcode-Suche fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  function handleBarcodeScan(result: BarcodeScanningResult) {
    if (scanned) return;
    lookupBarcode(result.data);
  }

  async function addSuggestion(s: Suggestion) {
    if (albumExists(s.release_id)) {
      Alert.alert('Bereits vorhanden', 'Dieses Album ist bereits in deiner Sammlung.');
      return;
    }
    insertAlbum({
      discogs_release_id: s.release_id,
      title: s.album || s.title,
      artist: s.artist,
      year: s.year,
      cover_url: s.cover_url,
      thumb_url: s.thumb_url,
      catno: s.catno,
      label: s.label,
      barcode: barcode,
      source: 'barcode',
    });
    api.discogsAdd(s.release_id).catch(() => {});
    Alert.alert('Hinzugefügt', `"${s.album || s.title}" wurde zur Sammlung hinzugefügt.`, [
      { text: 'OK', onPress: onAdded },
    ]);
  }

  if (!permission) return <View style={{ flex: 1, backgroundColor: '#07111f' }} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <ScanLine size={48} color="#9eaccf" />
        <Text style={styles.permissionTitle}>Kamerazugriff benötigt</Text>
        <Text style={styles.permissionText}>
          Zum Scannen von Barcodes benötigt Discify Kamerazugriff.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.btnPrimary}>
          <Text style={styles.btnPrimaryText}>Kamerazugriff erlauben</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!scanned) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={handleBarcodeScan}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
        >
          {/* Dimmed overlay with clear scanning window */}
          <View style={StyleSheet.absoluteFill}>
            {/* Top dim */}
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
            {/* Middle row */}
            <View style={{ flexDirection: 'row', height: FRAME_H }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
              {/* Clear window */}
              <View style={{ width: FRAME_W, height: FRAME_H }}>
                {/* Corner markers */}
                {[
                  { top: 0, left: 0 },
                  { top: 0, right: 0 },
                  { bottom: 0, left: 0 },
                  { bottom: 0, right: 0 },
                ].map((pos, i) => (
                  <View
                    key={i}
                    style={[
                      styles.corner,
                      pos,
                      pos.top === 0 && pos.left === 0 && { borderTopWidth: 3, borderLeftWidth: 3 },
                      pos.top === 0 && pos.right === 0 && { borderTopWidth: 3, borderRightWidth: 3 },
                      pos.bottom === 0 && pos.left === 0 && { borderBottomWidth: 3, borderLeftWidth: 3 },
                      pos.bottom === 0 && pos.right === 0 && { borderBottomWidth: 3, borderRightWidth: 3 },
                    ]}
                  />
                ))}
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
            </View>
            {/* Bottom dim */}
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}>
              <Text style={styles.scanHint}>Barcode im Rahmen platzieren</Text>
            </View>
          </View>
        </CameraView>

        {/* Manual entry overlay */}
        <View style={styles.manualBar}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="EAN manuell eingeben"
            placeholderTextColor="#9eaccf"
            value={manualBarcode}
            onChangeText={setManualBarcode}
            keyboardType="numeric"
            returnKeyType="search"
            onSubmitEditing={() => manualBarcode && lookupBarcode(manualBarcode)}
          />
          <TouchableOpacity
            onPress={() => manualBarcode && lookupBarcode(manualBarcode)}
            style={[styles.btnPrimary, { marginBottom: 0, paddingHorizontal: 16 }]}
          >
            <Search size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={styles.labelText}>Gescannter Barcode</Text>
          <Text style={{ color: '#f5f7ff', fontWeight: '600' }}>{barcode}</Text>
        </View>
        <TouchableOpacity
          onPress={() => { setScanned(false); setSuggestions([]); setBarcode(''); setError(''); }}
          style={styles.btnSecondary}
        >
          <Text style={styles.btnSecondaryText}>Nochmal scannen</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color="#7c5cff" style={{ marginVertical: 24 }} />}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {suggestions.map((s) => (
        <SuggestionCard key={s.release_id} suggestion={s} onAdd={() => addSuggestion(s)} />
      ))}
      {!loading && !error && suggestions.length === 0 && (
        <Text style={{ color: '#9eaccf', textAlign: 'center', marginTop: 24 }}>
          Keine Ergebnisse für diesen Barcode
        </Text>
      )}
    </ScrollView>
  );
}

// ─── AI Camera Tab ────────────────────────────────────────────────────────────

function AiCameraTab({ onAdded }: { onAdded: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [step, setStep] = useState<'camera' | 'scanning' | 'results'>('camera');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [error, setError] = useState('');

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false });
      if (!photo) return;
      const compressed = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      await runScan(compressed.base64 ?? '');
    } catch (e: any) {
      Alert.alert('Fehler', e.message);
    }
  }, []);

  async function runScan(base64: string) {
    setStep('scanning');
    setError('');
    try {
      const scanResults = await api.scan(base64, 'image/jpeg');
      setResults(
        scanResults.map((scan) => ({
          scan,
          selected: true,
          editArtist: scan.artist || scan.ai_artist,
          editAlbum: scan.album || scan.ai_album,
          editCatno: scan.catno || scan.ai_catalog_number,
          editYear: scan.year != null ? String(scan.year) : '',
          editBarcode: scan.ai_barcode || '',
          alternatives: scan.alternatives ?? [],
        })),
      );
      setStep('results');
    } catch (e: any) {
      setError(e.message ?? 'Scan fehlgeschlagen');
      setStep('camera');
    }
  }

  function addSelected() {
    const toAdd = results.filter((r) => r.selected && r.scan.found);
    const addedIds: number[] = [];
    for (const item of toAdd) {
      if (!item.scan.release_id) continue;
      if (!albumExists(item.scan.release_id)) {
        insertAlbum({
          discogs_release_id: item.scan.release_id,
          title: item.editAlbum,
          artist: item.editArtist,
          year: item.editYear ? Number(item.editYear) : item.scan.year,
          cover_url: item.scan.cover_url,
          thumb_url: item.scan.thumb_url,
          catno: item.editCatno,
          label: item.scan.label ?? '',
          barcode: (item.editBarcode || item.scan.ai_barcode) ?? '',
          source: 'scan',
        });
        addedIds.push(item.scan.release_id);
      }
    }
    Promise.allSettled(addedIds.map((id) => api.discogsAdd(id)));
    Alert.alert('Fertig', `${addedIds.length} Album${addedIds.length !== 1 ? 's' : ''} zur Sammlung hinzugefügt.`, [
      { text: 'OK', onPress: onAdded },
    ]);
  }

  if (!permission) return <View style={{ flex: 1, backgroundColor: '#07111f' }} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <CameraIcon size={48} color="#9eaccf" />
        <Text style={styles.permissionTitle}>Kamerazugriff benötigt</Text>
        <Text style={styles.permissionText}>
          Zum KI-Scan benötigt Discify Kamerazugriff auf die Kamera.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.btnPrimary}>
          <Text style={styles.btnPrimaryText}>Kamerazugriff erlauben</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'scanning') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <ActivityIndicator size="large" color="#7c5cff" />
        <Text style={{ color: '#9eaccf', fontSize: 16 }}>Analysiere Foto…</Text>
      </View>
    );
  }

  if (step === 'camera') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {error ? (
          <View style={{ padding: 12, backgroundColor: 'rgba(255,100,100,0.15)' }}>
            <Text style={{ color: '#ffb0b0', textAlign: 'center' }}>{error}</Text>
          </View>
        ) : null}
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
          <View style={{ flex: 1, justifyContent: 'flex-end', padding: 24, paddingBottom: 32 }}>
            <TouchableOpacity
              onPress={takePicture}
              style={styles.captureBtn}
            >
              <CameraIcon size={28} color="#f5f7ff" />
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <FlatList
      data={results}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={{ padding: 12, gap: 10 }}
      ListHeaderComponent={
        <View style={{ marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#9eaccf' }}>{results.length} CD{results.length !== 1 ? 's' : ''} erkannt</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => setStep('camera')} style={styles.btnSecondary}>
              <Text style={styles.btnSecondaryText}>Neu scannen</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={addSelected} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>Hinzufügen</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      renderItem={({ item, index }) => (
        <ScanResultRow
          item={item}
          onUpdate={(updated) => setResults((prev) => prev.map((r, i) => i === index ? updated : r))}
          onRemove={() => setResults((prev) => prev.filter((_, i) => i !== index))}
        />
      )}
    />
  );
}

// ─── AI File Tab ──────────────────────────────────────────────────────────────

function AiFileTab({ onAdded }: { onAdded: () => void }) {
  const [step, setStep] = useState<'idle' | 'scanning' | 'results'>('idle');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [error, setError] = useState('');

  async function pickAndScan() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setStep('scanning');
    setError('');
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const scanResults = await api.scan(compressed.base64 ?? '', 'image/jpeg');
      setResults(
        scanResults.map((scan) => ({
          scan,
          selected: true,
          editArtist: scan.artist || scan.ai_artist,
          editAlbum: scan.album || scan.ai_album,
          editCatno: scan.catno || scan.ai_catalog_number,
          editYear: scan.year != null ? String(scan.year) : '',
          editBarcode: scan.ai_barcode || '',
          alternatives: scan.alternatives ?? [],
        })),
      );
      setStep('results');
    } catch (e: any) {
      setError(e.message ?? 'Scan fehlgeschlagen');
      setStep('idle');
    }
  }

  function addSelected() {
    const toAdd = results.filter((r) => r.selected && r.scan.found);
    const addedIds: number[] = [];
    for (const item of toAdd) {
      if (!item.scan.release_id) continue;
      if (!albumExists(item.scan.release_id)) {
        insertAlbum({
          discogs_release_id: item.scan.release_id,
          title: item.editAlbum,
          artist: item.editArtist,
          year: item.editYear ? Number(item.editYear) : item.scan.year,
          cover_url: item.scan.cover_url,
          thumb_url: item.scan.thumb_url,
          catno: item.editCatno,
          label: item.scan.label ?? '',
          barcode: (item.editBarcode || item.scan.ai_barcode) ?? '',
          source: 'scan',
        });
        addedIds.push(item.scan.release_id);
      }
    }
    Promise.allSettled(addedIds.map((id) => api.discogsAdd(id)));
    Alert.alert('Fertig', `${addedIds.length} Album${addedIds.length !== 1 ? 's' : ''} zur Sammlung hinzugefügt.`, [
      { text: 'OK', onPress: onAdded },
    ]);
  }

  if (step === 'scanning') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <ActivityIndicator size="large" color="#7c5cff" />
        <Text style={{ color: '#9eaccf', fontSize: 16 }}>Analysiere Bild…</Text>
      </View>
    );
  }

  if (step === 'idle') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <FileImage size={64} color="#9eaccf" />
        <Text style={{ color: '#9eaccf', textAlign: 'center', fontSize: 15 }}>
          Wähle ein Foto deiner CDs aus der Galerie
        </Text>
        <TouchableOpacity onPress={pickAndScan} style={styles.btnPrimary}>
          <FileImage size={16} color="#fff" />
          <Text style={styles.btnPrimaryText}>Foto auswählen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={results}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={{ padding: 12, gap: 10 }}
      ListHeaderComponent={
        <View style={{ marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#9eaccf' }}>{results.length} CD{results.length !== 1 ? 's' : ''} erkannt</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => { setStep('idle'); setResults([]); }} style={styles.btnSecondary}>
              <Text style={styles.btnSecondaryText}>Neues Bild</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={addSelected} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>Hinzufügen</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      renderItem={({ item, index }) => (
        <ScanResultRow
          item={item}
          onUpdate={(updated) => setResults((prev) => prev.map((r, i) => i === index ? updated : r))}
          onRemove={() => setResults((prev) => prev.filter((_, i) => i !== index))}
        />
      )}
    />
  );
}

// ─── ScanResultRow (replaces ScanResultCard grid) ─────────────────────────────

function ScanResultRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: ResultItem;
  onUpdate: (updated: ResultItem) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAlts, setShowAlts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [originalItem] = useState<ResultItem>(item);

  const thumb = item.scan.cover_url || item.scan.thumb_url;
  const isAltActive = item.scan.release_id !== originalItem.scan.release_id;
  const metaStr = [
    item.editYear,
    item.editBarcode ? `EAN: ${item.editBarcode}` : null,
    item.editCatno ? `Kat: ${item.editCatno}` : null,
  ].filter(Boolean).join(' · ');

  const STATUS_LABELS: Record<string, string> = {
    new: 'Neu',
    in_collection: 'In Sammlung',
    not_found: 'Nicht gefunden',
  };

  const STATUS_COLORS: Record<string, string> = {
    new: '#86f0c9',
    in_collection: '#ffe29e',
    not_found: '#ffb0b0',
  };

  async function fetchAlternatives() {
    setRefreshing(true);
    try {
      const res = await api.discogsSearchSuggestions({
        artist: item.editArtist || undefined,
        album: item.editAlbum || undefined,
        catno: item.editCatno || undefined,
        barcode: item.editBarcode || undefined,
      });
      const alts: AlternativeHit[] = (res.results ?? []).slice(1).map((r: any) => ({
        release_id: r.release_id ?? null,
        master_id: r.master_id ?? null,
        title: r.title ?? '',
        album: r.album ?? '',
        artist: r.artist ?? '',
        year: r.year ?? null,
        cover_url: r.cover_url ?? '',
        thumb_url: r.thumb_url ?? '',
        catno: r.catno ?? '',
        label: r.label ?? '',
      }));
      onUpdate({ ...item, alternatives: alts });
      setShowAlts(true);
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }

  function applyAlternative(alt: AlternativeHit) {
    onUpdate({
      ...item,
      scan: {
        ...item.scan,
        release_id: alt.release_id,
        master_id: alt.master_id,
        title: alt.title,
        album: alt.album,
        artist: alt.artist,
        year: alt.year,
        cover_url: alt.cover_url,
        thumb_url: alt.thumb_url,
        catno: alt.catno,
        label: alt.label,
        found: true,
      },
      editArtist: alt.artist,
      editAlbum: alt.album,
      editCatno: alt.catno,
      editYear: alt.year != null ? String(alt.year) : '',
      selected: true,
    });
    setShowAlts(false);
  }

  function restoreOriginal() {
    onUpdate(originalItem);
    setShowAlts(false);
  }

  const status = item.scan.found ? (item.scan.catno && item.editCatno ? 'new' : 'new') : 'not_found';

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', overflow: 'hidden', marginBottom: 2 }}>
      {/* Collapsed row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 }}>
        {/* Thumbnail */}
        <View style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1a2a3f', flexShrink: 0 }}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={{ width: 48, height: 48 }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20 }}>💿</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: STATUS_COLORS[item.scan.found ? 'new' : 'not_found'], flexShrink: 0 }}>
              {STATUS_LABELS[item.scan.found ? 'new' : 'not_found']}
            </Text>
          </View>
          <Text style={{ color: '#f5f7ff', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
            {item.editArtist}
          </Text>
          <Text style={{ color: '#9eaccf', fontSize: 11 }} numberOfLines={1}>
            {item.editAlbum}
          </Text>
          {metaStr ? (
            <Text style={{ color: 'rgba(158,172,207,0.6)', fontSize: 10 }} numberOfLines={1}>
              {metaStr} · –
            </Text>
          ) : null}
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Toggle select */}
          <TouchableOpacity
            onPress={() => onUpdate({ ...item, selected: !item.selected })}
            style={{
              width: 20, height: 20, borderRadius: 4,
              borderWidth: 1.5,
              borderColor: item.selected ? '#7c5cff' : 'rgba(255,255,255,0.2)',
              backgroundColor: item.selected ? '#7c5cff' : 'rgba(255,255,255,0.05)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {item.selected ? <CheckCircle2 size={12} color="#fff" /> : null}
          </TouchableOpacity>
          {/* Remove */}
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <X size={14} color="#9eaccf" />
          </TouchableOpacity>
          {/* Expand */}
          <TouchableOpacity onPress={() => setExpanded((e) => !e)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={{ color: '#9eaccf', fontSize: 16, lineHeight: 18 }}>{expanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Expanded panel */}
      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', padding: 12, gap: 8 }}>
          {([
            ['Interpret', 'editArtist', item.editArtist],
            ['Album', 'editAlbum', item.editAlbum],
            ['Jahr', 'editYear', item.editYear],
            ['EAN / Barcode', 'editBarcode', item.editBarcode],
            ['Katalognummer', 'editCatno', item.editCatno],
          ] as [string, keyof ResultItem, string][]).map(([label, field, value]) => (
            <View key={field}>
              <Text style={{ color: '#9eaccf', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</Text>
              <TextInput
                style={styles.inlineInput}
                value={value ?? ''}
                onChangeText={(v) => onUpdate({ ...item, [field]: v })}
                placeholder={label}
                placeholderTextColor="#9eaccf"
                keyboardType={field === 'editYear' ? 'numeric' : 'default'}
              />
            </View>
          ))}

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <TouchableOpacity
              onPress={fetchAlternatives}
              disabled={refreshing}
              style={[styles.btnSecondary, { paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
            >
              {refreshing ? <ActivityIndicator size="small" color="#9eaccf" /> : <Loader2 size={12} color="#9eaccf" />}
              <Text style={styles.btnSecondaryText}>{refreshing ? 'Suche…' : showAlts ? 'Aktualisieren' : 'Alternativen'}</Text>
            </TouchableOpacity>
            {isAltActive && (
              <TouchableOpacity
                onPress={restoreOriginal}
                style={[styles.btnSecondary, { paddingHorizontal: 12, paddingVertical: 8, borderColor: 'rgba(124,92,255,0.3)' }]}
              >
                <Text style={[styles.btnSecondaryText, { color: '#a88eff' }]}>↩ Original</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Alternatives list */}
          {showAlts && item.alternatives.length > 0 && (
            <View style={{ gap: 6, marginTop: 4 }}>
              <Text style={{ color: '#9eaccf', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {item.alternatives.length} Vorschlag{item.alternatives.length !== 1 ? 'e' : ''}
              </Text>
              {item.alternatives.slice(0, 8).map((alt, i) => {
                const altThumb = alt.thumb_url || alt.cover_url;
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)', padding: 8 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1a2a3f', flexShrink: 0 }}>
                      {altThumb ? (
                        <Image source={{ uri: altThumb }} style={{ width: 36, height: 36 }} resizeMode="cover" />
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 14 }}>💿</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: '#f5f7ff', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{alt.artist}</Text>
                      <Text style={{ color: '#9eaccf', fontSize: 10 }} numberOfLines={1}>{alt.album || alt.title}</Text>
                      <Text style={{ color: 'rgba(158,172,207,0.6)', fontSize: 10 }} numberOfLines={1}>
                        {[alt.year, alt.catno, alt.label].filter(Boolean).join(' · ') || '–'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => applyAlternative(alt)}
                      style={{ backgroundColor: 'rgba(124,92,255,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }}
                    >
                      <Text style={{ color: '#a88eff', fontSize: 11, fontWeight: '700' }}>Wählen</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#07111f',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    height: SCREEN_H * 0.88,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#f5f7ff',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
    flexDirection: 'column',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(124,92,255,0.12)',
  },
  tabLabel: {
    fontSize: 10,
    color: '#9eaccf',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#7c5cff',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#0d1e33',
    borderRadius: 12,
    padding: 12,
    color: '#f5f7ff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 0,
  },
  inlineInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#f5f7ff',
    fontSize: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  btnPrimary: {
    backgroundColor: '#7c5cff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  btnSecondary: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: '#9eaccf',
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: '#ffb0b0',
    fontSize: 13,
    textAlign: 'center',
  },
  labelText: {
    color: '#9eaccf',
    fontSize: 12,
    marginBottom: 2,
  },
  suggestionCard: {
    backgroundColor: '#0d1e33',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#fff',
  },
  scanHint: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontSize: 13,
    marginTop: 16,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#7c5cff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f5f7ff',
  },
  permissionText: {
    color: '#9eaccf',
    textAlign: 'center',
    fontSize: 14,
  },
  manualBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: 'rgba(7,17,31,0.9)',
  },
});
