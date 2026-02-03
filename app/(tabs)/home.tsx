// app/(tabs)/home.tsx
// Tela principal — pós-onboarding
// Mostra saudação, caderno ativo, sessão do dia, progresso
// Será expandida na Fase 4 com a sessão de prática real

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import type { Caderno } from '@/types';

export default function HomeScreen() {
  const { colors, toggleTheme, mode } = useTheme();
  const { user, signOut, refreshProfile } = useAuth();

  const [caderno, setCaderno] = useState<Caderno | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Buscar caderno ativo
  useEffect(() => {
    if (!user?.caderno_ativo_id) return;

    async function fetchCaderno() {
      const { data } = await supabase
        .from('cadernos')
        .select('*')
        .eq('id', user!.caderno_ativo_id!)
        .single();

      if (data) setCaderno(data);
    }

    fetchCaderno();
  }, [user?.caderno_ativo_id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  // Saudação baseada na hora
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Bom dia', icon: '☀️' };
    if (hour < 18) return { text: 'Boa tarde', icon: '🌤️' };
    return { text: 'Boa noite', icon: '🌙' };
  };

  const greeting = getGreeting();
  const nome = user?.nome?.split(' ')[0] || 'Estudante';

  // Nível display
  const nivelDisplay = () => {
    switch (user?.nivel) {
      case 'basico': return { label: 'Básico', color: colors.green, emoji: '🌱' };
      case 'intermediario': return { label: 'Intermediário', color: colors.amber, emoji: '⚡' };
      case 'avancado': return { label: 'Avançado', color: colors.rose, emoji: '🚀' };
      default: return { label: 'Não definido', color: colors.text3, emoji: '📚' };
    }
  };

  const nivel = nivelDisplay();

  // Período display
  const periodoDisplay = () => {
    switch (user?.horario_preferido) {
      case 'manha': return 'Manhã';
      case 'almoco': return 'Almoço';
      case 'tarde': return 'Tarde';
      case 'noite': return 'Noite';
      default: return '—';
    }
  };

  // Trial info
  const trialDaysLeft = () => {
    if (!user?.trial_fim) return 0;
    const diff = new Date(user.trial_fim).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      {/* Header */}
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

      {/* Trial banner */}
      {user?.status === 'trial' && (
        <View style={[styles.trialBanner, { backgroundColor: colors.accentLight }]}>
          <Text style={[styles.trialText, { color: colors.accent }]}>
            ✨ Trial · {trialDaysLeft()} dias restantes
          </Text>
        </View>
      )}

      {/* Sessão do dia — placeholder para Fase 4 */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.sessionCard, { backgroundColor: colors.accent }]}
      >
        <View style={styles.sessionTop}>
          <Text style={styles.sessionEmoji}>🎯</Text>
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionTitle}>Sessão do dia</Text>
            <Text style={styles.sessionSubtitle}>
              {user?.frases_por_dia || 5} frases · {periodoDisplay()}
            </Text>
          </View>
        </View>
        <View style={styles.sessionBtn}>
          <Text style={styles.sessionBtnText}>Iniciar prática →</Text>
        </View>
        <Text style={styles.sessionNote}>
          🚀 Implementação na Fase 4
        </Text>
      </TouchableOpacity>

      {/* Caderno ativo */}
      {caderno && (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>{caderno.icone || '📚'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text1 }]}>
                Caderno ativo
              </Text>
              <Text style={[styles.cardValue, { color: colors.accent }]}>
                {caderno.nome}
              </Text>
            </View>
          </View>
          <Text style={[styles.cardDetail, { color: colors.text3 }]}>
            {caderno.total_frases} frases · {caderno.tipo === 'padrao' ? 'Geral' : 'Temático'}
          </Text>
        </View>
      )}

      {/* Progresso rápido */}
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text2 }]}>Seu perfil</Text>

        <View style={styles.profileGrid}>
          <View style={styles.profileItem}>
            <Text style={styles.profileEmoji}>{nivel.emoji}</Text>
            <Text style={[styles.profileLabel, { color: colors.text3 }]}>Nível</Text>
            <Text style={[styles.profileValue, { color: nivel.color }]}>{nivel.label}</Text>
          </View>

          <View style={[styles.profileDivider, { backgroundColor: colors.border }]} />

          <View style={styles.profileItem}>
            <Text style={styles.profileEmoji}>🔥</Text>
            <Text style={[styles.profileLabel, { color: colors.text3 }]}>Sequência</Text>
            <Text style={[styles.profileValue, { color: colors.amber }]}>
              {user?.dias_consecutivos || 0} dias
            </Text>
          </View>

          <View style={[styles.profileDivider, { backgroundColor: colors.border }]} />

          <View style={styles.profileItem}>
            <Text style={styles.profileEmoji}>📊</Text>
            <Text style={[styles.profileLabel, { color: colors.text3 }]}>Praticadas</Text>
            <Text style={[styles.profileValue, { color: colors.sky }]}>
              {user?.total_frases_vistas || 0}
            </Text>
          </View>
        </View>
      </View>

      {/* Status cards */}
      <View style={styles.statusRow}>
        <View style={[styles.miniCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.miniLabel, { color: colors.text3 }]}>Status</Text>
          <Text style={[styles.miniValue, { color: colors.green }]}>
            {user?.status === 'trial' ? '🟢 Trial' : user?.status || '—'}
          </Text>
        </View>
        <View style={[styles.miniCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.miniLabel, { color: colors.text3 }]}>Horário</Text>
          <Text style={[styles.miniValue, { color: colors.text1 }]}>
            {periodoDisplay()}
          </Text>
        </View>
        <View style={[styles.miniCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.miniLabel, { color: colors.text3 }]}>Acerto</Text>
          <Text style={[styles.miniValue, { color: colors.accent }]}>
            {user?.total_frases_vistas
              ? Math.round(
                  ((user.total_frases_corretas || 0) / user.total_frases_vistas) * 100
                )
              : 0}
            %
          </Text>
        </View>
      </View>

      {/* Fases */}
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text2 }]}>Progresso do app</Text>

        <View style={styles.faseRow}>
          <Text style={[styles.faseCheck, { color: colors.green }]}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.faseTitle, { color: colors.text1 }]}>Fase 1 — Fundação</Text>
            <Text style={[styles.faseDesc, { color: colors.text3 }]}>Expo + Supabase + Tema</Text>
          </View>
        </View>

        <View style={styles.faseRow}>
          <Text style={[styles.faseCheck, { color: colors.green }]}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.faseTitle, { color: colors.text1 }]}>Fase 2 — Autenticação</Text>
            <Text style={[styles.faseDesc, { color: colors.text3 }]}>Login e registro</Text>
          </View>
        </View>

        <View style={styles.faseRow}>
          <Text style={[styles.faseCheck, { color: colors.green }]}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.faseTitle, { color: colors.text1 }]}>Fase 3 — Onboarding</Text>
            <Text style={[styles.faseDesc, { color: colors.text3 }]}>Caderno + nível + preferências</Text>
          </View>
        </View>

        <View style={styles.faseRow}>
          <Text style={[styles.faseCheck, { color: colors.amber }]}>🚀</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.faseTitle, { color: colors.accent }]}>Fase 4 — Sessão de prática</Text>
            <Text style={[styles.faseDesc, { color: colors.text3 }]}>Core loop: sei / não sei</Text>
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={signOut}
        style={[styles.logoutBtn, { borderColor: colors.rose }]}
      >
        <Text style={[styles.logoutText, { color: colors.rose }]}>Sair da conta</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greeting: { fontSize: 14 },
  name: { fontSize: 26, fontWeight: '800', marginTop: 2, letterSpacing: -0.5 },
  themeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Trial banner
  trialBanner: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  trialText: { fontSize: 13, fontWeight: '600' },

  // Session card
  sessionCard: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sessionEmoji: { fontSize: 36 },
  sessionInfo: { flex: 1 },
  sessionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  sessionSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  sessionBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  sessionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  sessionNote: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },

  // Card
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: { fontSize: 32 },
  cardTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  cardValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  cardDetail: { fontSize: 12, marginTop: 10 },

  // Section
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },

  // Profile grid
  profileGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  profileItem: { alignItems: 'center', flex: 1 },
  profileEmoji: { fontSize: 22, marginBottom: 6 },
  profileLabel: { fontSize: 11, fontWeight: '500' },
  profileValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  profileDivider: { width: 1, height: 40 },

  // Status row
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  miniCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  miniLabel: { fontSize: 11, fontWeight: '500' },
  miniValue: { fontSize: 14, fontWeight: '700', marginTop: 4 },

  // Fases
  faseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  faseCheck: { fontSize: 18 },
  faseTitle: { fontSize: 14, fontWeight: '600' },
  faseDesc: { fontSize: 12, marginTop: 1 },

  // Logout
  logoutBtn: {
    borderWidth: 1,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: { fontSize: 15, fontWeight: '600' },
});
