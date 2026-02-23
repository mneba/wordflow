// app/index.tsx
// Splash → redireciona baseado no estado do usuário

import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

export default function IndexScreen() {
  const { colors } = useTheme();
  const { session, user, initializing } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;

    const timer = setTimeout(() => {
      if (!session) {
        router.replace('/(auth)/login');
      } else if (!user?.onboarding_completo) {
        router.replace('/(onboarding)/choose-notebook');
      } else {
        // CORRIGIDO: /(tabs) abre index.tsx (Home)
        // Antes era /(tabs)/home que estava com href:null
        router.replace('/(tabs)');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [initializing, session, user]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.logo, { color: colors.accent }]}>⚡</Text>
      <Text style={[styles.title, { color: colors.text1 }]}>WordFlow</Text>
      <Text style={[styles.subtitle, { color: colors.text2 }]}>
        Destrave seu inglês
      </Text>
      <ActivityIndicator
        color={colors.accent}
        size="small"
        style={styles.spinner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 6,
  },
  spinner: {
    marginTop: 32,
  },
});
