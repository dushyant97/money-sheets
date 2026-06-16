export type ThemeMode = 'light' | 'dark';

/**
 * Full color palette consumed by the mobile app. Both themes expose the same
 * keys so screens can switch palettes at runtime without branching.
 */
export type ThemePalette = {
  bg: string;
  bgElevated: string;
  surface: string;
  surface2: string;
  surfaceHover: string;
  border: string;
  borderSoft: string;
  text: string;
  textMuted: string;
  textDim: string;
  income: string;
  expense: string;
  balance: string;
  accent: string;
  accent2: string;
  accentText: string;
  accentSoft: string;
  accentGlow: string;
  incomeSoft: string;
  expenseSoft: string;
  balanceSoft: string;
  danger: string;
  dangerSoft: string;
  warn: string;
  tabInactive: string;
  tabActive: string;
  fab: string;
  /** Qualitative chart palette (pink/blue/yellow…) shared across charts. */
  chart: string[];
};

const dark: ThemePalette = {
  bg: '#0b0e14',
  bgElevated: '#12161f',
  surface: '#161b26',
  surface2: '#1c2230',
  surfaceHover: '#232a3a',
  border: '#242b3a',
  borderSoft: '#1d2331',
  text: '#f4f6fb',
  textMuted: '#98a2b6',
  textDim: '#5f6878',
  income: '#34e29b',
  expense: '#ff7a59',
  balance: '#5b9dff',
  accent: '#7c77ff',
  accent2: '#9d7bff',
  accentText: '#c9c6ff',
  accentSoft: 'rgba(124, 119, 255, 0.16)',
  accentGlow: 'rgba(124, 119, 255, 0.45)',
  incomeSoft: 'rgba(52, 226, 155, 0.12)',
  expenseSoft: 'rgba(255, 122, 89, 0.12)',
  balanceSoft: 'rgba(91, 157, 255, 0.12)',
  danger: '#ff5d6c',
  dangerSoft: 'rgba(255, 93, 108, 0.16)',
  warn: '#ffb020',
  tabInactive: '#6b7280',
  tabActive: '#7c77ff',
  fab: '#7c77ff',
  chart: ['#4f7cff', '#ff5d8f', '#ffb020', '#22c08b', '#9b6bff', '#ff7a45', '#22c3e6', '#f2495c', '#7ed957', '#c44dff']
};

const light: ThemePalette = {
  bg: '#f3f4f7',
  bgElevated: '#ffffff',
  surface: '#ffffff',
  surface2: '#f1f2f6',
  surfaceHover: '#e9ebf1',
  border: '#e7e9ef',
  borderSoft: '#eef0f4',
  text: '#11151d',
  textMuted: '#687083',
  textDim: '#99a0ad',
  income: '#0faa6a',
  expense: '#e85a39',
  balance: '#2f6df0',
  accent: '#5b54ff',
  accent2: '#7c5cff',
  accentText: '#5b54ff',
  accentSoft: 'rgba(91, 84, 255, 0.10)',
  accentGlow: 'rgba(91, 84, 255, 0.28)',
  incomeSoft: 'rgba(15, 170, 106, 0.12)',
  expenseSoft: 'rgba(232, 90, 57, 0.12)',
  balanceSoft: 'rgba(47, 109, 240, 0.12)',
  danger: '#e5484d',
  dangerSoft: 'rgba(229, 72, 77, 0.14)',
  warn: '#d98a00',
  tabInactive: '#8a92a3',
  tabActive: '#5b54ff',
  fab: '#5b54ff',
  chart: ['#4f7cff', '#ff5d8f', '#ffb020', '#22c08b', '#9b6bff', '#ff7a45', '#22c3e6', '#f2495c', '#7ed957', '#c44dff']
};

export const themes: Record<ThemeMode, ThemePalette> = { dark, light };

/**
 * Default dark palette. Kept as a named export for backward compatibility with
 * modules that imported `colors` directly before theming existed.
 */
export const colors = dark;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24
} as const;

export const radius = {
  sm: 9,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999
} as const;
