// types/index.ts
// Tipos centrais do WordFlow — espelham o banco Supabase

// ============================================
// USER
// ============================================
export type UserStatus = 'novo' | 'trial' | 'ativo' | 'pausado' | 'cancelado' | 'inativo';
export type UserLevel = 'basico' | 'intermediario' | 'avancado';
export type UserPeriod = 'manha' | 'almoco' | 'tarde' | 'noite';

export interface User {
  id: string;
  email: string | null;
  nome: string | null;
  whatsapp: string | null;
  whatsapp_confirmado: boolean;
  push_token: string | null;
  nivel: UserLevel;
  objetivos: string[] | null;
  horario_preferido: UserPeriod;
  horarios_proibidos: string[] | null;  // NOVO — períodos bloqueados
  slot_envio: number | null;
  audio_habilitado: boolean;
  status: UserStatus;
  trial_inicio: string | null;
  trial_fim: string | null;
  onboarding_completo: boolean;
  caderno_ativo_id: string | null;
  frases_por_dia: number;
  frases_enviadas_hoje: number;
  total_frases_vistas: number;
  total_frases_corretas: number;
  dias_consecutivos: number;
  tem_sessao_ativa: boolean;
  aceita_envios_automaticos: boolean;
  ultimo_envio: string | null;
  ultima_interacao: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// FRASE
// ============================================
export interface Frase {
  id: string;
  frase: string;
  traducao: string;
  explicacao: string | null;
  nivel: UserLevel | null;
  contexto: string | null;
  tags: string[] | null;
  audio_url: string | null;
  audio_gerado_em: string | null;
  status: string;
  created_at: string;
}

// ============================================
// CADERNO
// ============================================
export type CadernoTipo = 'padrao' | 'tematico' | 'parceiro' | 'pessoal';

export interface Caderno {
  id: string;
  tipo: CadernoTipo;
  nome: string;
  descricao: string | null;
  total_frases: number;
  palavras_unicas_estimadas: number;
  icone: string | null;
  cor: string | null;
  professor_id: string | null;
  preco: number | null;
  comissao_professor: number | null;
  codigo_desconto: string | null;
  status: string;
  created_at: string;
}

// ============================================
// SESSÃO
// ============================================
export type SessaoStatus = 'ativa' | 'concluida' | 'abandonada' | 'expirada';
export type SessaoTipo = 'manha' | 'tarde' | 'noite' | 'sob_demanda' | 'boas_vindas' | 'pratica';

export interface Sessao {
  id: string;
  user_id: string;
  tipo: SessaoTipo;
  status: SessaoStatus;
  total_frases: number;
  frases_respondidas: number;
  frase_atual: number;
  acertos: number;
  erros: number;
  iniciada_em: string;
  concluida_em: string | null;
}

// ============================================
// CONTROLE DE ENVIOS
// ============================================
export type FraseEstado = 'nova' | 'confirmacao' | 'aprendendo' | 'dominada' | 'manutencao';

export interface ControleEnvio {
  id: string;
  user_id: string;
  frase_id: string;
  sessao_id: string | null;
  data_envio: string | null;
  tipo_envio: string | null;
  periodo: string | null;
  sabe: boolean | null;
  data_resposta: string | null;
  proxima_revisao: string | null;
  nivel_aprendizado: number;
  repeticoes: number;
  estado: FraseEstado;
  acertou_primeira: boolean | null;
  origem: string | null;
  ordem_na_sessao: number | null;
  total_sessao: number | null;
  created_at: string;
  // Join
  frases?: Frase;
}

// ============================================
// MÉTRICAS DIÁRIAS
// ============================================
export interface MetricaDiaria {
  id: string;
  user_id: string;
  data: string;
  frases_enviadas: number;
  frases_respondidas: number;
  acertos: number;
  erros: number;
  taxa_acerto: number | null;
  created_at: string;
}

// ============================================
// RESPOSTA DA SESSÃO (API — Edge Functions)
// ============================================
export interface IniciarSessaoResponse {
  success: boolean;
  sessao_id: string;
  tipo: string;
  total_frases: number;
  frases: SessionFrase[];
  mensagem_motivacional?: string;
}

export interface SessionFrase {
  frase_id: string;
  frase: string;
  traducao?: string;
  explicacao?: string | null;
  nivel: string | null;
  estado: FraseEstado;
  ordem: number;
  audio_url: string | null;
}

export interface ResponderFraseResponse {
  success: boolean;
  feedback: {
    mensagem: string;
    tipo: 'acerto' | 'erro' | 'confirmacao';
    emoji: string;
  };
  proxima_revisao: string;
  estado_novo: FraseEstado;
  sessao: {
    frases_respondidas: number;
    total_frases: number;
    acertos: number;
    erros: number;
    concluida: boolean;
  };
  frase_info: {
    traducao: string;
    explicacao: string | null;
  };
}

// ============================================
// ONBOARDING
// ============================================
export interface OnboardingAvaliacao {
  frase_id: string;
  conhece: boolean;
  nivel: UserLevel;
}

export interface ProcessarOnboardingResponse {
  nivel_detectado: UserLevel;
  frases_para_aprender: number;
  frases_dominadas: number;
}

// ============================================
// THEME
// ============================================
export type ThemeMode = 'dark' | 'light';
