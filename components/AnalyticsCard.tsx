// components/AnalyticsCard.tsx
// Card de analytics — grid visual de frases + resumo
// Frente do FlipCard

import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import type { FrasesStats } from '@/hooks/useHomeData';

interface AnalyticsCardProps {
  cadernoNome: string;
  cadernoIcone: string;
  stats: FrasesStats;
  taxaAcerto: number;
}

// Cores dos dots por estado
const DOT_COLORS_DARK = {
  nova: '#2A2A3A',
  aprendendo: '#4A5A8A',
  confirmacao: '#6B5CD7',
  dominada: '#8B7CF7',
  manutencao: '#A99DF9',
};

const DOT_COLORS_LIGHT = {
  nova: '#D8D8E0',
  aprendendo: '#7B8BC0',
  confirmacao: '#8B7CF7',
  dominada: '#7B6CF0',
  manutencao: '#9B8DF7',
};

export default function AnalyticsCard({
  cadernoNome,
  cadernoIcone,
  stats,
  taxaAcerto,
}: AnalyticsCardProps) {
  const { colors, isDark } = useTheme();
  const dotColors = isDark ? DOT_COLORS_DARK : DOT_COLORS_LIGHT;

  // Gerar array de dots representando cada frase
  const dots = useMemo(() => {
    const result: string[] = [];

    // Adicionar por estado (dominadas primeiro, depois aprendendo, depois novas)
    const dominadasCount = stats.dominadas;
    const manutencaoCount = Math.floor(dominadasCount * 0.15);
    const aprendendoCount = stats.aprendendo;
    const confirmacaoCount = Math.floor(aprendendoCount * 0.25);

    for (let i = 0; i < dominadasCount - manutencaoCount; i++) result.push('dominada');
    for (let i = 0; i < manutencaoCount; i++) result.push('manutencao');
    for (let i = 0; i < aprendendoCount - confirmacaoCount; i++) result.push('aprendendo');
    for (let i = 0; i < confirmacaoCount; i++) result.push('confirmacao');
    while (result.length < stats.total) result.push('nova');

    // Shufflar levemente as últimas posições para visual mais orgânico
    for (let i = result.length - 1; i > result.length - 60 && i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }, [stats]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>{cadernoIcone}</Text>
          <Text style={[styles.name, { color: colors.text1 }]}>{cadernoNome}</Text>
        </View>
        <Text style={[styles.meta, { color: colors.text3 }]}>{stats.total} frases</Text>
      </View>

      {/* Legenda */}
      <View style={styles.legenda}>
        <View style={styles.legendaItem}>
          <View style={[styles.legendaDot, { backgroundColor: dotColors.nova }]} />
          <Text style={[styles.legendaText, { color: colors.text2 }]}>Não viu</Text>
        </View>
        <View style={styles.legendaItem}>
          <View style={[styles.legendaDot, { backgroundColor: dotColors.aprendendo }]} />
          <Text style={[styles.legendaText, { color: colors.text2 }]}>Aprendendo</Text>
        </View>
        <View style={styles.legendaItem}>
          <View style={[styles.legendaDot, { backgroundColor: dotColors.dominada }]} />
          <Text style={[styles.legendaText, { color: colors.text2 }]}>Dominada</Text>
        </View>
      </View>

      {/* Grid visual */}
      <View style={[styles.gridContainer, { backgroundColor: isDark ? '#0E0E16' : '#F0F0F4' }]}>
        <View style={styles.gridVisual}>
          {dots.map((estado, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: dotColors[estado as keyof typeof dotColors] },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Resumo numérico */}
      <View style={[styles.resumo, { borderTopColor: colors.border }]}>
        <View style={styles.resumoItem}>
          <Text style={[styles.resumoValor, { color: colors.text3 }]}>{stats.naoViu}</Text>
          <Text style={[styles.resumoLabel, { color: colors.text3 }]}>Não viu</Text>
        </View>
        <View style={styles.resumoItem}>
          <Text style={[styles.resumoValor, { color: colors.sky }]}>{stats.aprendendo}</Text>
          <Text style={[styles.resumoLabel, { color: colors.text3 }]}>Aprendendo</Text>
        </View>
        <View style={styles.resumoItem}>
          <Text style={[styles.resumoValor, { color: colors.green }]}>{stats.dominadas}</Text>
          <Text style={[styles.resumoLabel, { color: colors.text3 }]}>Dominadas</Text>
        </View>
        <View style={styles.resumoItem}>
          <Text style={[styles.resumoValor, { color: colors.accent }]}>{taxaAcerto}%</Text>
          <Text style={[styles.resumoLabel, { color: colors.text3 }]}>Acerto</Text>
        </View>
      </View>

      {/* Hint de flip */}
      <View style={styles.flipHint}>
        <Text style={styles.flipHintIcon}>📅</Text>
        <Text style={[styles.flipHintText, { color: colors.text3 }]}>
          Toque para ver calendário
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 24,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
  },
  legenda: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
  },
  legendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendaDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendaText: {
    fontSize: 10,
  },
  gridContainer: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  gridVisual: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  resumo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  resumoItem: {
    flex: 1,
    alignItems: 'center',
  },
  resumoValor: {
    fontSize: 20,
    fontWeight: '800',
  },
  resumoLabel: {
    fontSize: 10,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  flipHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  flipHintIcon: {
    fontSize: 14,
  },
  flipHintText: {
    fontSize: 11,
  },
});
