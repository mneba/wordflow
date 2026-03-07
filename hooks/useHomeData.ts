// hooks/useHomeData.ts
// V2 - Inclui progresso de pushes do dia
// Hook para buscar todos os dados da Home

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Caderno, Sessao, FraseEstado } from '@/types';
import { getHorasRestantesDia } from '@/utils/mensagensContextuais';
import type { ContextoUsuario } from '@/utils/mensagensContextuais';

export interface FrasesStats {
  naoViu: number;
  aprendendo: number;
  dominadas: number;
  total: number;
}

export interface DiaHistorico {
  data: string;
  acertos: number;
  erros: number;
  total: number;
  taxa: number;
}

export interface RevisaoAmanha {
  id: string;
  frase?: string;
}

export interface PushDiaStatus {
  total: number;
  enviados: number;
  respondidos: number;
  pendentes: number;
}

export interface HomeData {
  caderno: Caderno | null;
  sessaoAtiva: Sessao | null;
  frasesStats: FrasesStats;
  revisoesHoje: number;
  revisoesAmanha: RevisaoAmanha[];
  historicoMes: DiaHistorico[];
  sessaoConcluidaHoje: Sessao | null;
  pushDia: PushDiaStatus;
  contexto: ContextoUsuario;
  loading: boolean;
  error: string | null;
}

