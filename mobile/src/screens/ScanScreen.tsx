import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useNavigation } from '@react-navigation/native';
import { Camera as CameraIcon, Disc3 } from 'lucide-react-native';
import { api } from '../services/api';
import { albumExists, insertAlbum } from '../services/db';
import type { AlternativeHit, ScanResult } from '../types';

type Step = 'camera' | 'scanning' | 'results';

interface ResultItem {
  scan: ScanResult;
  originalScan: ScanResult;
  selected: boolean;
  editArtist: string;
  editAlbum: string;
  editCatno: string;
}

export default function ScanScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [step, setStep] = useState<Step>('camera');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [scanError, setScanError] = useState('');

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
    setScanError('');
    try {
      const scanResults = await api.scan(base64, 'image/jpeg');
      const items: ResultItem[] = scanResults.map((scan) => ({
        scan,
        originalScan: scan,
        selected: true,
        editArtist: scan.artist || scan.ai_artist,
        editAlbum: scan.album || scan.ai_album,
        editCatno: scan.catno || scan.ai_catalog_number,
      }));
      setResults(items);
      setStep('results');
    } catch (e: any) {
      setScanError(e.message ?? 'Scan fehlgeschlagen');
      setStep('camera');
    }
  }

  async function addSelected() {
    const toAdd = results.filter((r) => r.selected && r.scan.found);
    const addedIds: number[] = [];
    for (const item of toAdd) {
      if (!item.scan.release_id) continue;
      if (!albumExists(item.scan.release_id)) {
        insertAlbum({
          discogs_release_id: item.scan.release_id,
          title: item.editAlbum,
          artist: item.editArtist,
          year: item.scan.year,
          cover_url: item.scan.cover_url,
          thumb_url: item.scan.thumb_url,
          catno: item.editCatno,
          label: item.scan.label ?? '',
          barcode: item.scan.ai_barcode ?? '',
          source: 'scan',
        });
        addedIds.push(item.scan.release_id);
      }
    }
    Promise.allSettled(addedIds.map((id) => api.discogsAdd(id)));
    Alert.alert('Fertig', `${addedIds.length} Album${addedIds.length !== 1 ? 's' : ''} zur Sammlung hinzugefügt.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }

  if (!permission) return <View style={{ flex: 1, backgroundColor: '#07111f' }} />;

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#07111f', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#f5f7ff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Kamerazugriff benötigt</Text>
        <Text style={{ color: '#9eaccf', textAlign: 'center', marginBottom: 24 }}>
          Discify benötigt Zugriff auf die Kamera, um CD-Cover zu fotografieren.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={{ backgroundColor: '#7c5cff', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Kamerazugriff erlauben</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
          <Text style={{ color: '#9eaccf' }}>Abbrechen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'scanning') {
    return (
      <View style={{ flex: 1, backgroundColor: '#07111f', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <ActivityIndicator size="large" color="#7c5cff" />
        <Text style={{ color: '#9eaccf', fontSize: 16 }}>Analysiere Foto…</Text>
      </View>
    );
  }

  if (step === 'camera') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
          <View style={{ flex: 1, justifyContent: 'flex-end', padding: 24, paddingBottom: 48 }}>
            {scanError ? (
              <Text style={{ color: '#ff6b6b', textAlign: 'center', marginBottom: 16, backgroundColor: 'rgba(0,0,0,0.7)', padding: 8, borderRadius: 8 }}>
                {scanError}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 12 }}>
                <Text style={{ color: '#fff', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={takePicture}
                style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#7c5cff', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)' }}
              >
                <CameraIcon size={28} color="#f5f7ff" />
              </TouchableOpacity>
              <View style={{ width: 44 }} />
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  // Results grid
  function applyAlternative(index: number, alt: AlternativeHit) {
    setResults((prev) =>
      prev.map((r, j) =>
        j !== index
          ? r
          : {
              ...r,
              scan: {
                ...r.scan,
                found: true,
                title: alt.title,
                album: alt.album,
                artist: alt.artist,
                year: alt.year,
                cover_url: alt.cover_url ?? '',
                thumb_url: alt.thumb_url ?? '',
                catno: alt.catno ?? '',
                label: alt.label ?? '',
                release_id: alt.release_id,
                master_id: alt.master_id,
              },
              editArtist: alt.artist,
              editAlbum: alt.album || alt.title,
              editCatno: alt.catno ?? '',
            },
      ),
    );
  }

  function restoreOriginal(index: number) {
    setResults((prev) =>
      prev.map((r, j) =>
        j !== index
          ? r
          : {
              ...r,
              scan: r.originalScan,
              editArtist: r.originalScan.artist || r.originalScan.ai_artist,
              editAlbum: r.originalScan.album || r.originalScan.ai_album,
              editCatno: r.originalScan.catno || r.originalScan.ai_catalog_number,
            },
      ),
    );
  }

  const renderItem = ({ item, index }: { item: ResultItem; index: number }) => {
    const thumb = item.scan.thumb_url || item.scan.cover_url;
    return (
      <View style={cardStyle}>
        {/* Cover */}
        <View style={{ aspectRatio: 1, width: '100%', overflow: 'hidden', position: 'relative' }}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' }}>
              <Disc3 size={36} color="#9eaccf" />
            </View>
          )}
          {/* Status badge */}
          <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: item.scan.found ? 'rgba(49,209,155,0.85)' : 'rgba(255,122,122,0.85)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{item.scan.found ? '✓' : '?'}</Text>
          </View>
          {/* Select toggle */}
          <TouchableOpacity
            onPress={() => setResults((prev) => prev.map((r, j) => j === index ? { ...r, selected: !r.selected } : r))}
            style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 6, backgroundColor: item.selected ? '#7c5cff' : 'rgba(0,0,0,0.5)', borderWidth: 2, borderColor: item.selected ? '#7c5cff' : 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' }}
          >
            {item.selected ? <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text> : null}
          </TouchableOpacity>
        </View>
        {/* Fields */}
        <View style={{ padding: 8, gap: 4 }}>
          <TextInput
            style={{ color: '#f5f7ff', fontSize: 11, fontWeight: '600', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingBottom: 3 }}
            value={item.editAlbum}
            onChangeText={(v) => setResults((prev) => prev.map((r, j) => j === index ? { ...r, editAlbum: v } : r))}
            placeholder="Album"
            placeholderTextColor="#9eaccf"
          />
          <TextInput
            style={{ color: '#9eaccf', fontSize: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', paddingBottom: 3 }}
            value={item.editArtist}
            onChangeText={(v) => setResults((prev) => prev.map((r, j) => j === index ? { ...r, editArtist: v } : r))}
            placeholder="Interpret"
            placeholderTextColor="#9eaccf"
          />
          <TextInput
            style={{ color: '#9eaccf', fontSize: 9 }}
            value={item.editCatno}
            onChangeText={(v) => setResults((prev) => prev.map((r, j) => j === index ? { ...r, editCatno: v } : r))}
            placeholder="Katalognr."
            placeholderTextColor="#9eaccf"
          />
          {item.scan.label ? <Text style={{ color: '#9eaccf', fontSize: 9 }} numberOfLines={1}>{item.scan.label}</Text> : null}
          {item.scan.alternatives && item.scan.alternatives.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Text style={{ color: '#9eaccf', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Alternativen</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {item.scan.release_id !== item.originalScan.release_id && (
                    <TouchableOpacity
                      onPress={() => restoreOriginal(index)}
                      style={{ borderRadius: 6, borderWidth: 1, borderColor: 'rgba(124,92,255,0.4)', backgroundColor: 'rgba(124,92,255,0.12)', paddingHorizontal: 6, paddingVertical: 3 }}
                    >
                      <Text style={{ color: '#a88eff', fontSize: 8, fontWeight: '600' }}>↩ Original</Text>
                    </TouchableOpacity>
                  )}
                  {item.scan.alternatives.slice(0, 6).map((alt, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => applyAlternative(index, alt)}
                      style={{ borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 6, paddingVertical: 3 }}
                    >
                      <Text style={{ color: '#9eaccf', fontSize: 8, fontWeight: '600' }} numberOfLines={1}>
                        {alt.artist}{alt.album ? ` – ${alt.album}` : ''}
                        {alt.year ? ` · ${alt.year}` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#07111f' }}>
      <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#f5f7ff' }}>Ergebnisse</Text>
        <TouchableOpacity onPress={() => { setStep('camera'); setResults([]); }}>
          <Text style={{ color: '#9eaccf' }}>Neu scannen</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={results}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 100 }}
      />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 40, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: '#07111f' }}>
        <TouchableOpacity onPress={addSelected} style={{ backgroundColor: '#7c5cff', borderRadius: 14, padding: 16, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
            {results.filter((r) => r.selected && r.scan.found).length} Album
            {results.filter((r) => r.selected && r.scan.found).length !== 1 ? 's' : ''} hinzufügen
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const cardStyle = {
  flex: 1,
  backgroundColor: '#0d1e33',
  borderRadius: 14,
  overflow: 'hidden' as const,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.06)',
};

