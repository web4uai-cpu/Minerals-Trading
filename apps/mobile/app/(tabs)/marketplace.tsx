import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors, spacing } from '../../src/theme';

interface SearchResult {
  id: string;
  mineralName: string;
  grade: Record<string, number>;
  pricePerMtPaise: number;
  quantityMt: number;
  state: string;
  sellerName: string;
  trustScore: number;
}

function formatPaise(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatGrade(grade: Record<string, number>): string {
  return Object.entries(grade).map(([k, v]) => `${k}: ${v}`).join(', ');
}

export default function MarketplaceScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await api<{ results: SearchResult[] }>('/discovery/search', {
        method: 'POST',
        body: JSON.stringify({ query: query.trim() }),
      });
      setResults(data.results ?? []);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function renderItem({ item }: { item: SearchResult }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.mineralName}>{item.mineralName}</Text>
          <View style={[
            styles.trustBadge,
            item.trustScore >= 80 ? styles.trustHigh : item.trustScore >= 50 ? styles.trustMed : styles.trustLow,
          ]}>
            <Text style={styles.trustText}>{item.trustScore}</Text>
          </View>
        </View>
        <Text style={styles.seller}>{item.sellerName} — {item.state}</Text>
        <View style={styles.details}>
          <Text style={styles.detailLabel}>Grade</Text>
          <Text style={styles.detailValue}>{formatGrade(item.grade)}</Text>
        </View>
        <View style={styles.row}>
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>Price/MT</Text>
            <Text style={styles.price}>{formatPaise(item.pricePerMtPaise)}</Text>
          </View>
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>Available</Text>
            <Text style={styles.detailValue}>{item.quantityMt.toLocaleString()} MT</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder='e.g. "Iron ore 62% Fe from Odisha"'
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Go</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}

      {searched && !loading && results.length === 0 && (
        <Text style={styles.empty}>No listings found. Try a different query.</Text>
      )}

      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  searchInput: {
    flex: 1,
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  searchBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  card: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  mineralName: { fontSize: 16, fontWeight: '600', color: colors.text },
  trustBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  trustHigh: { borderColor: colors.sage + '55', backgroundColor: colors.sage + '1A' },
  trustMed: { borderColor: colors.accent + '55', backgroundColor: colors.accent + '1A' },
  trustLow: { borderColor: colors.error + '55', backgroundColor: colors.error + '1A' },
  trustText: { fontSize: 11, fontWeight: '600', color: colors.text },
  seller: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  details: { marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.lg },
  detail: {},
  detailLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
  detailValue: { fontSize: 13, color: colors.text, fontFamily: 'monospace' },
  price: { fontSize: 14, fontWeight: '600', color: colors.accentLight },
});
