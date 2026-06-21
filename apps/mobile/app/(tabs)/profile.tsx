import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/auth-context';
import { colors, spacing } from '../../src/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.email ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.email}>{user?.email ?? ''}</Text>

        <View style={styles.infoPill}>
          <Text style={styles.infoLabel}>Role</Text>
          <Text style={styles.infoValue}>{user?.role ?? '—'}</Text>
        </View>
        <View style={styles.infoPill}>
          <Text style={styles.infoLabel}>Org ID</Text>
          <Text style={styles.infoValueMono}>{user?.orgId ?? '—'}</Text>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Khanij Nexus · Pre-Alpha</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: spacing.lg, alignItems: 'center', paddingTop: 40 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent + '22',
    borderWidth: 2,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 28, fontWeight: 'bold', color: colors.accent },
  email: { fontSize: 16, color: colors.text, marginBottom: spacing.xl },
  infoPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: spacing.sm,
  },
  infoLabel: { fontSize: 14, color: colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.accent },
  infoValueMono: { fontSize: 12, color: colors.text, fontFamily: 'monospace' },
  logoutBtn: {
    marginTop: spacing.xl,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.error + '66',
    backgroundColor: colors.error + '1A',
  },
  logoutText: { color: colors.error, fontWeight: '600', fontSize: 15 },
  footer: { position: 'absolute', bottom: 24 },
  footerText: { fontSize: 11, color: colors.textSecondary },
});
