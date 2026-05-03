import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { api } from '../services/api';
import { albumExists, insertAlbum } from '../services/db';
import type { DiscogsRelease, ScanResult } from '../types';

type Step = 'camera' | 'preview' | 'scanning' | 'results' | 'done';

interface ResultItem {
  scan: ScanResult;
  release: DiscogsRelease | null;
  loading: boolean;
  selected: boolean;
  editArtist: string;
  editAlbum: string;
}

export default function ScanScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const [step, setStep] = useState<Step>('camera');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [scanError, setScanError] = useState('');

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) {
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      if (!photo) {
        return;
      }
      const compressed = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1200 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
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
        release: null,
        loading: true,
        selected: true,
        editArtist: scan.artist,
        editAlbum: scan.album,
      }));
      setResults(items);
      setStep('results');

      for (let i = 0; i < items.length; i += 1) {
        try {
          const release = await api.discogsSearch(
            items[i].editArtist,
            items[i].editAlbum,
          );
          setResults((prev) =>
            prev.map((result, idx) =>
              idx === i ? { ...result, release, loading: false } : result,
            ),
          );
        } catch {
          setResults((prev) =>
            prev.map((result, idx) =>
              idx === i ? { ...result, loading: false } : result,
            ),
          );
        }
      }
    } catch (e: any) {
      setScanError(e.message ?? 'Scan fehlgeschlagen');
      setStep('camera');
    }
  }

  async function addSelected() {
    const toAdd = results.filter((result) => result.selected && result.release);
    let added = 0;

    for (const item of toAdd) {
      if (!item.release) {
        continue;
      }
      if (!albumExists(item.release.id)) {
        insertAlbum({
          discogs_release_id: item.release.id,
          title: item.release.title,
          artist: item.release.artist,
          year: item.release.year,
          cover_url: item.release.cover_url,
          thumb_url: item.release.thumb_url,
          source: 'scan',
        });
        added += 1;
      }
    }

    Alert.alert(
      'Fertig',
      `${added} Album${added !== 1 ? 's' : ''} zur Sammlung hinzugefügt.`,
      [{ text: 'OK', onPress: () => navigation.goBack() }],
    );
  }

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: '#07111f' }} />;
  }

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#07111f',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text
          style={{
            color: '#f5f7ff',
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: 12,
          }}
        >
          Kamerazugriff benötigt
        </Text>
        <Text
          style={{ color: '#9eaccf', textAlign: 'center', marginBottom: 24 }}
        >
          Discify benötigt Zugriff auf die Kamera, um CD-Cover zu fotografieren.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={{
            backgroundColor: '#7c5cff',
            borderRadius: 14,
            paddingHorizontal: 24,
            paddingVertical: 14,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>
            Kamerazugriff erlauben
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
          <Text style={{ color: '#9eaccf' }}>Abbrechen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'camera' || step === 'scanning') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
          <View
            style={{ flex: 1, justifyContent: 'flex-end', padding: 24, paddingBottom: 48 }}
          >
            {scanError ? (
              <Text
                style={{
                  color: '#ff6b6b',
                  textAlign: 'center',
                  marginBottom: 16,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  padding: 8,
                  borderRadius: 8,
                }}
              >
                {scanError}
              </Text>
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={takePicture}
                disabled={step === 'scanning'}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: step === 'scanning' ? '#444' : '#7c5cff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 4,
                  borderColor: 'rgba(255,255,255,0.3)',
                }}
              >
                {step === 'scanning' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontSize: 28 }}>📷</Text>
                )}
              </TouchableOpacity>
              <View style={{ width: 44 }} />
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#07111f' }}>
      <View
        style={{
          paddingTop: 56,
          paddingHorizontal: 20,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.06)',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#f5f7ff' }}>
          Ergebnisse
        </Text>
        <TouchableOpacity
          onPress={() => {
            setStep('camera');
            setResults([]);
          }}
        >
          <Text style={{ color: '#9eaccf' }}>Neu scannen</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        {results.map((item, i) => (
          <View
            key={i}
            style={{
              backgroundColor: '#0d1e33',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <TextInput
                  style={{ color: '#f5f7ff', fontWeight: '600', fontSize: 15 }}
                  value={item.editAlbum}
                  onChangeText={(value) =>
                    setResults((prev) =>
                      prev.map((result, idx) =>
                        idx === i ? { ...result, editAlbum: value } : result,
                      ),
                    )
                  }
                />
                <TextInput
                  style={{ color: '#9eaccf', fontSize: 13, marginTop: 2 }}
                  value={item.editArtist}
                  onChangeText={(value) =>
                    setResults((prev) =>
                      prev.map((result, idx) =>
                        idx === i ? { ...result, editArtist: value } : result,
                      ),
                    )
                  }
                />
              </View>
              <TouchableOpacity
                onPress={() =>
                  setResults((prev) =>
                    prev.map((result, idx) =>
                      idx === i
                        ? { ...result, selected: !result.selected }
                        : result,
                    ),
                  )
                }
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: item.selected ? '#7c5cff' : 'transparent',
                  borderWidth: 2,
                  borderColor: item.selected ? '#7c5cff' : '#9eaccf',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.selected ? <Text style={{ color: '#fff', fontSize: 16 }}>✓</Text> : null}
              </TouchableOpacity>
            </View>

            {item.loading ? (
              <ActivityIndicator color="#7c5cff" style={{ marginTop: 12 }} />
            ) : null}
            {!item.loading && item.release ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 12,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                {item.release.thumb_url ? (
                  <Image
                    source={{ uri: item.release.thumb_url }}
                    style={{ width: 48, height: 48, borderRadius: 6, marginRight: 12 }}
                  />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: '#86f0c9', fontSize: 12, fontWeight: '600' }}
                  >
                    Discogs Match
                  </Text>
                  <Text
                    style={{ color: '#f5f7ff', fontSize: 13, marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {item.release.title}
                  </Text>
                  {item.release.year ? (
                    <Text style={{ color: '#9eaccf', fontSize: 11 }}>
                      {item.release.year}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
            {!item.loading && !item.release ? (
              <Text style={{ color: '#9eaccf', fontSize: 12, marginTop: 8 }}>
                Kein Discogs-Match gefunden
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          padding: 20,
          paddingBottom: 40,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <TouchableOpacity
          onPress={addSelected}
          style={{
            backgroundColor: '#7c5cff',
            borderRadius: 14,
            padding: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
            {results.filter((result) => result.selected).length} Album
            {results.filter((result) => result.selected).length !== 1 ? 's' : ''}{' '}
            hinzufügen
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
