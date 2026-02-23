// app/(onboarding)/assessment.tsx
// MINI-PRÁTICA — Onboarding simplificado
// 5 frases rápidas para detectar nível automaticamente
// Fluxo: Registro → Mini-prática → Home

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import type { UserLevel } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FraseAvaliacao {
  id: string;
  frase: string;
  traducao: string;
  nivel: UserLevel;
}

type TelaEstado = 'carregando' | 'praticando' | 'calculando' | 'erro';

// Helper para haptics (ignora na web)
const hapticFeedback = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(style);
  }
};

export default function AssessmentScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, session, refreshProfile } = useAuth();

  // Estados
  const [estado, setEstado] = useState<TelaEstado>('carregando');
  const [frases, setFrases] = useState<FraseAvaliacao[]>([]);
  const [fraseAtual, setFraseAtual] = useState(0);
  const [respostas, setRespostas] = useState<{ id: string; nivel: UserLevel; sabe: boolean }[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  // Animações
  const cardOpacity = useSharedValue(1);
  const cardTranslateX = useSharedValue(0);

  // Buscar 5 frases mistas (2 básica, 2 inter, 1 avançada)
  const buscarFrases = useCallback(async () => {
    try {
      const distribuicao: { nivel: UserLevel; qty: number }[] = [
        { nivel: 'basico', qty: 2 },
        { nivel: 'intermediario', qty: 2 },
        { nivel: 'avancado', qty: 1 },
      ];

      const todasFrases: FraseAvaliacao[] = [];

      for (const { nivel, qty } of distribuicao) {
        const { data, error } = await supabase
          .from('frases')
          .select('id, frase, traducao, nivel')
          .eq('nivel', nivel)
          .eq('status', 'ativa')
          .limit(qty + 3); // busca extra para embaralhar

        if (error) {
          console.error(`Erro buscando ${nivel}:`, error);
          continue;
        }

        if (data) {
          const embaralhadas = data.sort(() => Math.random() - 0.5).slice(0, qty);
          todasFrases.push(...embaralhadas.map(f => ({
            ...f,
            nivel: f.nivel as UserLevel,
          })));
        }
      }

      // Embaralhar ordem final
      return todasFrases.sort(() => Math.random() - 0.5);
    } catch (e) {
      console.error('Erro ao buscar frases:', e);
      return [];
    }
  }, []);

  // Carregar frases
  useEffect(() => {
    async function init() {
      const frasesCarregadas = await buscarFrases();
      if (frasesCarregadas.length < 5) {
        setErro('Não foi possível carregar as frases. Tente novamente.');
        setEstado('erro');
        return;
      }
      setFrases(frasesCarregadas);
      setEstado('praticando');
    }
    init();
  }, [buscarFrases]);

  // Calcular nível baseado nas respostas
  const calcularNivel = (resps: typeof respostas): UserLevel => {
    const basicas = resps.filter(r => r.nivel === 'basico');
    const intermediarias = resps.filter(r => r.nivel === 'intermediario');

    const taxaBasico = basicas.length > 0
      ? basicas.filter(r => r.sabe).length / basicas.length
      : 0;
    const taxaInter = intermediarias.length > 0
      ? intermediarias.filter(r => r.sabe).length / intermediarias.length
      : 0;

    // Lógica: básico <50% → básico, inter <50% → intermediário, senão → avançado
    if (taxaBasico < 0.5) return 'basico';
    if (taxaInter < 0.5) return 'intermediario';
    return 'avancado';
  };

  // Finalizar onboarding
  const finalizarOnboarding = async (resps: typeof respostas) => {
    setEstado('calculando');

    try {
      const userId = session?.user?.id || user?.id;
      if (!userId) {
        setErro('Sessão não encontrada. Faça login novamente.');
        setEstado('erro');
        return;
      }

      const nivelDetectado = calcularNivel(resps);

      // Buscar caderno padrão
      const { data: cadernoPadrao } = await supabase
        .from('cadernos')
        .select('id')
        .eq('tipo', 'padrao')
        .limit(1)
        .single();

      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 dias

      // Salvar no Supabase
      const { error: updateError } = await supabase
        .from('users')
        .update({
          nivel: nivelDetectado,
          caderno_ativo_id: cadernoPadrao?.id || null,
          horarios_proibidos: [], // Vazio = recebe em todos os horários
          onboarding_completo: true,
          status: 'trial',
          trial_inicio: now.toISOString(),
          trial_fim: trialEnd.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Erro ao salvar:', updateError);
        setErro('Não foi possível salvar. Tente novamente.');
        setEstado('erro');
        return;
      }

      // Refresh do perfil
      await refreshProfile();

      // Ir para Home
      router.replace('/(tabs)');

    } catch (e) {
      console.error('Erro:', e);
      setErro('Algo deu errado. Tente novamente.');
      setEstado('erro');
    }
  };

  // Responder frase
  const responder = (sabe: boolean) => {
    hapticFeedback(
      sabe ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
    );

    const fraseAtualObj = frases[fraseAtual];
    const novaResposta = {
      id: fraseAtualObj.id,
      nivel: fraseAtualObj.nivel,
      sabe,
    };

    const novasRespostas = [...respostas, novaResposta];
    setRespostas(novasRespostas);

    // Verificar se terminou
    if (fraseAtual >= frases.length - 1) {
      finalizarOnboarding(novasRespostas);
      return;
    }

    // Animar para próxima
    cardOpacity.value = withTiming(0, { duration: 150 });
    cardTranslateX.value = withTiming(sabe ? SCREEN_WIDTH : -SCREEN_WIDTH, { duration: 200 }, () => {
      runOnJS(avancarFrase)();
    });
  };

  const avancarFrase = () => {
    setFraseAtual(prev => prev + 1);
    cardTranslateX.value = 0;
    cardOpacity.value = withSpring(1);
  };

  // Retry
  const tentarNovamente = async () => {
    setEstado('carregando');
    setErro(null);
    setFrases([]);
    setFraseAtual(0);
    setRespostas([]);
    
    const frasesCarregadas = await buscarFrases();
    if (frasesCarregadas.length < 5) {
      setErro('Não foi possível carregar as frases.');
      setEstado('erro');
      return;
    }
    setFrases(frasesCarregadas);
    setEstado('praticando');
  };

  // Animated styles
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateX: cardTranslateX.value }],
  }));

  const nome = user?.nome?.split(' ')[0] || 'você';

  // ========== RENDERS ==========

  // Carregando
  if (estado === 'carregando') {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.text2 }]}>
            Preparando suas frases...
          </Text>
        </View>
      </View>
    );
  }

  // Erro
  if (estado === 'erro') {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centerContent}>
          <Text style={styles.errorEmoji}>😕</Text>
          <Text style={[styles.errorTitle, { color: colors.text1 }]}>
            Ops!
          </Text>
          <Text style={[styles.errorMessage, { color: colors.text2 }]}>
            {erro}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            onPress={tentarNovamente}
          >
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Calculando
  if (estado === 'calculando') {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.text2 }]}>
            Detectando seu nível...
          </Text>
        </View>
      </View>
    );
  }

  // Praticando
  const frase = frases[fraseAtual];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.text1 }]}>
          Olá, {nome}! 👋
        </Text>
        <Text style={[styles.subtitle, { color: colors.text2 }]}>
          Vamos descobrir seu nível.{'\n'}
          Responda rápido, sem pensar muito!
        </Text>
      </View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: colors.bgRaised }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.accent,
                width: `${((fraseAtual + 1) / frases.length) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: colors.text3 }]}>
          {fraseAtual + 1} de {frases.length}
        </Text>
      </View>

      {/* Card da frase */}
      <View style={styles.cardContainer}>
        <Animated.View style={[styles.phraseCard, { backgroundColor: colors.bgCard }, cardAnimatedStyle]}>
          <Text style={[styles.phraseText, { color: colors.text1 }]}>
            {frase?.frase}
          </Text>
          <Text style={[styles.hint, { color: colors.text3 }]}>
            Você sabe o que significa?
          </Text>
        </Animated.View>
      </View>

      {/* Botões */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.naoSeiButton, { backgroundColor: colors.bgCard, borderColor: colors.rose }]}
          onPress={() => responder(false)}
          activeOpacity={0.7}
        >
          <Text style={[styles.buttonEmoji]}>🤔</Text>
          <Text style={[styles.buttonText, { color: colors.rose }]}>Não sei</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.seiButton, { backgroundColor: colors.green }]}
          onPress={() => responder(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.buttonEmoji]}>✓</Text>
          <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Sei</Text>
        </TouchableOpacity>
      </View>

      {/* Dica */}
      <Text style={[styles.footerHint, { color: colors.text3 }]}>
        Seja honesto — isso calibra seu nível inicial.
      </Text>
    </View>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 20,
    gap: 12,
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
    fontSize: 14,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'right',
  },

  // Card
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  phraseCard: {
    borderRadius: 20,
    padding: 32,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  phraseText: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 34,
  },
  hint: {
    fontSize: 14,
    marginTop: 16,
  },

  // Botões
  buttonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 16,
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

  // Footer
  footerHint: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
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
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});