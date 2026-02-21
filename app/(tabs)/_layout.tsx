// app/(tabs)/_layout.tsx
// Tab navigator — 4 abas visíveis + praticar (hidden)

import { Tabs } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Text, View, StyleSheet } from 'react-native';

type TabIconProps = {
  emoji: string;
  focused: boolean;
  color: string;
};

function TabIcon({ emoji, focused, color }: TabIconProps) {
  return (
    <View style={styles.tabIcon}>
      <Text style={{ fontSize: focused ? 22 : 20 }}>{emoji}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      {/* index.tsx = tela Home (rota padrão do Expo Router) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="🏠" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progresso',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="📊" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notebooks"
        options={{
          title: 'Cadernos',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="📓" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Config',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon emoji="⚙️" focused={focused} color={color} />
          ),
        }}
      />

      {/* Telas ocultas da tab bar */}
      <Tabs.Screen
        name="praticar"
        options={{
          href: null,          // Não aparece na tab bar
          tabBarStyle: { display: 'none' },  // Esconde a tab bar durante prática
        }}
      />
      {/* Se home.tsx ainda existir no diretório, esconder */}
      <Tabs.Screen
        name="home"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
