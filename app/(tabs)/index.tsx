// app/(tabs)/index.tsx
// Home — header WordFlow + avatar, sessão, analytics
// Sem toggle de tema (apenas no Perfil)

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useHomeData } from '@/hooks/useHomeData';
import { getGreeting } from '@/utils/mensagensContextuais';

import StreakPopup from '@/components/StreakPopup';
import SessionCard from '@/components/SessionCard';
import FlipCard from '@/components/FlipCard';

const haptic = (style = Haptics.ImpactFeedbackStyle.Medium) => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style);
};

export default function HomeScreen() {
  const { colors } = useTheme();
  const { user, refreshProfile } = useAuth();
  const router = useRouter();

  const {
    caderno, sessaoAtiva, sessaoConcluidaHoje, frasesStats,
    revisoesAmanha, historicoMes, contexto, loading, refresh,
  } = useHomeData();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), refresh()]);
    setRefreshing(false);
  }, [refreshProfile, refresh]);

  const greeting = getGreeting();
  const nome = user?.nome?.split(' ')[0] || 'Estudante';
  const iniciais = (user?.nome || 'U').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();

  const taxaAcerto = useMemo(() => {
    if (!user?.total_frases_vistas) return 0;
    return Math.round(((user.total_frases_corretas || 0) / user.total_frases_vistas) * 100);
  }, [user?.total_frases_vistas, user?.total_frases_corretas]);

  const diasAtivos = historicoMes.length;
  const mediaAcerto = useMemo(() => {
    if (historicoMes.length === 0) return 0;
    return Math.round(historicoMes.reduce((acc, d) => acc + d.taxa, 0) / historicoMes.length);
  }, [historicoMes]);

  const handleIniciarPratica = useCallback(() => { haptic(); router.push('/(tabs)/praticar'); }, [router]);
  const handleContinuarPratica = useCallback(() => { haptic(); router.push('/(tabs)/praticar'); }, [router]);

  const milestoneMsg = useMemo(() => {
    const dias = user?.dias_consecutivos || 0;
    if (dias === 7) return '🎉 7 dias seguidos! Você é consistente!';
    if (dias === 14) return '🏆 14 dias! Hábito se formando!';
    if (dias === 30) return '🌟 30 dias! Você é imparável!';
    if (dias === 60) return '💎 60 dias! Nível lendário!';
    if (dias === 100) return '🔥 100 DIAS! Você é uma máquina!';
    return null;
  }, [user?.dias_consecutivos]);

  if (loading && !user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={styles.topBar}>
          <View style={styles.logoRow}>
            <Text style={[styles.logoIcon, { color: colors.accent }]}>⚡</Text>
            <Text style={[styles.logoText, { color: colors.text1 }]}>WordFlow</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            style={[styles.avatarSmall, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.avatarSmallText}>{iniciais}</Text>
          </TouchableOpacity>
        </View>

        {/* Saudação */}
        <Text style={[styles.greeting, { color: colors.text2 }]}>{greeting.text} {greeting.icon}</Text>
        <Text style={[styles.name, { color: colors.text1 }]}>{nome}</Text>

        {/* Streak */}
        <View style={[styles.streakBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={{ fontSize: 20 }}>🔥</Text>
          <View style={styles.streakInfo}>
            <Text style={[styles.streakValue, { color: colors.text1 }]}>
              {user?.dias_consecutivos || 0} {(user?.dias_consecutivos || 0) === 1 ? 'dia seguido' : 'dias seguidos'}
            </Text>
            <Text style={[styles.streakDesc, { color: colors.text3 }]}>
              Pratique todos os dias para manter sua sequência
            </Text>
          </View>
        </View>

        {milestoneMsg && (
          <View style={[styles.milestoneBanner, { backgroundColor: colors.amberLight }]}>
            <Text style={[styles.milestoneText, { color: colors.amber }]}>{milestoneMsg}</Text>
          </View>
        )}

        <SessionCard
          contexto={contexto} sessaoAtiva={sessaoAtiva} sessaoConcluidaHoje={sessaoConcluidaHoje}
          revisoesAmanha={revisoesAmanha} frasesPerDia={user?.frases_por_dia || 5}
          onIniciar={handleIniciarPratica} onContinuar={handleContinuarPratica}
        />

        <FlipCard
          cadernoNome={caderno?.nome || 'Inglês Geral'} cadernoIcone={caderno?.icone || '📚'}
          stats={frasesStats} taxaAcerto={taxaAcerto} historicoMes={historicoMes}
          diasConsecutivos={user?.dias_consecutivos || 0} diasAtivos={diasAtivos} mediaAcerto={mediaAcerto}
        />

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoIcon: { fontSize: 22 },
  logoText: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarSmallText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  greeting: { fontSize: 14 },
  name: { fontSize: 26, fontWeight: '800', marginTop: 2, marginBottom: 16, letterSpacing: -0.5 },
  streakBar: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, gap: 12, marginBottom: 16 },
  streakInfo: { flex: 1 },
  streakValue: { fontSize: 15, fontWeight: '700' },
  streakDesc: { fontSize: 12, marginTop: 2 },
  milestoneBanner: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, marginBottom: 16 },
  milestoneText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
