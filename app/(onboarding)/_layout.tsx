// app/(onboarding)/_layout.tsx
// Layout simplificado — apenas mini-prática
import { Stack } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function OnboardingLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'fade',
      }}
    />
  );
}