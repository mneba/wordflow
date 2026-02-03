// constants/themes.ts
// Paletas extraídas do design v4 aprovado (dark + light)

export interface ThemePalette {
  // Backgrounds
  bg: string;
  bgCard: string;
  bgRaised: string;

  // Accent colors
  accent: string;
  accentLight: string;
  green: string;
  greenLight: string;
  amber: string;
  amberLight: string;
  rose: string;
  roseLight: string;
  sky: string;
  skyLight: string;

  // Text
  text1: string;
  text2: string;
  text3: string;

  // Borders & Surfaces
  border: string;
  shadow: string;

  // Status bar
  statusBar: 'light' | 'dark';
}

export const darkTheme: ThemePalette = {
  // Backgrounds
  bg: '#0E0E16',
  bgCard: '#151520',
  bgRaised: '#1A1A28',

  // Accent colors
  accent: '#8B7CF7',
  accentLight: 'rgba(139, 124, 247, 0.12)',
  green: '#5EEEA0',
  greenLight: 'rgba(94, 238, 160, 0.12)',
  amber: '#F5C563',
  amberLight: 'rgba(245, 197, 99, 0.12)',
  rose: '#F0718D',
  roseLight: 'rgba(240, 113, 141, 0.12)',
  sky: '#6BB8F0',
  skyLight: 'rgba(107, 184, 240, 0.12)',

  // Text
  text1: '#EDEDF0',
  text2: '#9494A8',
  text3: '#5A5A70',

  // Borders & Surfaces
  border: 'rgba(255, 255, 255, 0.05)',
  shadow: 'transparent',

  // Status bar
  statusBar: 'light',
};

export const lightTheme: ThemePalette = {
  // Backgrounds
  bg: '#F5F5F8',
  bgCard: '#FFFFFF',
  bgRaised: '#EBEBF0',

  // Accent colors
  accent: '#7B6CF0',
  accentLight: 'rgba(123, 108, 240, 0.10)',
  green: '#22C06A',
  greenLight: 'rgba(34, 192, 106, 0.10)',
  amber: '#E5A824',
  amberLight: 'rgba(229, 168, 36, 0.10)',
  rose: '#E85D7A',
  roseLight: 'rgba(232, 93, 122, 0.10)',
  sky: '#4A9FE5',
  skyLight: 'rgba(74, 159, 229, 0.10)',

  // Text
  text1: '#1A1A24',
  text2: '#6E6E82',
  text3: '#A0A0B4',

  // Borders & Surfaces
  border: 'rgba(0, 0, 0, 0.06)',
  shadow: 'rgba(0, 0, 0, 0.04)',

  // Status bar
  statusBar: 'dark',
};

// Notebook tint colors (para cards de cadernos)
export const notebookTints = {
  purple: { bg: 'rgba(139, 124, 247, 0.10)', text: '#8B7CF7' },
  blue: { bg: 'rgba(107, 184, 240, 0.10)', text: '#6BB8F0' },
  green: { bg: 'rgba(94, 238, 160, 0.10)', text: '#5EEEA0' },
  amber: { bg: 'rgba(245, 197, 99, 0.10)', text: '#F5C563' },
  rose: { bg: 'rgba(240, 113, 141, 0.10)', text: '#F0718D' },
  sky: { bg: 'rgba(107, 184, 240, 0.10)', text: '#6BB8F0' },
  teal: { bg: 'rgba(94, 238, 200, 0.10)', text: '#5EEEC8' },
};
