// app/index.tsx
// Splash → redireciona baseado no estado do usuário:
//   - Não logado → (auth)/login
//   - Logado + onboarding incompleto → (onboarding)/choose-notebook
//   - Logado + onboarding completo → (tabs)/home

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
    console.log('=== INDEX REDIRECT ===');
    console.log('initializing:', initializing);
    console.log('session:', !!session);
    console.log('user:', !!user, 'onboarding:', user?.onboarding_completo);
    
    // Esperar inicialização do auth
    if (initializing) return;

    // Pequeno delay para splash visual
    const timer = setTimeout(() => {
      if (!session) {
        console.log('>>> No session, going to login');
        router.replace('/(auth)/login');
      } else if (!user?.onboarding_completo) {
        console.log('>>> Session but no onboarding, going to choose-notebook');
        router.replace('/(onboarding)/choose-notebook');
      } else {
        console.log('>>> All good, going to home');
        router.replace('/(tabs)/home');
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
