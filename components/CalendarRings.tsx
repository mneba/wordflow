// components/CalendarRings.tsx
// Calendário com anéis SVG estilo Apple Health
// Verso do FlipCard

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';
import type { DiaHistorico } from '@/hooks/useHomeData';

interface CalendarRingsProps {
  historicoMes: DiaHistorico[];
  diasConsecutivos: number;
  diasAtivos: number;
  mediaAcerto: number;
  onClose: () => void;
}

const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function RingDay({
  dia,
  performance,
  isToday,
  isFuture,
  isEmpty,
  isDark,
  accentColor,
}: {
  dia: number;
  performance: number; // 0-100
  isToday: boolean;
  isFuture: boolean;
  isEmpty: boolean;
  isDark: boolean;
  accentColor: string;
}) {
  const ringSize = 36;
  const radius = 14;
  const circumference = 2 * Math.PI * radius; // ~87.96
  const strokeDash = (performance / 100) * circumference;
  const bgStroke = isDark ? '#2A2A3A' : '#D8D8E0';
  const futureStroke = isDark ? '#1A1A24' : '#E8E8EC';
  const greenStroke = isDark ? '#5EEEA0' : '#22C06A';

  if (isEmpty) {
    return <View style={styles.dayCell} />;
  }

  const numberColor = isFuture
    ? isDark ? '#3A3A4A' : '#C0C0CC'
    : isToday
    ? accentColor
    : performance === 0
    ? isDark ? '#4A4A5A' : '#A0A0B4'
    : isDark ? '#EDEDF0' : '#1A1A24';

  const strokeColor = isToday ? accentColor : greenStroke;

  return (
    <View style={styles.dayCell}>
      <Svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
        {/* Background ring */}
        <Circle
          cx={18}
          cy={18}
          r={radius}
          fill="none"
          stroke={isFuture ? futureStroke : bgStroke}
          strokeWidth={3}
        />
        {/* Performance ring */}
        {!isFuture && performance > 0 && (
          <Circle
            cx={18}
            cy={18}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={3}
            strokeDasharray={`${strokeDash} ${circumference}`}
            strokeLinecap="round"
            rotation={-90}
            origin={`${18}, ${18}`}
          />
        )}
      </Svg>
      <Text
        style={[
          styles.dayNumber,
          { color: numberColor, fontWeight: isToday ? '800' : '600' },
        ]}
      >
        {dia}
      </Text>
    </View>
  );
}

function LegendaRing({ performance, isDark }: { performance: number; isDark: boolean }) {
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (performance / 100) * circumference;
  const bgStroke = isDark ? '#2A2A3A' : '#D8D8E0';
  const greenStroke = isDark ? '#5EEEA0' : '#22C06A';

  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={radius} fill="none" stroke={bgStroke} strokeWidth={3} />
      {performance > 0 && (
        <Circle
          cx={10}
          cy={10}
          r={radius}
          fill="none"
          stroke={greenStroke}
          strokeWidth={3}
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
          rotation={-90}
          origin="10, 10"
        />
      )}
    </Svg>
  );
}

export default function CalendarRings({
  historicoMes,
  diasConsecutivos,
  diasAtivos,
  mediaAcerto,
  onClose,
}: CalendarRingsProps) {
  const { colors, isDark } = useTheme();

  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  const hoje = agora.getDate();

  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  // getDay(): 0=Domingo. Nosso grid começa em Segunda (S=seg).
  // Ajustar: 0(dom)→6, 1(seg)→0, 2(ter)→1, ...
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const offset = primeiroDiaSemana === 0 ? 6 : primeiroDiaSemana - 1;

  // Mapear histórico por dia do mês
  const historicoMap = new Map<number, number>();
  historicoMes.forEach(h => {
    const dia = new Date(h.data).getDate();
    historicoMap.set(dia, h.taxa);
  });

  // Gerar cells do calendário
  const cells: React.ReactNode[] = [];

  // Cells vazias antes do primeiro dia
  for (let i = 0; i < offset; i++) {
    cells.push(
      <RingDay
        key={`empty-${i}`}
        dia={0}
        performance={0}
        isToday={false}
        isFuture={false}
        isEmpty={true}
        isDark={isDark}
        accentColor={colors.accent}
      />
    );
  }

  // Dias do mês
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const performance = historicoMap.get(dia) || 0;
    cells.push(
      <RingDay
        key={`day-${dia}`}
        dia={dia}
        performance={performance}
        isToday={dia === hoje}
        isFuture={dia > hoje}
        isEmpty={false}
        isDark={isDark}
        accentColor={colors.accent}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header com mês e botão fechar */}
      <View style={styles.header}>
        <View style={styles.nav}>
          <Text style={[styles.arrow, { color: colors.text3 }]}>‹</Text>
          <Text style={[styles.month, { color: colors.text1 }]}>
            {MESES[mes]} {ano}
          </Text>
          <Text style={[styles.arrow, { color: colors.text3 }]}>›</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[styles.closeBtn, { color: colors.text3 }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Dias da semana */}
      <View style={styles.weekdays}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[styles.weekday, { color: colors.text3 }]}>
            {d}
          </Text>
        ))}
      </View>

      {/* Grid de dias com anéis */}
      <View style={styles.daysGrid}>{cells}</View>

      {/* Legenda de anéis */}
      <View style={[styles.legenda, { borderTopColor: colors.border }]}>
        <Text style={[styles.legendaLabel, { color: colors.text3 }]}>Menos</Text>
        <View style={styles.legendaRings}>
          <LegendaRing performance={0} isDark={isDark} />
          <LegendaRing performance={30} isDark={isDark} />
          <LegendaRing performance={65} isDark={isDark} />
          <LegendaRing performance={95} isDark={isDark} />
        </View>
        <Text style={[styles.legendaLabel, { color: colors.text3 }]}>Mais</Text>
      </View>

      {/* Stats do mês */}
      <View style={[styles.stats, { backgroundColor: isDark ? '#0E0E16' : '#F0F0F4' }]}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.amber }]}>
            {diasConsecutivos} 🔥
          </Text>
          <Text style={[styles.statLabel, { color: colors.text3 }]}>Sequência</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.accent }]}>{mediaAcerto}%</Text>
          <Text style={[styles.statLabel, { color: colors.text3 }]}>Média</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.green }]}>{diasAtivos}</Text>
          <Text style={[styles.statLabel, { color: colors.text3 }]}>Dias ativos</Text>
        </View>
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
    marginBottom: 20,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  arrow: {
    fontSize: 18,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  month: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    fontSize: 14,
    padding: 4,
  },
  weekdays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayNumber: {
    position: 'absolute',
    fontSize: 11,
  },
  legenda: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  legendaLabel: {
    fontSize: 10,
  },
  legendaRings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