export function useHomeData() {
  const { user } = useAuth();
  const [data, setData] = useState<HomeData>({
    caderno: null,
    sessaoAtiva: null,
    frasesStats: { naoViu: 607, aprendendo: 0, dominadas: 0, total: 607 },
    revisoesHoje: 0,
    revisoesAmanha: [],
    historicoMes: [],
    sessaoConcluidaHoje: null,
    pushDia: { total: 0, enviados: 0, respondidos: 0, pendentes: 0 },
    contexto: {
      temSessaoAtiva: false,
      frasesRestantes: 0,
      revisoesHoje: 0,
      frasesNovas: 0,
      diasConsecutivos: 0,
      streakEmRisco: true,
      horasRestantes: getHorasRestantesDia(),
      diasAusente: 0,
      revisoesAtrasadas: 0,
      sessaoConcluida: false,
      isNovoUsuario: true,
      totalDominadas: 0,
    },
    loading: true,
    error: null,
  });

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;

    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      const hoje = new Date().toISOString().split('T')[0];
      const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const [
        cadernoRes,
        sessaoAtivaRes,
        sessaoConcluidaRes,
        frasesStatsRes,
        revisoesHojeRes,
        revisoesAmanhaRes,
        historicoMesRes,
        pushDiaRes,
      ] = await Promise.all([
        // 1. Caderno ativo
        user.caderno_ativo_id
          ? supabase.from('cadernos').select('*').eq('id', user.caderno_ativo_id).single()
          : Promise.resolve({ data: null }),

        // 2. Sessão ativa
        supabase.from('sessoes').select('*').eq('user_id', user.id).eq('status', 'ativa').maybeSingle(),

        // 3. Sessão concluída hoje
        supabase
          .from('sessoes').select('*').eq('user_id', user.id).eq('status', 'concluida')
          .gte('concluida_em', `${hoje}T00:00:00`).order('concluida_em', { ascending: false })
          .limit(1).maybeSingle(),

        // 4. Frases por estado
        supabase.from('controle_envios').select('estado').eq('user_id', user.id),

        // 5. Revisões hoje
        supabase
          .from('controle_envios').select('id').eq('user_id', user.id)
          .lte('proxima_revisao', hoje).in('estado', ['aprendendo', 'confirmacao']),

        // 6. Revisões amanhã
        supabase
          .from('controle_envios').select('id, frase_id').eq('user_id', user.id)
          .eq('proxima_revisao', amanha).limit(5),

        // 7. Histórico mês
        supabase
          .from('sessoes').select('iniciada_em, acertos, erros, total_frases')
          .eq('user_id', user.id).eq('status', 'concluida')
          .gte('iniciada_em', inicioMes.toISOString()),

        // 8. Pushes do dia
        supabase
          .from('push_agendados')
          .select('id, enviado, controle_envio_id')
          .eq('user_id', user.id)
          .eq('data_referencia', hoje),
      ]);

      // Processar pushes do dia
      const pushesHoje = pushDiaRes.data || [];
      const pushEnviados = pushesHoje.filter((p: any) => p.enviado && !p.erro);
      const controleIds = pushesHoje.map((p: any) => p.controle_envio_id).filter(Boolean);

      let pushRespondidos = 0;
      if (controleIds.length > 0) {
        const { data: respondidosData } = await supabase
          .from('controle_envios')
          .select('id')
          .in('id', controleIds)
          .not('data_resposta', 'is', null);
        pushRespondidos = respondidosData?.length || 0;
      }

      const pushDia: PushDiaStatus = {
        total: pushesHoje.length,
        enviados: pushEnviados.length,
        respondidos: pushRespondidos,
        pendentes: pushEnviados.length - pushRespondidos,
      };

      // Processar stats de frases
      const totalCaderno = cadernoRes.data?.total_frases || 607;
      const statsArray = (frasesStatsRes.data || []) as { estado: string }[];
      const contagem = { nova: 0, aprendendo: 0, confirmacao: 0, dominada: 0, manutencao: 0 };
      statsArray.forEach(s => {
        if (s.estado in contagem) {
          contagem[s.estado as keyof typeof contagem]++;
        }
      });
      const totalVistas = Object.values(contagem).reduce((a, b) => a + b, 0);
      const frasesStats: FrasesStats = {
        naoViu: totalCaderno - totalVistas,
        aprendendo: contagem.aprendendo + contagem.confirmacao,
        dominadas: contagem.dominada + contagem.manutencao,
        total: totalCaderno,
      };

      // Histórico mês
      const historicoMap = new Map<string, DiaHistorico>();
      (historicoMesRes.data || []).forEach((s: any) => {
        const dia = new Date(s.iniciada_em).toISOString().split('T')[0];
        const existing = historicoMap.get(dia);
        if (existing) {
          existing.acertos += s.acertos || 0;
          existing.erros += s.erros || 0;
          existing.total += s.total_frases || 0;
          existing.taxa = existing.acertos + existing.erros > 0
            ? Math.round((existing.acertos / (existing.acertos + existing.erros)) * 100) : 0;
        } else {
          const acertos = s.acertos || 0;
          const erros = s.erros || 0;
          historicoMap.set(dia, {
            data: dia, acertos, erros, total: s.total_frases || 0,
            taxa: acertos + erros > 0 ? Math.round((acertos / (acertos + erros)) * 100) : 0,
          });
        }
      });

      const revisoesHoje = revisoesHojeRes.data?.length || 0;
      const sessaoAtiva = sessaoAtivaRes.data as Sessao | null;
      const sessaoConcluidaHoje = sessaoConcluidaRes.data as Sessao | null;

      let diasAusente = 0;
      if (user.ultima_interacao) {
        const ultimaInteracao = new Date(user.ultima_interacao);
        diasAusente = Math.floor((Date.now() - ultimaInteracao.getTime()) / (1000 * 60 * 60 * 24));
      }

      const contexto: ContextoUsuario = {
        temSessaoAtiva: !!sessaoAtiva,
        frasesRestantes: sessaoAtiva
          ? (sessaoAtiva.total_frases || 0) - (sessaoAtiva.frases_respondidas || 0) : 0,
        revisoesHoje,
        frasesNovas: Math.max(0, (user.frases_por_dia || 5) - revisoesHoje),
        diasConsecutivos: user.dias_consecutivos || 0,
        streakEmRisco: !sessaoConcluidaHoje && (user.dias_consecutivos || 0) > 0,
        horasRestantes: getHorasRestantesDia(),
        diasAusente,
        revisoesAtrasadas: revisoesHoje,
        sessaoConcluida: !!sessaoConcluidaHoje && pushDia.pendentes === 0,
        isNovoUsuario: (user.total_frases_vistas || 0) === 0,
        totalDominadas: frasesStats.dominadas,
      };

      setData({
        caderno: cadernoRes.data as Caderno | null,
        sessaoAtiva,
        frasesStats,
        revisoesHoje,
        revisoesAmanha: (revisoesAmanhaRes.data || []).map((r: any) => ({ id: r.id, frase: r.frase_id })),
        historicoMes: Array.from(historicoMap.values()),
        sessaoConcluidaHoje,
        pushDia,
        contexto,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      console.error('Erro ao buscar dados da home:', err);
      setData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { ...data, refresh: fetchAll };
}
