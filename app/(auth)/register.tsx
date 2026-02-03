// app/(auth)/register.tsx
// Tela de registro — nome + email + senha
// Trigger handle_new_user() cria perfil em public.users automaticamente

import { useState, useRef } from 'react';
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

export default function RegisterScreen() {
  const { colors } = useTheme();
  const { signUp, loading } = useAuth();
  const router = useRouter();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  function validate(): boolean {
    if (!nome.trim()) {
      setErrorMsg('Digite seu nome');
      return false;
    }
    if (nome.trim().length < 2) {
      setErrorMsg('Nome precisa ter pelo menos 2 caracteres');
      return false;
    }
    if (!email.trim()) {
      setErrorMsg('Digite seu email');
      return false;
    }
    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Email inválido');
      return false;
    }
    if (!password) {
      setErrorMsg('Crie uma senha');
      return false;
    }
    if (password.length < 6) {
      setErrorMsg('Senha precisa ter pelo menos 6 caracteres');
      return false;
    }
    return true;
  }

  async function handleRegister() {
    setErrorMsg('');
    if (!validate()) return;

    const { error } = await signUp(email, password, nome);

    if (error) {
      // Traduzir erros comuns
      if (error.message.includes('already registered')) {
        setErrorMsg('Este email já está cadastrado. Tente fazer login.');
      } else if (error.message.includes('password')) {
        setErrorMsg('Senha fraca. Use pelo menos 6 caracteres.');
      } else {
        setErrorMsg(error.message);
      }
    }
    // Se sucesso, AuthProvider detecta SIGNED_IN e index.tsx redireciona para onboarding
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
          {/* Back button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.backText, { color: colors.text2 }]}>
              ← Voltar
            </Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logoEmoji}>⚡</Text>
            <Text style={[styles.logoText, { color: colors.accent }]}>
              WordFlow
            </Text>
            <Text style={[styles.tagline, { color: colors.text2 }]}>
              Comece a destravar seu inglês
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
              Criar conta grátis
            </Text>

            <Text style={[styles.formSubtitle, { color: colors.text2 }]}>
              7 dias grátis para testar
            </Text>

            {/* Nome */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text2 }]}>Nome</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.bgRaised,
                    color: colors.text1,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Seu nome"
                placeholderTextColor={colors.text3}
                value={nome}
                onChangeText={(t) => { setNome(t); setErrorMsg(''); }}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                editable={!loading}
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text2 }]}>Email</Text>
              <TextInput
                ref={emailRef}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.bgRaised,
                    color: colors.text1,
                    borderColor: colors.border,
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
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={colors.text3}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setErrorMsg(''); }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
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
              {/* Indicador de força */}
              {password.length > 0 && (
                <View style={styles.strengthRow}>
                  <View
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor:
                          password.length < 6
                            ? colors.rose
                            : password.length < 10
                            ? colors.amber
                            : colors.green,
                        width:
                          password.length < 6
                            ? '33%'
                            : password.length < 10
                            ? '66%'
                            : '100%',
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.strengthText,
                      {
                        color:
                          password.length < 6
                            ? colors.rose
                            : password.length < 10
                            ? colors.amber
                            : colors.green,
                      },
                    ]}
                  >
                    {password.length < 6
                      ? 'Fraca'
                      : password.length < 10
                      ? 'Boa'
                      : 'Forte'}
                  </Text>
                </View>
              )}
            </View>

            {/* Erro */}
            {errorMsg ? (
              <View
                style={[styles.errorBox, { backgroundColor: colors.roseLight }]}
              >
                <Text style={[styles.errorText, { color: colors.rose }]}>
                  {errorMsg}
                </Text>
              </View>
            ) : null}

            {/* Botão Criar Conta */}
            <TouchableOpacity
              style={[
                styles.btn,
                { backgroundColor: colors.accent },
                loading && styles.btnDisabled,
              ]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnText}>Criar conta</Text>
              )}
            </TouchableOpacity>

            {/* Trial info */}
            <View
              style={[styles.trialBadge, { backgroundColor: colors.greenLight }]}
            >
              <Text style={[styles.trialText, { color: colors.green }]}>
                ✨ 7 dias grátis · Sem compromisso
              </Text>
            </View>
          </View>

          {/* Link para login */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.text2 }]}>
              Já tem conta?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              disabled={loading}
            >
              <Text style={[styles.footerLink, { color: colors.accent }]}>
                Fazer login
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
    paddingVertical: 20,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoEmoji: {
    fontSize: 38,
    marginBottom: 4,
  },
  logoText: {
    fontSize: 26,
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
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
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
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  strengthBar: {
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 11,
    fontWeight: '600',
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
  trialBadge: {
    borderRadius: 10,
    padding: 10,
    marginTop: 16,
    alignItems: 'center',
  },
  trialText: {
    fontSize: 13,
    fontWeight: '600',
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
