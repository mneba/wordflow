// app/(tabs)/index.tsx
// Tela Home - Principal do WordFlow
// Fase 4 - Design v4

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import type { Caderno, Sessao } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = 140;
const CARD_HEIGHT = 180;

export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user, refreshProfile } = useAuth();

  // Estados
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessaoAtiva, setSessaoAtiva] = useState<Sessao | null>(null);
  const [cadernoAtivo, setCadernoAtivo] = useState<Caderno | null>(null);
  const [cadernos, setCadernos] = useState<Caderno[]>([]);
  const [estatisticas, setEstatisticas] = useState({
    frasesHoje: 0,
    taxaAcerto: 0,
    diasConsecutivos: 0,
  });

  // Greeting baseado na hora
  const getGreeting = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const primeiroNome = user?.nome?.split(' ')[0] || 'você';

  // Carregar dados
  const carregarDados = useCallback(async () => {
    if (!user?.id) return;

    try {
      // 1. Verificar sessão ativa
      const { data: sessao } = await supabase
        .from('sessoes')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'ativa')
        .order('iniciada_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      setSessaoAtiva(sessao);

      // 2. Buscar caderno ativo
      if (user.caderno_ativo_id) {
        const { data: caderno } = await supabase
          .from('cadernos')
          .select('*')
          .eq('id', user.caderno_ativo_id)
          .single();

        setCadernoAtivo(caderno);
      }

      // 3. Buscar todos os cadernos
      const { data: todosCadernos } = await supabase
        .from('cadernos')
        .select('*')
        .eq('status', 'ativo')
        .order('tipo', { ascending: true });

      setCadernos(todosCadernos || []);

      // 4. Estatísticas do usuário
      setEstatisticas({
        frasesHoje: user.frases_enviadas_hoje || 0,
        taxaAcerto: user.total_frases_vistas > 0
          ? Math.round((user.total_frases_corretas / user.total_frases_vistas) * 100)
          : 0,
        diasConsecutivos: user.dias_consecutivos || 0,
      });

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    await carregarDados();
    setRefreshing(false);
  };

  // Navegar para prática
  const iniciarPratica = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(tabs)/praticar');
  };

  // Cor do caderno baseado no índice
  const getCadernoColor = (index: number) => {
    const cores = [
      { bg: colors.accentLight, text: colors.accent },
      { bg: colors.skyLight, text: colors.sky },
      { bg: colors.greenLight, text: colors.green },
      { bg: colors.amberLight, text: colors.amber },
      { bg: colors.roseLight, text: colors.rose },
    ];
    return cores[index % cores.length];
  };

  // Loading inicial
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* ========== GREETING ========== */}
        <View style={styles.greetingSection}>
          <Text style={[styles.greeting, { color: colors.text2 }]}>
            {getGreeting()},
          </Text>
          <Text style={[styles.userName, { color: colors.text1 }]}>
            {primeiroNome} 👋
          </Text>
        </View>

        {/* ========== SESSION CARD ========== */}
        <TouchableOpacity
          style={[styles.sessionCard, { backgroundColor: colors.bgCard }]}
          onPress={iniciarPratica}
          activeOpacity={0.8}
        >
          <View style={styles.sessionCardContent}>
            <View style={styles.sessionCardLeft}>
              {sessaoAtiva ? (
                <>
                  <Text style={[styles.sessionTitle, { color: colors.text1 }]}>
                    Continuar sessão
                  </Text>
                  <Text style={[styles.sessionSubtitle, { color: colors.text2 }]}>
                    {sessaoAtiva.frases_respondidas}/{sessaoAtiva.total_frases} frases
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.sessionTitle, { color: colors.text1 }]}>
                    Iniciar prática
                  </Text>
                  <Text style={[styles.sessionSubtitle, { color: colors.text2 }]}>
                    {user?.frases_por_dia || 5} frases esperando você
                  </Text>
                </>
              )}
            </View>

            <View style={[styles.playButton, { backgroundColor: colors.accent }]}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.green }]}>
                {estatisticas.diasConsecutivos}
              </Text>
              <Text style={[styles.statLabel, { color: colors.text3 }]}>
                dias seguidos
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.amber }]}>
                {estatisticas.taxaAcerto}%
              </Text>
              <Text style={[styles.statLabel, { color: colors.text3 }]}>
                taxa de acerto
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.sky }]}>
                {user?.total_frases_vistas || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.text3 }]}>
                frases vistas
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ========== CADERNO ATIVO ========== */}
        {cadernoAtivo && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text1 }]}>
              Seu caderno
            </Text>

            <View style={[styles.activeCadernoCard, { backgroundColor: colors.bgCard }]}>
              <View style={styles.activeCadernoHeader}>
                <Text style={styles.activeCadernoIcon}>
                  {cadernoAtivo.icone || '📚'}
                </Text>
                <View style={styles.activeCadernoInfo}>
                  <Text style={[styles.activeCadernoNome, { color: colors.text1 }]}>
                    {cadernoAtivo.nome}
                  </Text>
                  <Text style={[styles.activeCadernoFrases, { color: colors.text2 }]}>
                    {cadernoAtivo.total_frases} frases
                  </Text>
                </View>
              </View>

              {cadernoAtivo.descricao && (
                <Text
                  style={[styles.activeCadernoDesc, { color: colors.text3 }]}
                  numberOfLines={2}
                >
                  {cadernoAtivo.descricao}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ========== CADERNOS OFICIAIS ========== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text1 }]}>
              Cadernos oficiais
            </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/cadernos')}>
              <Text style={[styles.sectionLink, { color: colors.accent }]}>
                Ver todos
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cadernosRow}
          >
            {cadernos
              .filter(c => c.tipo === 'padrao' || c.tipo === 'tematico')
              .slice(0, 6)
              .map((caderno, index) => {
                const corTint = getCadernoColor(index);
                const isAtivo = caderno.id === user?.caderno_ativo_id;

                return (
                  <TouchableOpacity
                    key={caderno.id}
                    style={[
                      styles.cadernoCard,
                      { backgroundColor: colors.bgCard },
                      isAtivo && { borderColor: colors.accent, borderWidth: 2 },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      // TODO: Navegar para detalhes do caderno
                    }}
                  >
                    <View style={[styles.cadernoIconBg, { backgroundColor: corTint.bg }]}>
                      <Text style={styles.cadernoIcon}>
                        {caderno.icone || '📖'}
                      </Text>
                    </View>

                    <Text
                      style={[styles.cadernoNome, { color: colors.text1 }]}
                      numberOfLines={2}
                    >
                      {caderno.nome}
                    </Text>

                    <Text style={[styles.cadernoMeta, { color: colors.text3 }]}>
                      {caderno.total_frases} frases
                    </Text>

                    {/* Tags */}
                    <View style={styles.cadernoTags}>
                      {caderno.tipo === 'padrao' && (
                        <View style={[styles.tag, { backgroundColor: colors.greenLight }]}>
                          <Text style={[styles.tagText, { color: colors.green }]}>
                            Grátis
                          </Text>
                        </View>
                      )}
                      {isAtivo && (
                        <View style={[styles.tag, { backgroundColor: colors.accentLight }]}>
                          <Text style={[styles.tagText, { color: colors.accent }]}>
                            Ativo
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>
        </View>

        {/* ========== CRIAR COM IA (Placeholder) ========== */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.aiCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // TODO: Implementar criação com IA
            }}
          >
            <Text style={styles.aiIcon}>✦</Text>
            <View style={styles.aiContent}>
              <Text style={[styles.aiTitle, { color: colors.text1 }]}>
                Criar caderno com IA
              </Text>
              <Text style={[styles.aiSubtitle, { color: colors.text3 }]}>
                Em breve
              </Text>
            </View>
            <Text style={[styles.aiArrow, { color: colors.text3 }]}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Espaçamento final */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // Greeting
  greetingSection: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '500',
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 2,
  },

  // Session Card
  sessionCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  sessionCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionCardLeft: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sessionSubtitle: {
    fontSize: 14,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    marginLeft: 3,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Active Caderno
  activeCadernoCard: {
    borderRadius: 16,
    padding: 16,
  },
  activeCadernoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeCadernoIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  activeCadernoInfo: {
    flex: 1,
  },
  activeCadernoNome: {
    fontSize: 16,
    fontWeight: '600',
  },
  activeCadernoFrases: {
    fontSize: 13,
    marginTop: 2,
  },
  activeCadernoDesc: {
    fontSize: 13,
    marginTop: 12,
    lineHeight: 18,
  },

  // Cadernos Row
  cadernosRow: {
    paddingRight: 20,
    gap: 12,
  },
  cadernoCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    padding: 14,
    marginRight: 12,
  },
  cadernoIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cadernoIcon: {
    fontSize: 22,
  },
  cadernoNome: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 4,
  },
  cadernoMeta: {
    fontSize: 12,
  },
  cadernoTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 'auto',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // AI Card
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  aiIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  aiContent: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  aiSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  aiArrow: {
    fontSize: 18,
  },
});