// constants/config.ts
// Configurações centrais do WordFlow

export const SUPABASE_URL = 'https://iashlxsgjxzlquxliqab.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhc2hseHNnanh6bHF1eGxpcWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MDU1MDUsImV4cCI6MjA3MDE4MTUwNX0.-aBp-OqP_T68ZpmBL_KGWZ-73q9sbACHU3i6E6IjeDc';

// App
export const APP_NAME = 'WordFlow';
export const APP_VERSION = '1.0.0';

// Repetição espaçada — intervalos em dias
export const SPACED_REPETITION = {
  // Ciclo completo (errou de primeira)
  WRONG: {
    RETRY: 1,           // +1 dia até aprender
    CORRECT_1: 1,       // +1 dia consolidação
    CORRECT_2: 3,       // +3 dias
    CORRECT_3: 7,       // +7 dias
    CORRECT_4: 14,      // +14 dias
    CORRECT_5: 30,      // +30 dias → DOMINADA
  },
  // Ciclo curto (acertou de primeira)
  RIGHT_FIRST: {
    CONFIRMATION: 7,    // +7 dias confirmação
    MASTERED: 60,       // +60 dias manutenção
  },
} as const;

// Sessão
export const SESSION = {
  DEFAULT_PHRASES_PER_DAY: 5,
  MAX_PHRASES_PER_DAY: 30,
  LEVEL_UP_IMMEDIATE_THRESHOLD: 0.90,  // 90%
  LEVEL_UP_IMMEDIATE_MIN_PHRASES: 20,
  LEVEL_UP_GRADUAL_THRESHOLD: 0.80,    // 80%
  LEVEL_UP_GRADUAL_DAYS: 7,
} as const;

// Trial
export const TRIAL = {
  DURATION_DAYS: 7,
} as const;

// Horários de push
export const PUSH_SCHEDULES = {
  MORNING: '07:30',
  REMINDER: '12:00',
  EVENING: '20:00',
} as const;

// Levels
export const LEVELS = ['basico', 'intermediario', 'avancado'] as const;
export type Level = (typeof LEVELS)[number];

// Períodos
export const PERIODS = ['manha', 'almoco', 'tarde', 'noite'] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  manha: 'Manhã (8h–11h)',
  almoco: 'Almoço (12h–14h)',
  tarde: 'Tarde (14h–18h)',
  noite: 'Noite (19h–22h)',
};

// Objectives
export const OBJECTIVES = [
  { key: 'trabalho', label: 'Trabalho', emoji: '💼' },
  { key: 'viagem', label: 'Viagem', emoji: '✈️' },
  { key: 'conversacao', label: 'Conversação', emoji: '💬' },
  { key: 'entrevista', label: 'Entrevista', emoji: '🎯' },
  { key: 'tecnologia', label: 'Tecnologia', emoji: '💻' },
  { key: 'academico', label: 'Acadêmico', emoji: '📚' },
] as const;
