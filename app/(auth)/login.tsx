// app/(auth)/login.tsx
// Tela de login — email + senha com Supabase Auth
// Redireciona via useEffect quando session muda

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { signIn, loading, session, user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const passwordRef = useRef<TextInput>(null);

  // Redirecionar quando sessão mudar (login bem-sucedido)
  useEffect(() => {
    if (!session) return;
    
    console.log('=== LOGIN REDIRECT ===');
    console.log('session:', !!session);
    console.log('user:', user ? JSON.stringify({ id: user.id, nome: user.nome, onboarding: user.onboarding_completo }) : 'null');
    
    const timer = setTimeout(() => {
      try {
        if (user?.onboarding_completo) {
          console.log('>>> Navigating to (tabs)/home');
          router.replace('/(tabs)/home');
        } else {
          console.log('>>> Navigating to (onboarding)/choose-notebook');
          router.replace('/(onboarding)/choose-notebook');
        }
      } catch (navError) {
        console.error('Navigation error:', navError);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [session, user]);

  async function handleLogin() {
    setErrorMsg('');

    if (!email.trim()) {
      setErrorMsg('Digite seu email');
      return;
    }
    if (!password) {
      setErrorMsg('Digite sua senha');
      return;
    }

    const { error } = await signIn(email, password);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setErrorMsg('Email ou senha incorretos');
      } else if (error.message.includes('Email not confirmed')) {
        setErrorMsg('Confirme seu email antes de entrar');
      } else if (error.message.includes('rate limit')) {
        setErrorMsg('Muitas tentativas. Aguarde um momento.');
      } else {
        setErrorMsg(error.message);
      }
    }
    // Redirecionamento acontece no useEffect acima quando session muda
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logoEmoji}>⚡</Text>
            <Text style={[styles.logoText, { color: colors.accent }]}>
              WordFlow
            </Text>
            <Text style={[styles.tagline, { color: colors.text2 }]}>
              Destrave seu inglês
            </Text>
          </View>

          {/* Card do form */}
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.formTitle, { color: colors.text1 }]}>
              Entrar na sua conta
            </Text>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text2 }]}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.bgRaised,
                    color: colors.text1,
                    borderColor: errorMsg && !email.trim() ? colors.rose : colors.border,
                  },
                ]}
                placeholder="seu@email.com"
                placeholderTextColor={colors.text3}
                value={email}
                onChangeText={(t) => { setEmail(t); setErrorMsg(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!loading}
              />
            </View>

            {/* Senha */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text2 }]}>Senha</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  ref={passwordRef}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    {
                      backgroundColor: colors.bgRaised,
                      color: colors.text1,
                      borderColor: errorMsg && !password ? colors.rose : colors.border,
                    },
                  ]}
                  placeholder="Sua senha"
                  placeholderTextColor={colors.text3}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setErrorMsg(''); }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={[styles.eyeBtn, { backgroundColor: colors.bgRaised }]}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ fontSize: 18 }}>
                    {showPassword ? '🙈' : '👁️'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Erro */}
            {errorMsg ? (
              <View
                style={[styles.errorBox, { backgroundColor: `${colors.rose}15` }]}
              >
                <Text style={[styles.errorText, { color: colors.rose }]}>
                  {errorMsg}
                </Text>
              </View>
            ) : null}

            {/* Botão Login */}
            <TouchableOpacity
              style={[
                styles.btn,
                { backgroundColor: colors.accent },
                loading && styles.btnDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnText}>Entrar</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Link para registro */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.text2 }]}>
              Não tem conta?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/register')}
              disabled={loading}
            >
              <Text style={[styles.footerLink, { color: colors.accent }]}>
                Criar conta grátis
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoEmoji: {
    fontSize: 44,
    marginBottom: 4,
  },
  logoText: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    marginTop: 4,
  },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeBtn: {
    position: 'absolute',
    right: 4,
    top: 4,
    bottom: 4,
    width: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
