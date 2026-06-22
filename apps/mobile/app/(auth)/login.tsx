import { useSSO } from '@clerk/expo';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { startSSOFlow } = useSSO();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const redirectUrl = Linking.createURL('/');
      console.log('[Login] redirectUrl:', redirectUrl);
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });
      if (createdSessionId) {
        await setActive!({ session: createdSessionId });
      }
    } catch (e: any) {
      console.error('[Login] SSO error:', e);
      setError(e?.message ?? e?.toString() ?? 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [startSSOFlow]);

  const s = styles(theme);

  return (
    <View style={[s.root, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}>
      <View style={s.hero}>
        <View style={s.logoMark}>
          <Text style={s.logoLetter}>O</Text>
        </View>
        <Text style={s.appName}>Omanote</Text>
        <Text style={s.tagline}>Your personal daily workspace</Text>
      </View>

      <View style={s.actions}>
        {error && (
          <View style={s.errorBanner}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [s.googleBtn, pressed && s.googleBtnPressed]}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.actionPrimaryInk} size="small" />
          ) : (
            <>
              <GoogleIcon />
              <Text style={s.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        <Text style={s.legalNote}>
          By continuing, you agree to Omanote's{'\n'}Terms of Service and Privacy Policy.
        </Text>
      </View>
    </View>
  );
}

function GoogleIcon() {
  return (
    <View style={{ width: 20, height: 20, marginRight: 10 }}>
      <Text style={{ fontSize: 16 }}>G</Text>
    </View>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.canvas,
      paddingHorizontal: 24,
      justifyContent: 'space-between',
    },
    hero: {
      alignItems: 'center',
      gap: 12,
    },
    logoMark: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: theme.actionPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    logoLetter: {
      fontSize: 36,
      fontWeight: '700',
      color: theme.actionPrimaryInk,
      letterSpacing: -1,
    },
    appName: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.ink,
      letterSpacing: -0.5,
    },
    tagline: {
      fontSize: 16,
      color: theme.inkMuted,
      textAlign: 'center',
    },
    actions: {
      gap: 16,
    },
    errorBanner: {
      backgroundColor: theme.dangerSurface,
      borderRadius: 10,
      padding: 12,
    },
    errorText: {
      color: theme.dangerInk,
      fontSize: 14,
      textAlign: 'center',
    },
    googleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.actionPrimary,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 24,
      gap: 4,
    },
    googleBtnPressed: {
      opacity: 0.85,
    },
    googleBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.actionPrimaryInk,
    },
    legalNote: {
      fontSize: 12,
      color: theme.inkFaint,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}
