import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Disc, Library } from 'lucide-react-native';
import { getAlbums, initDb } from '../services/db';
import type { Album } from '../types';
import type { RootStackParamList } from '../navigation';

const { width } = Dimensions.get('window');
const COLS = width >= 600 ? 3 : 2;
const CARD_W = (width - 20 * 2 - (COLS - 1) * 12) / COLS;

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function CollectionScreen() {
  const navigation = useNavigation<NavProp>();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    try {
      initDb();
      setAlbums(getAlbums());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = albums.filter((album) => {
    if (!query) {
      return true;
    }
    const q = query.toLowerCase();
    return (
      album.title.toLowerCase().includes(q) ||
      album.artist.toLowerCase().includes(q)
    );
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
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Library size={20} color="#f5f7ff" />
            <Text
              style={{
                fontSize: 22,
                fontWeight: 'bold',
                color: '#f5f7ff',
                marginLeft: 8,
              }}
            >
              Sammlung
            </Text>
          </View>
          <Text style={{ color: '#9eaccf', fontSize: 13 }}>{albums.length} Alben</Text>
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

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        numColumns={COLS}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        columnWrapperStyle={COLS > 1 ? { gap: 12 } : undefined}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor="#7c5cff" />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <Disc size={48} color="#9eaccf" />
            <Text
              style={{
                color: '#f5f7ff',
                fontWeight: 'bold',
                marginTop: 16,
                fontSize: 18,
              }}
            >
              Keine Alben
            </Text>
            <Text
              style={{ color: '#9eaccf', marginTop: 8, textAlign: 'center' }}
            >
              Tippe auf + um deine ersten CDs zu scannen
            </Text>
          </View>
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
            {item.cover_url ? (
              <Image
                source={{ uri: item.cover_url }}
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
              <Text
                style={{ color: '#f5f7ff', fontWeight: '600', fontSize: 13 }}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text
                style={{ color: '#9eaccf', fontSize: 12, marginTop: 2 }}
                numberOfLines={1}
              >
                {item.artist}
              </Text>
              {item.year ? (
                <Text style={{ color: '#9eaccf', fontSize: 11, marginTop: 2 }}>
                  {item.year}
                </Text>
              ) : null}
            </View>
          </View>
        )}
      />

      <TouchableOpacity
        onPress={() => navigation.navigate('Scan')}
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
    </View>
  );
}
