import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/auth-context';
import { colors, spacing } from '../../src/theme';

interface QuickAction {
  label: string;
  description: string;
  route: string;
}

const ACTIONS: QuickAction[] = [
  { label: 'Marketplace', description: 'Search minerals & verified sellers', route: '/(tabs)/marketplace' },
  { label: 'Deals', description: 'Track deals, milestones & payments', route: '/(tabs)/deals' },
  { label: 'Compliance', description: 'Upload docs & check verification', route: '/(tabs)/compliance' },
];

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>Welcome back</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role ?? 'USER'}</Text>
        </View>
        <Text style={styles.email}>{user?.email ?? ''}</Text>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        {ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.route}
            style={styles.card}
            onPress={() => router.push(action.route as any)}
          >
            <Text style={styles.cardTitle}>{action.label}</Text>
            <Text style={styles.cardDesc}>{action.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  greeting: { fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent + '66',
    backgroundColor: colors.accent + '1A',
    marginBottom: spacing.sm,
  },
  roleText: { fontSize: 11, fontWeight: '600', color: colors.accent },
  email: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xl },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: colors.textSecondary },
});
