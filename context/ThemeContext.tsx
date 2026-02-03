// context/ThemeContext.tsx
// Provider de tema dark/light com persistência e toggle

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, type ThemePalette } from '@/constants/themes';
import type { ThemeMode } from '@/types';

const STORAGE_KEY = '@wordflow_theme';

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemePalette;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  colors: darkTheme,
  toggleTheme: () => {},
  setTheme: () => {},
  isDark: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [loaded, setLoaded] = useState(false);

  // Carregar tema salvo
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setMode(saved);
      }
      setLoaded(true);
    });
  }, []);

  // Persistir mudança
  const setTheme = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setTheme]);

  const colors = mode === 'dark' ? darkTheme : lightTheme;
  const isDark = mode === 'dark';

  // Não renderizar até carregar preferência salva
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
