// app/(tabs)/progress.tsx
// Placeholder — Fase 6
import { View, Text } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export default function ProgressScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 32 }}>📊</Text>
      <Text style={{ color: colors.text1, fontSize: 18, fontWeight: '700', marginTop: 8 }}>Progresso</Text>
      <Text style={{ color: colors.text2, fontSize: 14, marginTop: 4 }}>Dashboard — Fase 6</Text>
    </View>
  );
}
