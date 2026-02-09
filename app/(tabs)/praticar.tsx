// app/(tabs)/praticar.tsx
// Tela de Prática - Core Loop do WordFlow
// Fase 4 - Implementação completa

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types
interface Frase {
  frase_id: string;
  frase: string;
  traducao: string;
  explicacao: string | null;
  audio_url: string | null;
  estado: string;
  ordem: number;
}

interface Feedback {
  mensagem: string;
  tipo: 'acerto' | 'erro' | 'confirmacao';
  emoji: string;
}

interface SessaoInfo {
  frases_respondidas: number;
  total_frases: number;
  acertos: number;
  erros: number;
  concluida: boolean;
}

// Estados da tela
type TelaEstado = 'carregando' | 'pergunta' | 'feedback' | 'resumo' | 'erro' | 'sem_frases';

export default function PraticarScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  // Estado principal
  const [estado, setEstado] = useState<TelaEstado>('carregando');
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [frases, setFrases] = useState<Frase[]>([]);
  const [fraseAtualIndex, setFraseAtualIndex] = useState(0);
  const [sessaoInfo, setSessaoInfo] = useState<SessaoInfo | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [fraseInfo, setFraseInfo] = useState<{ traducao: string; explicacao: string | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagemMotivacional, setMensagemMotivacional] = useState<string>('');

  // Animações
  const cardOpacity = useSharedValue(1);
  const cardTranslateX = useSharedValue(0);
  const feedbackOpacity = useSharedValue(0);
  const feedbackScale = useSharedValue(0.8);
  const buttonScale = useSharedValue(1);

  // Iniciar sessão ao montar
  useEffect(() => {
    if (user?.id) {
      iniciarSessao();
    }
  }, [user?.id]);

  // Função para iniciar sessão
  const iniciarSessao = async () => {
    setEstado('carregando');
    setErro(null);

    try {
      const response = await supabase.functions.invoke('iniciar-sessao-app', {
        body: { user_id: user?.id, tipo: 'pratica' }
      });

      if (response.error) throw new Error(response.error.message);
      
      const data = response.data;

      if (!data.success) {
        if (data.code === 'NO_PHRASES') {
          setEstado('sem_frases');
          return;
        }
        throw new Error(data.error || 'Erro ao iniciar sessão');
      }

      setSessaoId(data.sessao_id);
      setFrases(data.frases);
      setFraseAtualIndex(0);
      setMensagemMotivacional(data.mensagem_motivacional || '');
      setSessaoInfo({
        frases_respondidas: data.frases_respondidas || 0,
        total_frases: data.total_frases,
        acertos: 0,
        erros: 0,
        concluida: false,
      });
      setEstado('pergunta');

    } catch (err: any) {
      console.error('Erro ao iniciar sessão:', err);
      setErro(err.message || 'Erro ao carregar frases');
      setEstado('erro');
    }
  };

  // Função para responder frase
  const responderFrase = async (sabe: boolean) => {
    if (!sessaoId || !frases[fraseAtualIndex]) return;

    // Haptic feedback
    Haptics.impactAsync(
      sabe ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
    );

    // Animação do botão
    buttonScale.value = withSequence(
      withTiming(0.95, { duration: 50 }),
      withTiming(1, { duration: 100 })
    );

    const fraseAtual = frases[fraseAtualIndex];

    try {
      const response = await supabase.functions.invoke('responder-frase-app', {
        body: {
          user_id: user?.id,
          sessao_id: sessaoId,
          frase_id: fraseAtual.frase_id,
          sabe,
        }
      });

      if (response.error) throw new Error(response.error.message);

      const data = response.data;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao processar resposta');
      }

      // Atualizar estado com feedback
      setFeedback(data.feedback);
      setFraseInfo(data.frase_info);
      setSessaoInfo(data.sessao);

      // Mostrar feedback com animação
      setEstado('feedback');
      feedbackOpacity.value = withTiming(1, { duration: 300 });
      feedbackScale.value = withSpring(1);

    } catch (err: any) {
      console.error('Erro ao responder:', err);
      // Não bloquear o fluxo, mostrar feedback genérico
      setFeedback({
        mensagem: sabe ? 'Boa!' : 'Vamos praticar!',
        tipo: sabe ? 'acerto' : 'erro',
        emoji: sabe ? '✨' : '🧠',
      });
      setFraseInfo({
        traducao: fraseAtual.traducao,
        explicacao: fraseAtual.explicacao,
      });
      setEstado('feedback');
      feedbackOpacity.value = withTiming(1, { duration: 300 });
      feedbackScale.value = withSpring(1);
    }
  };

  // Avançar para próxima frase
  const proximaFrase = () => {
    // Haptic
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Verificar se sessão concluída
    if (sessaoInfo?.concluida || fraseAtualIndex >= frases.length - 1) {
      setEstado('resumo');
      return;
    }

    // Animação de saída
    cardOpacity.value = withTiming(0, { duration: 200 });
    cardTranslateX.value = withTiming(-SCREEN_WIDTH, { duration: 250 }, () => {
      runOnJS(atualizarParaProximaFrase)();
    });
  };

  const atualizarParaProximaFrase = () => {
    setFraseAtualIndex(prev => prev + 1);
    setFeedback(null);
    setFraseInfo(null);
    setEstado('pergunta');

    // Reset animações
    cardTranslateX.value = SCREEN_WIDTH;
    feedbackOpacity.value = 0;
    feedbackScale.value = 0.8;

    // Animação de entrada
    cardOpacity.value = withTiming(1, { duration: 200 });
    cardTranslateX.value = withSpring(0);
  };

  // Voltar para home
  const voltarParaHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(tabs)');
  };

  // Reiniciar sessão
  const reiniciarSessao = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    iniciarSessao();
  };

  // Animated styles
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateX: cardTranslateX.value }],
  }));

  const feedbackAnimatedStyle = useAnimatedStyle(() => ({
    opacity: feedbackOpacity.value,
    transform: [{ scale: feedbackScale.value }],
  }));

  // Frase atual
  const fraseAtual = frases[fraseAtualIndex];

  // ========== RENDERS ==========

  // Tela de carregamento
  if (estado === 'carregando') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.text2 }]}>
            Preparando sua sessão...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Tela de erro
  if (estado === 'erro') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.centerContent}>
          <Text style={styles.errorEmoji}>😕</Text>
          <Text style={[styles.errorTitle, { color: colors.text1 }]}>
            Ops! Algo deu errado
          </Text>
          <Text style={[styles.errorMessage, { color: colors.text2 }]}>
            {erro}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            onPress={reiniciarSessao}
          >
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={voltarParaHome}>
            <Text style={[styles.backLink, { color: colors.text3 }]}>
              Voltar para Home
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Tela sem frases
  if (estado === 'sem_frases') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.centerContent}>
          <Text style={styles.errorEmoji}>🎉</Text>
          <Text style={[styles.errorTitle, { color: colors.text1 }]}>
            Você está em dia!
          </Text>
          <Text style={[styles.errorMessage, { color: colors.text2 }]}>
            Não há frases para praticar agora.{'\n'}Volte mais tarde para suas revisões!
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            onPress={voltarParaHome}
          >
            <Text style={styles.retryButtonText}>Voltar para Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Tela de resumo
  if (estado === 'resumo') {
    const taxa = sessaoInfo?.total_frases 
      ? Math.round((sessaoInfo.acertos / sessaoInfo.total_frases) * 100) 
      : 0;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.centerContent}>
          <Text style={styles.resumoEmoji}>🎯</Text>
          <Text style={[styles.resumoTitle, { color: colors.text1 }]}>
            Sessão concluída!
          </Text>
          
          <View style={[styles.resumoCard, { backgroundColor: colors.bgCard }]}>
            <View style={styles.resumoRow}>
              <Text style={[styles.resumoLabel, { color: colors.text2 }]}>Total</Text>
              <Text style={[styles.resumoValue, { color: colors.text1 }]}>
                {sessaoInfo?.total_frases || 0} frases
              </Text>
            </View>
            <View style={styles.resumoRow}>
              <Text style={[styles.resumoLabel, { color: colors.text2 }]}>Acertos</Text>
              <Text style={[styles.resumoValue, { color: colors.green }]}>
                {sessaoInfo?.acertos || 0}
              </Text>
            </View>
            <View style={styles.resumoRow}>
              <Text style={[styles.resumoLabel, { color: colors.text2 }]}>Erros</Text>
              <Text style={[styles.resumoValue, { color: colors.rose }]}>
                {sessaoInfo?.erros || 0}
              </Text>
            </View>
            <View style={[styles.resumoRow, styles.resumoRowLast]}>
              <Text style={[styles.resumoLabel, { color: colors.text2 }]}>Taxa</Text>
              <Text style={[styles.resumoValue, { color: colors.accent }]}>
                {taxa}%
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            onPress={voltarParaHome}
          >
            <Text style={styles.retryButtonText}>Voltar para Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Tela principal (pergunta ou feedback)
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header com progresso */}
      <View style={styles.header}>
        <TouchableOpacity onPress={voltarParaHome} style={styles.closeButton}>
          <Text style={[styles.closeIcon, { color: colors.text2 }]}>✕</Text>
        </TouchableOpacity>
        
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: colors.bgRaised }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.accent,
                  width: `${((fraseAtualIndex + 1) / frases.length) * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.text3 }]}>
            {fraseAtualIndex + 1}/{frases.length}
          </Text>
        </View>
      </View>

      {/* Mensagem motivacional */}
      {mensagemMotivacional && fraseAtualIndex === 0 && estado === 'pergunta' && (
        <View style={styles.motivacionalContainer}>
          <Text style={[styles.motivacionalText, { color: colors.text2 }]}>
            {mensagemMotivacional}
          </Text>
        </View>
      )}

      {/* Card da frase */}
      <Animated.View style={[styles.cardContainer, cardAnimatedStyle]}>
        <View style={[styles.phraseCard, { backgroundColor: colors.bgCard }]}>
          {/* Estado da frase (badge) */}
          {fraseAtual?.estado && fraseAtual.estado !== 'nova' && (
            <View style={[styles.estadoBadge, { backgroundColor: colors.bgRaised }]}>
              <Text style={[styles.estadoText, { color: colors.text3 }]}>
                {fraseAtual.estado === 'aprendendo' ? '🔄 Revisão' : 
                 fraseAtual.estado === 'confirmacao' ? '✓ Confirmar' :
                 fraseAtual.estado === 'manutencao' ? '💪 Manutenção' : ''}
              </Text>
            </View>
          )}

          {/* Frase em inglês */}
          <Text style={[styles.phraseText, { color: colors.text1 }]}>
            {fraseAtual?.frase}
          </Text>

          {/* Feedback (quando respondido) */}
          {estado === 'feedback' && (
            <Animated.View style={[styles.feedbackContainer, feedbackAnimatedStyle]}>
              <Text style={styles.feedbackEmoji}>{feedback?.emoji}</Text>
              <Text style={[
                styles.feedbackMensagem,
                { color: feedback?.tipo === 'erro' ? colors.sky : colors.green }
              ]}>
                {feedback?.mensagem}
              </Text>
              
              <View style={styles.traducaoContainer}>
                <Text style={[styles.traducaoLabel, { color: colors.text3 }]}>
                  Tradução
                </Text>
                <Text style={[styles.traducaoText, { color: colors.text1 }]}>
                  {fraseInfo?.traducao}
                </Text>
                {fraseInfo?.explicacao && (
                  <Text style={[styles.explicacaoText, { color: colors.text2 }]}>
                    {fraseInfo.explicacao}
                  </Text>
                )}
              </View>
            </Animated.View>
          )}
        </View>
      </Animated.View>

      {/* Botões de ação */}
      <View style={styles.buttonsContainer}>
        {estado === 'pergunta' ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.naoSeiButton, { backgroundColor: colors.bgCard, borderColor: colors.rose }]}
              onPress={() => responderFrase(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.buttonEmoji]}>🤔</Text>
              <Text style={[styles.buttonText, { color: colors.rose }]}>Não sei</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.seiButton, { backgroundColor: colors.green }]}
              onPress={() => responderFrase(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.buttonEmoji]}>✓</Text>
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Sei</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.continuarButton, { backgroundColor: colors.accent }]}
            onPress={proximaFrase}
            activeOpacity={0.7}
          >
            <Text style={styles.continuarButtonText}>
              {sessaoInfo?.concluida || fraseAtualIndex >= frases.length - 1 
                ? 'Ver resumo' 
                : 'Próxima frase'}
            </Text>
            <Text style={styles.continuarButtonArrow}>→</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 20,
    fontWeight: '300',
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
  },

  // Motivacional
  motivacionalContainer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  motivacionalText: {
    fontSize: 14,
    textAlign: 'center',
  },

  // Card
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  phraseCard: {
    borderRadius: 20,
    padding: 24,
    minHeight: 280,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  estadoBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  estadoText: {
    fontSize: 12,
    fontWeight: '500',
  },
  phraseText: {
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 38,
  },

  // Feedback
  feedbackContainer: {
    marginTop: 24,
    alignItems: 'center',
    width: '100%',
  },
  feedbackEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  feedbackMensagem: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
  },
  traducaoContainer: {
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  traducaoLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  traducaoText: {
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  explicacaoText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Botões
  buttonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 8,
  },
  naoSeiButton: {
    borderWidth: 2,
  },
  seiButton: {},
  buttonEmoji: {
    fontSize: 20,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  continuarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 8,
  },
  continuarButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  continuarButtonArrow: {
    color: '#FFFFFF',
    fontSize: 20,
  },

  // Erro
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backLink: {
    fontSize: 14,
    marginTop: 8,
  },

  // Resumo
  resumoEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  resumoTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  resumoCard: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  resumoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  resumoRowLast: {
    borderBottomWidth: 0,
  },
  resumoLabel: {
    fontSize: 16,
  },
  resumoValue: {
    fontSize: 20,
    fontWeight: '700',
  },
});