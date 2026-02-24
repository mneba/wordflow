// app/(tabs)/_layout.tsx
// 4 tabs: Início, Frases, Cadernos, Perfil

import { Tabs } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useNotifications } from '@/hooks/useNotifications';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabsLayout() {
  const { colors } = useTheme();
  useNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 14,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ focused, color }) => (
            <MaterialCommunityIcons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="phrases"
        options={{
          title: 'Frases',
          tabBarIcon: ({ focused, color }) => (
            <MaterialCommunityIcons name={focused ? 'text-box' : 'text-box-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notebooks"
        options={{
          title: 'Cadernos',
          tabBarIcon: ({ focused, color }) => (
            <MaterialCommunityIcons name={focused ? 'book-open-variant' : 'book-open-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused, color }) => (
            <MaterialCommunityIcons name={focused ? 'account-circle' : 'account-circle-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="praticar" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="progress" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
