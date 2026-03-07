// components/SessionCard.tsx
// V2 - Integrado com pushes do dia + bounce animado
// Card principal da Home

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import type { ContextoUsuario } from '@/utils/mensagensContextuais';
import { getMensagemContextual } from '@/utils/mensagensContextuais';
import type { Sessao } from '@/types';
import type { RevisaoAmanha, PushDiaStatus } from '@/hooks/useHomeData';

interface SessionCardProps {
  contexto: ContextoUsuario;
  sessaoAtiva: Sessao | null;
  sessaoConcluidaHoje: Sessao | null;
  revisoesAmanha: RevisaoAmanha[];
  frasesPerDia: number;
  pushDia: PushDiaStatus;
  onIniciar: () => void;
  onContinuar: () => void;
}

export default function SessionCard({
  contexto,
  sessaoAtiva,
  sessaoConcluidaHoje,
  revisoesAmanha,
  frasesPerDia,
  pushDia,
  onIniciar,
  onContinuar,
}: SessionCardProps) {
  const { colors, isDark } = useTheme();

  // Bounce animation
  const bounceAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    if (pushDia.pendentes > 0) {
      const bounce = RNAnimated.sequence([
        RNAnimated.timing(bounceAnim, { toValue: 1.03, duration: 300, useNativeDriver: true }),
        RNAnimated.timing(bounceAnim, { toValue: 0.97, duration: 200, useNativeDriver: true }),
        RNAnimated.timing(bounceAnim, { toValue: 1.02, duration: 200, useNativeDriver: true }),
        RNAnimated.timing(bounceAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]);
      // Bounce ao montar, depois a cada 8 segundos
      bounce.start();
      const interval = setInterval(() => bounce.start(), 8000);
      return () => clearInterval(interval);
    }
  }, [pushDia.pendentes]);

  // ═══════════════════════════════════════
  // CENÁRIO: Pushes do dia com pendentes
  // ═══════════════════════════════════════
  if (pushDia.total > 0 && pushDia.pendentes > 0) {
    const progresso = pushDia.total > 0
      ? Math.round((pushDia.respondidos / pushDia.total) * 100) : 0;

    return (
      <RNAnimated.View style={{ transform: [{ scale: bounceAnim }] }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onIniciar}
          style={[styles.sessionCard, { backgroundColor: colors.accent }]}
        >
          <View style={styles.decorCircle} />
          <View style={styles.sessionContent}>
            <View style={styles.sessionHeader}>
              <Text style={styles.sessionEmoji}>📬</Text>
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionTitle}>Frases do dia</Text>
                <Text style={styles.sessionMeta}>
                  {pushDia.respondidos} de {pushDia.enviados} respondidas
                </Text>
              </View>
            </View>

            {/* Barra de progresso */}
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progresso}%` }]} />
            </View>

            <Text style={styles.sessionIncentivo}>
              {pushDia.pendentes === 1
                ? 'Falta só 1 frase! Vai lá 💪'
                : pushDia.respondidos === 0
                ? `${pushDia.pendentes} frases te esperando hoje`
                : `Mais ${pushDia.pendentes} frases para praticar`}
            </Text>

            <View style={styles.sessionBtn}>
              <Text style={[styles.sessionBtnText, { color: colors.accent }]}>
                {pushDia.respondidos === 0 ? 'Começar →' : 'Continuar →'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </RNAnimated.View>
    );
  }

  // ═══════════════════════════════════════
  // CENÁRIO: Todos os pushes respondidos
  // ═══════════════════════════════════════
  if (pushDia.total > 0 && pushDia.pendentes === 0 && pushDia.respondidos > 0) {
    return (
      <View
        style={[
          styles.completedCard,
          {
            backgroundColor: isDark ? '#1E3A2F' : '#E8F8F0',
            borderColor: isDark ? 'rgba(94,238,160,0.2)' : 'rgba(34,192,106,0.3)',
          },
        ]}
      >
        <View style={styles.completedHeader}>
          <Text style={styles.completedEmoji}>✅</Text>
          <View>
            <Text style={[styles.completedTitle, { color: colors.green }]}>
              Tudo respondido!
            </Text>
            <Text style={[styles.completedSubtitle, { color: colors.text2 }]}>
              {pushDia.respondidos} frases praticadas hoje
            </Text>
          </View>
        </View>

        {/* Botão para praticar mais (opcional) */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onIniciar}
          style={[styles.praticarMaisBtn, { borderColor: colors.green }]}
        >
          <Text style={[styles.praticarMaisBtnText, { color: colors.green }]}>
            Quero praticar mais →
          </Text>
        </TouchableOpacity>

        {revisoesAmanha.length > 0 && (
          <View
            style={[styles.previewTomorrow, { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}
          >
            <Text style={[styles.previewLabel, { color: colors.text3 }]}>📅 Amanhã</Text>
            <View style={styles.previewContent}>
              <Text style={styles.previewIcon}>🔄</Text>
              <Text style={[styles.previewCount, { color: colors.text1 }]}>
                {revisoesAmanha.length} {revisoesAmanha.length === 1 ? 'revisão agendada' : 'revisões agendadas'}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  // ═══════════════════════════════════════
  // CENÁRIO: Sessão concluída (legacy)
  // ═══════════════════════════════════════
  if (sessaoConcluidaHoje) {
    const acertos = sessaoConcluidaHoje.acertos || 0;
    const erros = sessaoConcluidaHoje.erros || 0;
    const total = acertos + erros;
    const taxa = total > 0 ? Math.round((acertos / total) * 100) : 0;

    return (
      <View
        style={[
          styles.completedCard,
          {
            backgroundColor: isDark ? '#1E3A2F' : '#E8F8F0',
            borderColor: isDark ? 'rgba(94,238,160,0.2)' : 'rgba(34,192,106,0.3)',
          },
        ]}
      >
        <View style={styles.completedHeader}>
          <Text style={styles.completedEmoji}>✅</Text>
          <View>
            <Text style={[styles.completedTitle, { color: colors.green }]}>Sessão concluída!</Text>
            <Text style={[styles.completedSubtitle, { color: colors.text2 }]}>Você praticou hoje</Text>
          </View>
        </View>

        <View style={[styles.completedStats, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)' }]}>
          <View style={styles.completedStat}>
            <Text style={[styles.completedStatValue, { color: colors.green }]}>{acertos}</Text>
            <Text style={[styles.completedStatLabel, { color: colors.text2 }]}>{acertos === 1 ? 'Acerto' : 'Acertos'}</Text>
          </View>
          <View style={styles.completedStat}>
            <Text style={[styles.completedStatValue, { color: colors.rose }]}>{erros}</Text>
            <Text style={[styles.completedStatLabel, { color: colors.text2 }]}>{erros === 1 ? 'Erro' : 'Erros'}</Text>
          </View>
          <View style={styles.completedStat}>
            <Text style={[styles.completedStatValue, { color: colors.accent }]}>{taxa}%</Text>
            <Text style={[styles.completedStatLabel, { color: colors.text2 }]}>Taxa</Text>
          </View>
        </View>

        {revisoesAmanha.length > 0 && (
          <View style={[styles.previewTomorrow, { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
            <Text style={[styles.previewLabel, { color: colors.text3 }]}>📅 Amanhã</Text>
            <View style={styles.previewContent}>
              <Text style={styles.previewIcon}>🔄</Text>
              <Text style={[styles.previewCount, { color: colors.text1 }]}>
                {revisoesAmanha.length} {revisoesAmanha.length === 1 ? 'revisão agendada' : 'revisões agendadas'}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  // ═══════════════════════════════════════
  // CENÁRIO: Sessão pausada (legacy)
  // ═══════════════════════════════════════
  if (sessaoAtiva) {
    const respondidas = sessaoAtiva.frases_respondidas || 0;
    const total = sessaoAtiva.total_frases || frasesPerDia;
    const restantes = total - respondidas;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onContinuar}
        style={[styles.sessionCard, { backgroundColor: colors.accent }]}
      >
        <View style={styles.decorCircle} />
        <View style={styles.sessionContent}>
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionEmoji}>⏸️</Text>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionTitle}>Sessão pausada</Text>
              <Text style={styles.sessionMeta}>{respondidas} de {total} frases</Text>
            </View>
          </View>
          <Text style={styles.sessionIncentivo}>
            Você parou na metade! Só mais {restantes} {restantes === 1 ? 'frase' : 'frases'} 💪
          </Text>
          <View style={styles.sessionBtn}>
            <Text style={[styles.sessionBtnText, { color: colors.accent }]}>Continuar →</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ═══════════════════════════════════════
  // CENÁRIO: Normal / Novo usuário
  // ═══════════════════════════════════════
  const mensagem = getMensagemContextual(contexto);
  const titulo = contexto.isNovoUsuario ? 'Sua primeira sessão 👋' : 'Sessão do dia';
  const emoji = contexto.isNovoUsuario ? '👋' : '🎯';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onIniciar}
      style={[styles.sessionCard, { backgroundColor: colors.accent }]}
    >
      <View style={styles.decorCircle} />
      <View style={styles.sessionContent}>
        <View style={styles.sessionHeader}>
          <Text style={styles.sessionEmoji}>{emoji}</Text>
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionTitle}>{titulo}</Text>
            <Text style={styles.sessionMeta}>{frasesPerDia} frases · ~2 min</Text>
          </View>
        </View>
        <Text style={styles.sessionIncentivo}>{mensagem}</Text>
        <View style={styles.sessionBtn}>
          <Text style={[styles.sessionBtnText, { color: colors.accent }]}>Iniciar prática →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ── Card de sessão (roxo) ──
  sessionCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  decorCircle: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sessionContent: { position: 'relative', zIndex: 1 },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  sessionEmoji: { fontSize: 44 },
  sessionInfo: { flex: 1 },
  sessionTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  sessionMeta: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  sessionIncentivo: { fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 22, marginBottom: 20 },
  sessionBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  sessionBtnText: { fontSize: 16, fontWeight: '700' },

  // Barra de progresso
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },

  // ── Card concluído (verde) ──
  completedCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
  },
  completedHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  completedEmoji: { fontSize: 40 },
  completedTitle: { fontSize: 20, fontWeight: '800' },
  completedSubtitle: { fontSize: 13, marginTop: 2 },
  completedStats: {
    flexDirection: 'row',
    gap: 20,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  completedStat: { flex: 1, alignItems: 'center' },
  completedStatValue: { fontSize: 24, fontWeight: '800' },
  completedStatLabel: { fontSize: 11, marginTop: 4, textTransform: 'uppercase' },

  praticarMaisBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  praticarMaisBtnText: { fontSize: 15, fontWeight: '700' },

  previewTomorrow: { borderTopWidth: 1, paddingTop: 16 },
  previewLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  previewContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewIcon: { fontSize: 24 },
  previewCount: { fontSize: 15, fontWeight: '600' },
});
