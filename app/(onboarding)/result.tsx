// app/(onboarding)/result.tsx
// Tela 3 do Onboarding: Resultado da avaliação
// Mostra nível detectado com visual impactante

import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import type { UserLevel } from '@/types';

const LEVEL_CONFIG: Record<
  UserLevel,
  { label: string; emoji: string; description: string; colorKey: 'green' | 'amber' | 'rose' }
> = {
  basico: {
    label: 'Básico',
    emoji: '🌱',
    description:
      'Ótimo ponto de partida! Vamos construir sua base com frases essenciais do dia a dia.',
    colorKey: 'green',
  },
  intermediario: {
    label: 'Intermediário',
    emoji: '⚡',
    description:
      'Você já tem uma boa base! Vamos expandir seu vocabulário e destravar sua fluência.',
    colorKey: 'amber',
  },
  avancado: {
    label: 'Avançado',
    emoji: '🚀',
    description:
      'Impressionante! Vamos aperfeiçoar seu inglês com expressões sofisticadas e naturais.',
    colorKey: 'rose',
  },
};

export default function ResultScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    caderno_id: string;
    nivel_detectado: string;
    total_frases: string;
    total_conhece: string;
    total_nao_conhece: string;
  }>();

  const nivel = (params.nivel_detectado || 'basico') as UserLevel;
  const totalFrases = parseInt(params.total_frases || '0', 10);
  const totalConhece = parseInt(params.total_conhece || '0', 10);
  const totalNaoConhece = parseInt(params.total_nao_conhece || '0', 10);
  const taxa = totalFrases > 0 ? Math.round((totalConhece / totalFrases) * 100) : 0;

  const config = LEVEL_CONFIG[nivel];

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.sequence([
      // Emoji grande aparece
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      // Texto sobe
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleContinue = () => {
    router.push({
      pathname: '/(onboarding)/preferences',
      params: {
        caderno_id: params.caderno_id || '',
        nivel_detectado: nivel,
      },
    });
  };

  const accentColor = colors[config.colorKey];
  const accentLight = colors[`${config.colorKey}Light` as keyof typeof colors] as string;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <View style={[styles.progressBar, { backgroundColor: colors.bgRaised }]}>
          <View style={[styles.progressFill, { width: '75%', backgroundColor: colors.accent }]} />
        </View>
      </View>

      {/* Centro — resultado */}
      <View style={styles.center}>
        {/* Emoji animado */}
        <Animated.View
          style={[
            styles.emojiContainer,
            {
              backgroundColor: accentLight,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={styles.emoji}>{config.emoji}</Text>
        </Animated.View>

        {/* Label de nível */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <Text style={[styles.levelLabel, { color: accentColor }]}>
            Nível {config.label}
          </Text>
          <Text style={[styles.description, { color: colors.text2 }]}>
            {config.description}
          </Text>
        </Animated.View>

        {/* Stats */}
        <Animated.View
          style={[
            styles.statsCard,
            {
              backgroundColor: colors.bgCard,
              borderColor: colors.border,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={[styles.statsTitle, { color: colors.text2 }]}>
            Resultado da avaliação
          </Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text1 }]}>
                {totalFrases}
              </Text>
              <Text style={[styles.statLabel, { color: colors.text3 }]}>
                Avaliadas
              </Text>
            </View>

            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.green }]}>
                {totalConhece}
              </Text>
              <Text style={[styles.statLabel, { color: colors.text3 }]}>
                Conhecia
              </Text>
            </View>

            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.rose }]}>
                {totalNaoConhece}
              </Text>
              <Text style={[styles.statLabel, { color: colors.text3 }]}>
                Não conhecia
              </Text>
            </View>

            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.accent }]}>
                {taxa}%
              </Text>
              <Text style={[styles.statLabel, { color: colors.text3 }]}>
                Acerto
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Nota */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={[styles.note, { color: colors.text3 }]}>
            O nível se ajusta automaticamente conforme você pratica.
          </Text>
        </Animated.View>
      </View>

      {/* Bottom */}
      <View style={[styles.bottomBar, { backgroundColor: colors.bg }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleContinue}
          style={[styles.continueBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.continueBtnText}>Continuar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressWrap: {
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  emojiContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emoji: {
    fontSize: 48,
  },

  levelLabel: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 8,
  },

  // Stats card
  statsCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginTop: 28,
  },
  statsTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 32,
  },

  note: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 20,
  },

  // Bottom
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
  },
  continueBtn: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
