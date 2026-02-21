// app/(tabs)/home.tsx
// Tela Home — implementação completa Fase 4A
// Princípios: Lei do Menor Esforço, Aversão à Perda, Zeigarnik,
// Variabilidade de Recompensa, Identidade, Progressão Visual

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useHomeData } from '@/hooks/useHomeData';
import { getGreeting } from '@/utils/mensagensContextuais';

import StreakPopup from '@/components/StreakPopup';
import SessionCard from '@/components/SessionCard';
import FlipCard from '@/components/FlipCard';

export default function HomeScreen() {
  const { colors, toggleTheme, mode, isDark } = useTheme();
  const { user, signOut, refreshProfile } = useAuth();
  const router = useRouter();

  const {
    caderno,
    sessaoAtiva,
    sessaoConcluidaHoje,
    frasesStats,
    revisoesHoje,
    revisoesAmanha,
    historicoMes,
    contexto,
    loading,
    refresh,
  } = useHomeData();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), refresh()]);
    setRefreshing(false);
  }, [refreshProfile, refresh]);

  // Saudação
  const greeting = getGreeting();
  const nome = user?.nome?.split(' ')[0] || 'Estudante';

  // Taxa de acerto
  const taxaAcerto = useMemo(() => {
    if (!user?.total_frases_vistas) return 0;
    return Math.round(((user.total_frases_corretas || 0) / user.total_frases_vistas) * 100);
  }, [user?.total_frases_vistas, user?.total_frases_corretas]);

  // Dias ativos no mês
  const diasAtivos = historicoMes.length;

  // Média de acerto no mês
  const mediaAcerto = useMemo(() => {
    if (historicoMes.length === 0) return 0;
    const soma = historicoMes.reduce((acc, d) => acc + d.taxa, 0);
    return Math.round(soma / historicoMes.length);
  }, [historicoMes]);

  // Navegação para prática
  const handleIniciarPratica = useCallback(() => {
    router.push('/(tabs)/praticar');
  }, [router]);

  const handleContinuarPratica = useCallback(() => {
    router.push('/(tabs)/praticar');
  }, [router]);

  // ─── Milestone banner ───
  const milestoneMsg = useMemo(() => {
    const dias = user?.dias_consecutivos || 0;
    if (dias === 7) return '🎉 7 dias seguidos! Você é consistente!';
    if (dias === 14) return '🏆 14 dias! Hábito se formando!';
    if (dias === 30) return '🌟 30 dias! Você é imparável!';
    if (dias === 60) return '💎 60 dias! Nível lendário!';
    if (dias === 100) return '🔥 100 DIAS! Você é uma máquina!';
    return null;
  }, [user?.dias_consecutivos]);

  // Loading state
  if (loading && !user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Popup de streak */}
      <StreakPopup
        diasConsecutivos={user?.dias_consecutivos || 0}
        streakEmRisco={contexto.streakEmRisco}
        horasRestantes={contexto.horasRestantes}
        sessaoConcluida={contexto.sessaoConcluida}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* ─── Header ─── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greeting, { color: colors.text2 }]}>
              {greeting.text} {greeting.icon}
            </Text>
            <Text style={[styles.name, { color: colors.text1 }]}>{nome}</Text>
          </View>
          <TouchableOpacity onPress={toggleTheme} style={styles.themeBtn}>
            <Text style={{ fontSize: 24 }}>{mode === 'dark' ? '🌙' : '☀️'}</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Milestone banner ─── */}
        {milestoneMsg && (
          <View style={[styles.milestoneBanner, { backgroundColor: colors.amberLight }]}>
            <Text style={[styles.milestoneText, { color: colors.amber }]}>
              {milestoneMsg}
            </Text>
          </View>
        )}

        {/* ─── Session Card ─── */}
        <SessionCard
          contexto={contexto}
          sessaoAtiva={sessaoAtiva}
          sessaoConcluidaHoje={sessaoConcluidaHoje}
          revisoesAmanha={revisoesAmanha}
          frasesPerDia={user?.frases_por_dia || 5}
          onIniciar={handleIniciarPratica}
          onContinuar={handleContinuarPratica}
        />

        {/* ─── FlipCard: Analytics ↔ Calendário ─── */}
        <FlipCard
          cadernoNome={caderno?.nome || 'Inglês Geral'}
          cadernoIcone={caderno?.icone || '📚'}
          stats={frasesStats}
          taxaAcerto={taxaAcerto}
          historicoMes={historicoMes}
          diasConsecutivos={user?.dias_consecutivos || 0}
          diasAtivos={diasAtivos}
          mediaAcerto={mediaAcerto}
        />

        {/* Spacer para o FlipCard que usa position absolute */}
        <View style={{ height: 400 }} />

        {/* ─── Logout ─── */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={signOut}
          style={[styles.logoutBtn, { borderColor: colors.border }]}
        >
          <Text style={[styles.logoutText, { color: colors.text3 }]}>Sair da conta</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  themeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Milestone
  milestoneBanner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  milestoneText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Logout
  logoutBtn: {
    borderWidth: 1,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
