import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors, spacing } from '../../src/theme';

interface ComplianceItem {
  id: string;
  type: string;
  status: string;
  verifiedAt: string | null;
  rejectionNote: string | null;
}

interface ComplianceProfile {
  orgStatus: string;
  trustScore: number;
  items: ComplianceItem[];
  checklist: { type: string; label: string; required: boolean }[];
}

const ITEM_LABELS: Record<string, string> = {
  MINING_LEASE: 'Mining Lease',
  ENV_CLEARANCE: 'Environmental Clearance',
  FOREST_CLEARANCE: 'Forest Clearance',
  IBM_RETURNS: 'IBM Returns',
  ROYALTY_CLEARANCE: 'Royalty Clearance',
  SPCB_NOC: 'SPCB NOC',
  GST_REG: 'GST Registration',
  PAN: 'PAN Card',
  BANK_VERIFICATION: 'Bank Verification',
  IEC: 'Import Export Code',
  END_USE_DECLARATION: 'End-Use Declaration',
  INDUSTRY_REGISTRATION: 'Industry Registration',
};

const STATUS_COLORS: Record<string, string> = {
  VERIFIED: colors.sage,
  UPLOADED: '#58A6FF',
  UNDER_REVIEW: colors.accent,
  REJECTED: colors.error,
  EXPIRED: '#D29922',
  MISSING: colors.textSecondary,
};

export default function ComplianceScreen() {
  const [profile, setProfile] = useState<ComplianceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<ComplianceProfile>('/compliance/profile')
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Unable to load compliance profile.</Text>
      </View>
    );
  }

  const itemMap = new Map(profile.items.map((i) => [i.type, i]));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Org Status</Text>
            <View style={[
              styles.statusBadge,
              { borderColor: profile.orgStatus === 'VERIFIED' ? colors.sage + '66' : colors.accent + '66',
                backgroundColor: profile.orgStatus === 'VERIFIED' ? colors.sage + '1A' : colors.accent + '1A' },
            ]}>
              <Text style={[styles.statusBadgeText,
                { color: profile.orgStatus === 'VERIFIED' ? colors.sage : colors.accent }]}>
                {profile.orgStatus}
              </Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TrustScore</Text>
            <Text style={styles.trustScore}>{profile.trustScore}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Document Checklist</Text>

        {profile.checklist.map((check) => {
          const item = itemMap.get(check.type);
          const status = item?.status ?? 'MISSING';
          const statusColor = STATUS_COLORS[status] ?? colors.textSecondary;

          return (
            <View key={check.type} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemLabel}>
                  {ITEM_LABELS[check.type] ?? check.type}
                  {check.required && <Text style={styles.required}> *</Text>}
                </Text>
                {item?.rejectionNote && (
                  <Text style={styles.rejectionNote}>Rejected: {item.rejectionNote}</Text>
                )}
              </View>
              <View style={[styles.itemBadge, { borderColor: statusColor + '66', backgroundColor: statusColor + '1A' }]}>
                <Text style={[styles.itemBadgeText, { color: statusColor }]}>{status}</Text>
              </View>
            </View>
          );
        })}

        <Text style={styles.uploadHint}>
          Use the web app to upload compliance documents.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  empty: { color: colors.textSecondary },
  content: { padding: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  trustScore: { fontSize: 28, fontWeight: 'bold', color: colors.accentLight },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemInfo: { flex: 1, marginRight: spacing.sm },
  itemLabel: { fontSize: 14, color: colors.text },
  required: { color: colors.error },
  rejectionNote: { fontSize: 11, color: colors.error, marginTop: 2 },
  itemBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  itemBadgeText: { fontSize: 10, fontWeight: '600' },
  uploadHint: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
});
