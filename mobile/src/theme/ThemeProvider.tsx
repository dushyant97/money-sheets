import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, type ThemeMode, type ThemePalette } from '../../../shared/theme';

const THEME_KEY = 'money-sheets-theme';

type ThemeContextValue = {
  mode: ThemeMode;
  palette: ThemePalette;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    void (async () => {
      const saved = await AsyncStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') setModeState(saved);
    })();
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(THEME_KEY, next);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      palette: themes[mode],
      toggle: () => setMode(mode === 'dark' ? 'light' : 'dark'),
      setMode
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
