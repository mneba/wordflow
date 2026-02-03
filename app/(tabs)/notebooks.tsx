// app/(tabs)/notebooks.tsx
// Placeholder — Fase 7
import { View, Text } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export default function NotebooksScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 32 }}>📓</Text>
      <Text style={{ color: colors.text1, fontSize: 18, fontWeight: '700', marginTop: 8 }}>Cadernos</Text>
      <Text style={{ color: colors.text2, fontSize: 14, marginTop: 4 }}>Explorar cadernos — Fase 7</Text>
    </View>
  );
}
