// app/(tabs)/settings.tsx
// Placeholder — Fase 8
import { View, Text } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export default function SettingsScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 32 }}>⚙️</Text>
      <Text style={{ color: colors.text1, fontSize: 18, fontWeight: '700', marginTop: 8 }}>Configurações</Text>
      <Text style={{ color: colors.text2, fontSize: 14, marginTop: 4 }}>Settings — Fase 8</Text>
    </View>
  );
}
