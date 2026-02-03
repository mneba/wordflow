// app/(onboarding)/choose-notebook.tsx
// Tela 1 do Onboarding: Escolher caderno de estudo
// Busca cadernos do Supabase e exibe cards visuais

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import type { Caderno } from '@/types';

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (width - 48 - CARD_GAP) / 2; // 2 colunas

// Cores para cada caderno (mapeadas por índice)
const TINTS = [
  { bg: 'rgba(139, 124, 247, 0.12)', text: '#8B7CF7', border: 'rgba(139, 124, 247, 0.25)' },
  { bg: 'rgba(107, 184, 240, 0.12)', text: '#6BB8F0', border: 'rgba(107, 184, 240, 0.25)' },
  { bg: 'rgba(94, 238, 160, 0.12)', text: '#5EEEA0', border: 'rgba(94, 238, 160, 0.25)' },
  { bg: 'rgba(245, 197, 99, 0.12)', text: '#F5C563', border: 'rgba(245, 197, 99, 0.25)' },
  { bg: 'rgba(240, 113, 141, 0.12)', text: '#F0718D', border: 'rgba(240, 113, 141, 0.25)' },
  { bg: 'rgba(94, 238, 200, 0.12)', text: '#5EEEC8', border: 'rgba(94, 238, 200, 0.25)' },
  { bg: 'rgba(200, 160, 245, 0.12)', text: '#C8A0F5', border: 'rgba(200, 160, 245, 0.25)' },
];

export default function ChooseNotebookScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [cadernos, setCadernos] = useState<Caderno[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  // Buscar cadernos do Supabase
  useEffect(() => {
    async function fetchCadernos() {
      try {
        const { data, error } = await supabase
          .from('cadernos')
          .select('*')
          .eq('status', 'ativo')
          .order('tipo', { ascending: true }) // padrão primeiro
          .order('nome', { ascending: true });

        if (error) {
          console.error('Erro ao buscar cadernos:', error);
          return;
        }

        setCadernos(data || []);
      } catch (e) {
        console.error('Erro:', e);
      } finally {
        setLoading(false);
      }
    }

    fetchCadernos();
  }, []);

  const handleContinue = () => {
    if (!selected) return;
    // Passa o caderno escolhido para a próxima tela via params
    router.push({
      pathname: '/(onboarding)/assessment',
      params: { caderno_id: selected },
    });
  };

  const nome = user?.nome?.split(' ')[0] || 'Estudante';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.step, { color: colors.accent }]}>Passo 1 de 4</Text>
        <Text style={[styles.title, { color: colors.text1 }]}>
          Olá, {nome}! 👋
        </Text>
        <Text style={[styles.subtitle, { color: colors.text2 }]}>
          Escolha seu caderno de estudo.{'\n'}
          Você pode trocar depois.
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.bgRaised }]}>
        <View style={[styles.progressFill, { width: '25%', backgroundColor: colors.accent }]} />
      </View>

      {/* Cadernos */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.text2 }]}>
            Carregando cadernos...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Caderno Padrão em destaque */}
          {cadernos.filter(c => c.tipo === 'padrao').map((caderno) => {
            const isSelected = selected === caderno.id;
            return (
              <TouchableOpacity
                key={caderno.id}
                activeOpacity={0.7}
                onPress={() => setSelected(caderno.id)}
                style={[
                  styles.featuredCard,
                  {
                    backgroundColor: isSelected ? colors.accentLight : colors.bgCard,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.featuredRow}>
                  <Text style={styles.featuredIcon}>
                    {caderno.icone || '📚'}
                  </Text>
                  <View style={styles.featuredInfo}>
                    <View style={styles.featuredNameRow}>
                      <Text style={[styles.featuredName, { color: colors.text1 }]}>
                        {caderno.nome}
                      </Text>
                      <View style={[styles.recTag, { backgroundColor: colors.greenLight }]}>
                        <Text style={[styles.recTagText, { color: colors.green }]}>
                          Recomendado
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.featuredDesc, { color: colors.text2 }]} numberOfLines={2}>
                      {caderno.descricao || 'Frases essenciais para o dia a dia'}
                    </Text>
                    <Text style={[styles.featuredCount, { color: colors.text3 }]}>
                      {caderno.total_frases} frases
                    </Text>
                  </View>
                </View>
                {isSelected && (
                  <View style={[styles.checkBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Cadernos Temáticos */}
          <Text style={[styles.sectionTitle, { color: colors.text2 }]}>
            Cadernos temáticos
          </Text>

          <View style={styles.grid}>
            {cadernos.filter(c => c.tipo === 'tematico').map((caderno, index) => {
              const tint = TINTS[index % TINTS.length];
              const isSelected = selected === caderno.id;
              return (
                <TouchableOpacity
                  key={caderno.id}
                  activeOpacity={0.7}
                  onPress={() => setSelected(caderno.id)}
                  style={[
                    styles.card,
                    {
                      backgroundColor: isSelected ? tint.bg : colors.bgCard,
                      borderColor: isSelected ? tint.border : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                      width: CARD_WIDTH,
                    },
                  ]}
                >
                  <Text style={styles.cardIcon}>{caderno.icone || '📓'}</Text>
                  <Text
                    style={[styles.cardName, { color: colors.text1 }]}
                    numberOfLines={2}
                  >
                    {caderno.nome}
                  </Text>
                  <Text style={[styles.cardCount, { color: tint.text }]}>
                    {caderno.total_frases} frases
                  </Text>
                  {isSelected && (
                    <View style={[styles.miniCheck, { backgroundColor: tint.text }]}>
                      <Text style={styles.miniCheckText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Espaço extra no final */}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Botão fixo no bottom */}
      <View style={[styles.bottomBar, { backgroundColor: colors.bg }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={!selected}
          onPress={handleContinue}
          style={[
            styles.continueBtn,
            {
              backgroundColor: selected ? colors.accent : colors.bgRaised,
              opacity: selected ? 1 : 0.5,
            },
          ]}
        >
          <Text
            style={[
              styles.continueBtnText,
              { color: selected ? '#FFFFFF' : colors.text3 },
            ]}
          >
            Continuar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 8,
  },
  step: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },

  // Featured card (padrão)
  featuredCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  featuredRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  featuredIcon: {
    fontSize: 36,
    marginTop: 2,
  },
  featuredInfo: {
    flex: 1,
  },
  featuredNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  featuredName: {
    fontSize: 17,
    fontWeight: '700',
  },
  recTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  featuredDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  featuredCount: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Section
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Grid cards
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  card: {
    borderRadius: 14,
    padding: 14,
    minHeight: 120,
    position: 'relative',
    justifyContent: 'space-between',
  },
  cardIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  cardCount: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  miniCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCheckText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
