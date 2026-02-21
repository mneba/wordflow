// utils/mensagensContextuais.ts
// Mensagens contextuais baseadas em dados reais do usuário
// Princípios: Variabilidade de recompensa, Identidade, Aversão à perda

export interface ContextoUsuario {
  temSessaoAtiva: boolean;
  frasesRestantes: number;
  revisoesHoje: number;
  frasesNovas: number;
  diasConsecutivos: number;
  streakEmRisco: boolean;
  horasRestantes: number;
  diasAusente: number;
  revisoesAtrasadas: number;
  sessaoConcluida: boolean;
  isNovoUsuario: boolean;
  totalDominadas: number;
}

export function getMensagemContextual(ctx: ContextoUsuario): string {
  // Usuário novo
  if (ctx.isNovoUsuario) {
    return 'Sua primeira sessão te espera! Vamos começar? 👋';
  }

  // Sessão pausada
  if (ctx.temSessaoAtiva) {
    return `Você parou na metade! Só mais ${ctx.frasesRestantes} frases 💪`;
  }

  // Streak em risco urgente
  if (ctx.streakEmRisco && ctx.horasRestantes <= 6 && ctx.diasConsecutivos > 2) {
    return `Sua sequência de ${ctx.diasConsecutivos} dias acaba em ${ctx.horasRestantes}h ⏰`;
  }

  // Milestone prestes a acontecer
  const proximoDia = ctx.diasConsecutivos + 1;
  if ([7, 14, 30, 60, 100].includes(proximoDia) && !ctx.sessaoConcluida) {
    return `Amanhã você completa ${proximoDia} dias! Não pare agora 🚀`;
  }

  // Voltando após ausência
  if (ctx.diasAusente > 2) {
    return `Que bom te ver de volta! ${ctx.revisoesAtrasadas} frases precisam de revisão 🔄`;
  }

  // Revisões esperando
  if (ctx.revisoesHoje > 0) {
    const mensagens = [
      `${ctx.revisoesHoje} revisões esperando você. Seu cérebro vai agradecer! 🧠`,
      `${ctx.revisoesHoje} frases querem te rever hoje! 🔄`,
      `Hora de reforçar ${ctx.revisoesHoje} frases que você já conhece 💪`,
    ];
    return mensagens[Math.floor(Math.random() * mensagens.length)];
  }

  // Frases novas disponíveis
  if (ctx.frasesNovas > 0) {
    return `${ctx.frasesNovas} frases novas para você hoje! 🚀`;
  }

  // Defaults variáveis
  const defaults = [
    'Hora de manter o que você domina afiado! 💪',
    '2 minutinhos que fazem diferença. Bora? ⚡',
    'Consistência é o segredo. Vamos lá! 🎯',
    `Você já domina ${ctx.totalDominadas} frases. Bora aumentar? 📈`,
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

export function getMensagemConcluida(acertos: number, erros: number, diasConsecutivos: number): string {
  const taxa = acertos + erros > 0 ? Math.round((acertos / (acertos + erros)) * 100) : 0;

  if (taxa === 100) {
    const perfeitos = [
      'Perfeito! Todas certas hoje! 🌟',
      'Sessão impecável! Você está voando 🚀',
    ];
    return perfeitos[Math.floor(Math.random() * perfeitos.length)];
  }

  if (taxa >= 80) {
    return 'Ótima sessão! Continue assim 💪';
  }

  if (taxa >= 60) {
    return 'Boa prática! As revisões vão reforçar 🧠';
  }

  return 'Cada erro é aprendizado. Amanhã será melhor! 📈';
}

export function getGreeting(): { text: string; icon: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Bom dia', icon: '☀️' };
  if (hour < 18) return { text: 'Boa tarde', icon: '🌤️' };
  return { text: 'Boa noite', icon: '🌙' };
}

export function getHorasRestantesDia(): number {
  const agora = new Date();
  const fimDia = new Date(agora);
  fimDia.setHours(23, 59, 59, 999);
  return Math.max(0, Math.floor((fimDia.getTime() - agora.getTime()) / (1000 * 60 * 60)));
}
