import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors, spacing } from '../../src/theme';

interface Deal {
  id: string;
  status: string;
  mineralName: string;
  quantityMt: number;
  pricePerMtPaise: number;
  totalPaise: number;
  createdAt: string;
}

function formatPaise(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const STATUS_COLORS: Record<string, string> = {
  CREATED: colors.textSecondary,
  ESCROW_HELD: '#58A6FF',
  IN_PROGRESS: colors.accent,
  BUYER_SIGNED: '#58A6FF',
  DUAL_SIGNED: colors.sage,
  COMPLETED: colors.sage,
  CANCELLED: colors.error,
  DISPUTED: '#D29922',
};

export default function DealsScreen() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Deal[]>('/api/v1/deals')
      .then(setDeals)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const [expanded, setExpanded] = useState<string | null>(null);

  function renderItem({ item }: { item: Deal }) {
    const isExpanded = expanded === item.id;
    const statusColor = STATUS_COLORS[item.status] ?? colors.textSecondary;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setExpanded(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.mineralName}>{item.mineralName}</Text>
          <View style={[styles.statusBadge, { borderColor: statusColor + '66', backgroundColor: statusColor + '1A' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString('en-IN')}</Text>

        {isExpanded && (
          <View style={styles.detailsRow}>
            <View style={styles.detailBox}>
              <Text style={styles.detailLabel}>Quantity</Text>
              <Text style={styles.detailValue}>{item.quantityMt.toLocaleString()} MT</Text>
            </View>
            <View style={styles.detailBox}>
              <Text style={styles.detailLabel}>Price/MT</Text>
              <Text style={[styles.detailValue, { color: colors.accentLight }]}>{formatPaise(item.pricePerMtPaise)}</Text>
            </View>
            <View style={styles.detailBox}>
              <Text style={styles.detailLabel}>Total</Text>
              <Text style={[styles.detailValue, { fontWeight: '700' }]}>{formatPaise(item.totalPaise)}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {deals.length === 0 ? (
        <Text style={styles.empty}>No deals yet. Start by searching the marketplace.</Text>
      ) : (
        <FlatList
          data={deals}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 60, paddingHorizontal: spacing.lg },
  card: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  mineralName: { fontSize: 16, fontWeight: '600', color: colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  date: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  detailBox: {},
  detailLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
  detailValue: { fontSize: 14, color: colors.text },
});
