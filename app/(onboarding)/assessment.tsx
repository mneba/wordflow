// app/(onboarding)/assessment.tsx
// Tela 2 do Onboarding: Avaliação de nível
// ⚠️ REGRA DE OURO: SEMPRE busca frases do CADERNO PADRÃO (607 frases)
// Independente do caderno escolhido pelo usuário
// Mostra frases mistas (básico + intermediário + avançado)
// Usuário marca as que NÃO conhece

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/services/supabase';
import type { Frase, UserLevel } from '@/types';

interface AssessmentFrase extends Frase {
  conhece: boolean; // true = conheço, false = não conheço
}

export default function AssessmentScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { caderno_id } = useLocalSearchParams<{ caderno_id: string }>();

  const [frases, setFrases] = useState<AssessmentFrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Buscar frases mistas do caderno PADRÃO
  const fetchFrases = useCallback(async (existingIds: string[] = []) => {
    try {
      // Buscar 4 básico + 4 intermediário + 4 avançado = 12 frases
      const levels: { nivel: UserLevel; qty: number }[] = [
        { nivel: 'basico', qty: 4 },
        { nivel: 'intermediario', qty: 4 },
        { nivel: 'avancado', qty: 4 },
      ];

      const allFrases: AssessmentFrase[] = [];

      for (const { nivel, qty } of levels) {
        let query = supabase
          .from('frases')
          .select('*')
          .eq('nivel', nivel)
          .eq('status', 'ativa')
          .limit(qty + 5); // busca extra para filtrar

        // Excluir frases já exibidas
        if (existingIds.length > 0) {
          query = query.not('id', 'in', `(${existingIds.join(',')})`);
        }

        const { data, error } = await query;

        if (error) {
          console.error(`Erro buscando ${nivel}:`, error);
          continue;
        }

        if (data) {
          // Embaralhar e pegar a quantidade certa
          const shuffled = data.sort(() => Math.random() - 0.5).slice(0, qty);
          allFrases.push(
            ...shuffled.map((f) => ({
              ...f,
              conhece: true, // default: conheço
            }))
          );
        }
      }

      // Embaralhar resultado final
      return allFrases.sort(() => Math.random() - 0.5);
    } catch (e) {
      console.error('Erro ao buscar frases:', e);
      return [];
    }
  }, []);

  // Carregar frases iniciais
  useEffect(() => {
    async function init() {
      const initial = await fetchFrases();
      setFrases(initial);
      setLoading(false);
    }
    init();
  }, [fetchFrases]);

  // Carregar mais frases
  const handleLoadMore = async () => {
    setLoadingMore(true);
    const existingIds = frases.map((f) => f.id);
    const more = await fetchFrases(existingIds);
    setFrases((prev) => [...prev, ...more]);
    setLoadingMore(false);
  };

  // Toggle conhece/não conhece
  const toggleFrase = (fraseId: string) => {
    setFrases((prev) =>
      prev.map((f) =>
        f.id === fraseId ? { ...f, conhece: !f.conhece } : f
      )
    );
  };

  // Calcular nível baseado nas respostas
  const calcularNivel = (): UserLevel => {
    const basicas = frases.filter((f) => f.nivel === 'basico');
    const intermediarias = frases.filter((f) => f.nivel === 'intermediario');

    const taxaBasico = basicas.length > 0
      ? basicas.filter((f) => f.conhece).length / basicas.length
      : 0;
    const taxaInter = intermediarias.length > 0
      ? intermediarias.filter((f) => f.conhece).length / intermediarias.length
      : 0;

    // Lógica: básico <80% → básico, básico ≥80% e inter <80% → intermediário, inter ≥80% → avançado
    if (taxaBasico < 0.8) return 'basico';
    if (taxaInter < 0.8) return 'intermediario';
    return 'avancado';
  };

  // Finalizar avaliação
  const handleFinish = () => {
    if (submitting) return;
    setSubmitting(true);

    const nivel = calcularNivel();
    const totalConhece = frases.filter((f) => f.conhece).length;
    const totalNaoConhece = frases.filter((f) => !f.conhece).length;

    router.push({
      pathname: '/(onboarding)/result',
      params: {
        caderno_id: caderno_id || '',
        nivel_detectado: nivel,
        total_frases: String(frases.length),
        total_conhece: String(totalConhece),
        total_nao_conhece: String(totalNaoConhece),
      },
    });
  };

  // Stats
  const totalConhece = frases.filter((f) => f.conhece).length;
  const totalNaoConhece = frases.filter((f) => !f.conhece).length;

  // Nível label helper
  const nivelLabel = (nivel: string | null) => {
    switch (nivel) {
      case 'basico': return 'Básico';
      case 'intermediario': return 'Inter.';
      case 'avancado': return 'Avançado';
      default: return '';
    }
  };

  const nivelColor = (nivel: string | null) => {
    switch (nivel) {
      case 'basico': return colors.green;
      case 'intermediario': return colors.amber;
      case 'avancado': return colors.rose;
      default: return colors.text3;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.step, { color: colors.accent }]}>Passo 2 de 4</Text>
        <Text style={[styles.title, { color: colors.text1 }]}>
          Avaliação de nível
        </Text>
        <Text style={[styles.subtitle, { color: colors.text2 }]}>
          Toque nas frases que você <Text style={{ fontWeight: '700', color: colors.rose }}>NÃO conhece</Text>.
          {'\n'}Seja honesto — isso calibra seu nível.
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.bgRaised }]}>
        <View style={[styles.progressFill, { width: '50%', backgroundColor: colors.accent }]} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statChip, { backgroundColor: colors.greenLight }]}>
          <Text style={[styles.statText, { color: colors.green }]}>
            ✓ {totalConhece} conheço
          </Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: colors.roseLight }]}>
          <Text style={[styles.statText, { color: colors.rose }]}>
            ✗ {totalNaoConhece} não conheço
          </Text>
        </View>
      </View>

      {/* Frases */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.text2 }]}>
            Preparando avaliação...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {frases.map((frase, index) => (
            <TouchableOpacity
              key={frase.id}
              activeOpacity={0.7}
              onPress={() => toggleFrase(frase.id)}
              style={[
                styles.fraseCard,
                {
                  backgroundColor: frase.conhece ? colors.bgCard : colors.roseLight,
                  borderColor: frase.conhece ? colors.border : colors.rose,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={styles.fraseRow}>
                {/* Número */}
                <View
                  style={[
                    styles.fraseNumber,
                    {
                      backgroundColor: frase.conhece
                        ? colors.bgRaised
                        : 'rgba(240, 113, 141, 0.2)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.fraseNumberText,
                      { color: frase.conhece ? colors.text3 : colors.rose },
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>

                {/* Frase */}
                <View style={styles.fraseInfo}>
                  <Text
                    style={[
                      styles.fraseText,
                      {
                        color: frase.conhece ? colors.text1 : colors.rose,
                        textDecorationLine: frase.conhece ? 'none' : 'none',
                      },
                    ]}
                  >
                    {frase.frase}
                  </Text>
                  <Text style={[styles.nivelTag, { color: nivelColor(frase.nivel) }]}>
                    {nivelLabel(frase.nivel)}
                  </Text>
                </View>

                {/* Toggle icon */}
                <View
                  style={[
                    styles.toggleCircle,
                    {
                      backgroundColor: frase.conhece ? colors.greenLight : colors.roseLight,
                      borderColor: frase.conhece ? colors.green : colors.rose,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 14 }}>
                    {frase.conhece ? '✓' : '✗'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* Botão carregar mais */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleLoadMore}
            disabled={loadingMore}
            style={[styles.loadMoreBtn, { borderColor: colors.border }]}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={[styles.loadMoreText, { color: colors.accent }]}>
                + Carregar mais frases
              </Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.hint, { color: colors.text3 }]}>
            Mínimo 10 frases para uma avaliação precisa.{'\n'}
            Quanto mais frases, melhor a calibração.
          </Text>

          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { backgroundColor: colors.bg }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={frases.length < 10 || submitting}
          onPress={handleFinish}
          style={[
            styles.continueBtn,
            {
              backgroundColor:
                frases.length >= 10 ? colors.accent : colors.bgRaised,
              opacity: frases.length >= 10 && !submitting ? 1 : 0.5,
            },
          ]}
        >
          <Text
            style={[
              styles.continueBtnText,
              {
                color: frases.length >= 10 ? '#FFFFFF' : colors.text3,
              },
            ]}
          >
            {submitting ? 'Calculando...' : 'Finalizar avaliação'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 4,
  },
  step: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginHorizontal: 24,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 10,
    marginTop: 14,
    marginBottom: 4,
  },
  statChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },

  // Frase card
  fraseCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  fraseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fraseNumber: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fraseNumberText: {
    fontSize: 13,
    fontWeight: '700',
  },
  fraseInfo: {
    flex: 1,
  },
  fraseText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  nivelTag: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  toggleCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Load more
  loadMoreBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 14,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
    fontSize: 16,
    fontWeight: '700',
  },
});
