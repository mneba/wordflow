// components/StreakPopup.tsx
// Popup temporário de streak — aparece ao entrar, some após 5s
// Aversão à perda: mostra timer quando streak está em risco

import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';

interface StreakPopupProps {
  diasConsecutivos: number;
  streakEmRisco: boolean;
  horasRestantes: number;
  sessaoConcluida: boolean;
}

export default function StreakPopup({
  diasConsecutivos,
  streakEmRisco,
  horasRestantes,
  sessaoConcluida,
}: StreakPopupProps) {
  const { colors, isDark } = useTheme();
  const [visible, setVisible] = useState(true);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Não mostrar se streak = 0
  if (diasConsecutivos <= 0) return null;

  useEffect(() => {
    // Slide down
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 60,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss após 5 segundos
    const timer = setTimeout(() => dismiss(), 5000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  };

  if (!visible) return null;

  const isSafe = sessaoConcluida;
  const borderColor = isSafe
    ? 'rgba(94, 238, 160, 0.3)'
    : 'rgba(245, 197, 99, 0.3)';
  const titleColor = isSafe ? colors.green : colors.amber;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#1A1A28' : '#FFFFFF',
          borderColor,
          transform: [{ translateY }],
          opacity,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
            },
            android: { elevation: 12 },
          }),
        },
      ]}
    >
      <Text style={styles.fireEmoji}>{isSafe ? '✓' : '🔥'}</Text>

      <View style={styles.content}>
        <Text style={[styles.title, { color: titleColor }]}>
          {isSafe
            ? `${diasConsecutivos} dias! Streak mantido ✓`
            : `${diasConsecutivos} dias seguidos!`}
        </Text>
        <Text style={[styles.subtitle, { color: colors.text2 }]}>
          {isSafe
            ? 'Você está no caminho certo'
            : 'Pratique para manter sua sequência'}
        </Text>
        {!isSafe && streakEmRisco && horasRestantes <= 12 && (
          <Text style={[styles.timer, { color: colors.rose }]}>
            ⏰ Acaba em {horasRestantes}h
          </Text>
        )}
      </View>

      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={[styles.close, { color: colors.text3 }]}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    paddingHorizontal: 20,
    zIndex: 100,
  },
  fireEmoji: {
    fontSize: 32,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  timer: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  close: {
    fontSize: 18,
    padding: 4,
  },
});
