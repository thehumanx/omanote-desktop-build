import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Fingerprint, Lock, ShieldAlert } from 'lucide-react-native';
import { useEncryption } from '../contexts/EncryptionContext';
import { useTheme } from '../hooks/useTheme';

export function UnlockView() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { unlock, unlockWithBiometric, hasBiometric, hasSavedPassphrase } = useEncryption();

  const [passphrase, setPassphrase] = useState('');
  const [saveForBiometric, setSaveForBiometric] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const s = styles(theme);

  async function handlePassphrase() {
    if (!passphrase.trim()) return;
    setLoading(true);
    setError(null);
    const ok = await unlock(passphrase.trim(), saveForBiometric);
    setLoading(false);
    if (!ok) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Incorrect passphrase. Please try again.');
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  async function handleBiometric() {
    setLoading(true);
    setError(null);
    const ok = await unlockWithBiometric();
    setLoading(false);
    if (!ok) {
      setError('Biometric authentication failed. Enter your passphrase instead.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={s.hero}>
        <View style={s.lockIcon}>
          <Lock size={32} color={theme.actionPrimaryInk} />
        </View>
        <Text style={s.title}>Unlock Omanote</Text>
        <Text style={s.subtitle}>
          Your notes are end-to-end encrypted. Enter your passphrase to access them.
        </Text>
      </View>

      {/* Biometric shortcut */}
      {hasBiometric && hasSavedPassphrase && (
        <Pressable
          style={({ pressed }) => [s.biometricBtn, pressed && s.btnPressed]}
          onPress={handleBiometric}
          disabled={loading}
        >
          <Fingerprint size={22} color={theme.ink} />
          <Text style={s.biometricText}>Unlock with biometric</Text>
        </Pressable>
      )}

      {/* Divider if biometric is shown */}
      {hasBiometric && hasSavedPassphrase && (
        <View style={s.dividerRow}>
          <View style={s.divider} />
          <Text style={s.dividerText}>or enter passphrase</Text>
          <View style={s.divider} />
        </View>
      )}

      {/* Error banner */}
      {error && (
        <View style={s.errorBanner}>
          <ShieldAlert size={16} color={theme.dangerInk} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {/* Passphrase input */}
      <View style={s.form}>
        <TextInput
          ref={inputRef}
          style={s.input}
          placeholder="Encryption passphrase"
          placeholderTextColor={theme.inkFaint}
          value={passphrase}
          onChangeText={setPassphrase}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handlePassphrase}
        />

        {/* Save for biometric toggle — only show if device supports it and passphrase not yet saved */}
        {hasBiometric && !hasSavedPassphrase && (
          <View style={s.toggleRow}>
            <Text style={s.toggleLabel}>Remember with biometric</Text>
            <Switch
              value={saveForBiometric}
              onValueChange={setSaveForBiometric}
              trackColor={{ true: theme.accent }}
            />
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            s.unlockBtn,
            !passphrase.trim() && s.unlockBtnDisabled,
            pressed && s.btnPressed,
          ]}
          onPress={handlePassphrase}
          disabled={loading || !passphrase.trim()}
        >
          {loading ? (
            <ActivityIndicator color={theme.actionPrimaryInk} size="small" />
          ) : (
            <Text style={s.unlockBtnText}>Unlock</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.canvas,
      paddingHorizontal: 24,
      justifyContent: 'center',
      gap: 20,
    },
    hero: { alignItems: 'center', gap: 12 },
    lockIcon: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: theme.actionPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.ink,
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: 14,
      color: theme.inkMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    biometricBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: 14,
      paddingVertical: 16,
      backgroundColor: theme.surface,
    },
    biometricText: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.ink,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    divider: { flex: 1, height: 1, backgroundColor: theme.line },
    dividerText: { fontSize: 12, color: theme.inkFaint },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.dangerSurface,
      borderRadius: 10,
      padding: 12,
    },
    errorText: { flex: 1, fontSize: 13, color: theme.dangerInk },
    form: { gap: 12 },
    input: {
      backgroundColor: theme.surfaceMuted,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: theme.ink,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    toggleLabel: { fontSize: 14, color: theme.inkMuted },
    unlockBtn: {
      backgroundColor: theme.actionPrimary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
    },
    unlockBtnDisabled: { opacity: 0.4 },
    btnPressed: { opacity: 0.8 },
    unlockBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.actionPrimaryInk,
    },
  });
}
