import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/auth-context';
import { colors, spacing } from '../src/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({
    email: '',
    password: '',
    legalName: '',
    orgType: 'BUYER',
    state: 'Odisha',
    phone: '',
  });
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleRegister() {
    if (!form.email || !form.password || !form.legalName || !form.phone) {
      Alert.alert('Missing Fields', 'Please fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      await register(form);
      router.replace('/(tabs)/dashboard');
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message ?? 'Please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Register your organization</Text>

        <TextInput
          style={styles.input}
          placeholder="Organization Legal Name"
          placeholderTextColor={colors.textSecondary}
          value={form.legalName}
          onChangeText={(v) => update('legalName', v)}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          value={form.email}
          onChangeText={(v) => update('email', v)}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone (+919876543210)"
          placeholderTextColor={colors.textSecondary}
          keyboardType="phone-pad"
          value={form.phone}
          onChangeText={(v) => update('phone', v)}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 8 characters)"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          value={form.password}
          onChangeText={(v) => update('password', v)}
        />

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.selector}>
              {['BUYER', 'SELLER', 'TRADER'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, form.orgType === t && styles.chipActive]}
                  onPress={() => update('orgType', t)}
                >
                  <Text style={[styles.chipText, form.orgType === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create Account'}</Text>
        </TouchableOpacity>

        <Link href="/login" style={styles.link}>
          <Text style={styles.linkText}>Already have an account? Sign in</Text>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: spacing.lg, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.accent, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  input: {
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.md,
  },
  row: { marginBottom: spacing.md },
  halfInput: { flex: 1 },
  label: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
  selector: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accent + '22' },
  chipText: { fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: colors.accent },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: spacing.lg, alignSelf: 'center' },
  linkText: { color: colors.accentLight, fontSize: 14 },
});
