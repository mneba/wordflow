// components/FlipCard.tsx
// Flip card com animação de porta giratória
// Frente: AnalyticsCard | Verso: CalendarRings

import { useRef, useState } from 'react';
import { View, StyleSheet, Animated, TouchableWithoutFeedback } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import AnalyticsCard from './AnalyticsCard';
import CalendarRings from './CalendarRings';
import type { FrasesStats, DiaHistorico } from '@/hooks/useHomeData';

interface FlipCardProps {
  cadernoNome: string;
  cadernoIcone: string;
  stats: FrasesStats;
  taxaAcerto: number;
  historicoMes: DiaHistorico[];
  diasConsecutivos: number;
  diasAtivos: number;
  mediaAcerto: number;
}

export default function FlipCard({
  cadernoNome,
  cadernoIcone,
  stats,
  taxaAcerto,
  historicoMes,
  diasConsecutivos,
  diasAtivos,
  mediaAcerto,
}: FlipCardProps) {
  const { colors } = useTheme();
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Animated.spring(flipAnim, {
      toValue: isFlipped ? 0 : 1,
      tension: 50,
      friction: 10,
      useNativeDriver: true,
    }).start();
    setIsFlipped(!isFlipped);
  };

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  const cardStyle = {
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
  };

  return (
    <TouchableWithoutFeedback onPress={toggle}>
      <View style={styles.container}>
        {/* Frente: Analytics */}
        <Animated.View
          style={[
            styles.face,
            styles.card,
            cardStyle,
            {
              transform: [{ perspective: 1000 }, { rotateY: frontRotate }],
              opacity: frontOpacity,
            },
          ]}
          pointerEvents={isFlipped ? 'none' : 'auto'}
        >
          <AnalyticsCard
            cadernoNome={cadernoNome}
            cadernoIcone={cadernoIcone}
            stats={stats}
            taxaAcerto={taxaAcerto}
          />
        </Animated.View>

        {/* Verso: Calendário */}
        <Animated.View
          style={[
            styles.face,
            styles.faceBack,
            styles.card,
            cardStyle,
            {
              transform: [{ perspective: 1000 }, { rotateY: backRotate }],
              opacity: backOpacity,
            },
          ]}
          pointerEvents={isFlipped ? 'auto' : 'none'}
        >
          <CalendarRings
            historicoMes={historicoMes}
            diasConsecutivos={diasConsecutivos}
            diasAtivos={diasAtivos}
            mediaAcerto={mediaAcerto}
            onClose={toggle}
          />
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    minHeight: 340,
  },
  face: {
    width: '100%',
    backfaceVisibility: 'hidden',
  },
  faceBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
});