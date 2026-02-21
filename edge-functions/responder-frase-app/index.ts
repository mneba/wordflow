// Edge Function: responder-frase-app
// Processa resposta do usuário (sei/não sei) e calcula próxima revisão
// Implementa algoritmo de repetição espaçada científico
//
// FIX v2: Busca robusta do registro em controle_envios.
// Agora que iniciar-sessao-app sempre cria novos registros por sessão,
// a busca por sessao_id + frase_id + sabe IS NULL é confiável.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// INTERVALOS DE REPETIÇÃO ESPAÇADA (em dias)
const INTERVALOS = {
  ACERTOU_PRIMEIRA: {
    confirmacao: 1,
    dominada: 7,
    manutencao: [14, 30, 60, 90]
  },
  ERROU: {
    primeira: 1,
    segunda: 2,
    terceira: 3,
    depois: 1
  },
  APRENDENDO_ACERTOU: {
    apos_1_erro: 2,
    apos_2_erros: 3,
    apos_3_erros: 5
  }
}

interface RespostaRequest {
  user_id: string
  sessao_id: string
  frase_id: string
  sabe: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('📝 responder-frase-app v2 chamada')

  try {
    const { user_id, sessao_id, frase_id, sabe }: RespostaRequest = await req.json()

    // Validações
    if (!user_id) throw new Error('Parâmetro obrigatório: user_id')
    if (!sessao_id) throw new Error('Parâmetro obrigatório: sessao_id')
    if (!frase_id) throw new Error('Parâmetro obrigatório: frase_id')
    if (typeof sabe !== 'boolean') throw new Error('Parâmetro obrigatório: sabe (boolean)')

    console.log('👤 User:', user_id)
    console.log('📋 Sessão:', sessao_id)
    console.log('💬 Frase:', frase_id)
    console.log('✅ Sabe:', sabe)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. BUSCAR REGISTRO DA SESSÃO ATUAL (sabe IS NULL = não respondido)
    const { data: controle, error: errControle } = await supabase
      .from('controle_envios')
      .select(`
        *,
        frases!inner(frase, traducao, explicacao)
      `)
      .eq('user_id', user_id)
      .eq('sessao_id', sessao_id)
      .eq('frase_id', frase_id)
      .is('sabe', null)
      .maybeSingle()

    if (errControle) {
      console.error('Erro ao buscar controle:', errControle)
      throw new Error('Erro ao buscar registro')
    }

    if (!controle) {
      // Verificar se já foi respondida nesta sessão
      const { data: jaRespondida } = await supabase
        .from('controle_envios')
        .select('id, sabe')
        .eq('user_id', user_id)
        .eq('sessao_id', sessao_id)
        .eq('frase_id', frase_id)
        .not('sabe', 'is', null)
        .maybeSingle()

      if (jaRespondida) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Frase já foi respondida nesta sessão',
          code: 'ALREADY_ANSWERED'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
      }

      // Registro não existe para esta sessão
      console.error('Registro não encontrado. sessao_id:', sessao_id, 'frase_id:', frase_id)
      throw new Error('Registro não encontrado para esta frase/sessão. Tente iniciar uma nova sessão.')
    }

    const estadoAtual = controle.estado || 'nova'
    const repeticoesAtuais = controle.repeticoes || 0
    const acertouPrimeira = controle.acertou_primeira

    console.log('📊 Estado atual:', estadoAtual)
    console.log('🔄 Repetições:', repeticoesAtuais)

    // 2. CALCULAR NOVO ESTADO E PRÓXIMA REVISÃO
    let estadoNovo: string
    let proximaRevisao: Date
    let repeticoesNovas: number
    let nivelAprendizado: number = controle.nivel_aprendizado || 1

    const hoje = new Date()

    if (sabe) {
      if (estadoAtual === 'nova') {
        estadoNovo = 'confirmacao'
        proximaRevisao = adicionarDias(hoje, INTERVALOS.ACERTOU_PRIMEIRA.confirmacao)
        repeticoesNovas = 1
        nivelAprendizado = 2
      } else if (estadoAtual === 'confirmacao') {
        estadoNovo = 'dominada'
        proximaRevisao = adicionarDias(hoje, INTERVALOS.ACERTOU_PRIMEIRA.dominada)
        repeticoesNovas = repeticoesAtuais + 1
        nivelAprendizado = 3
      } else if (estadoAtual === 'aprendendo') {
        const intervalo = repeticoesAtuais <= 1
          ? INTERVALOS.APRENDENDO_ACERTOU.apos_1_erro
          : repeticoesAtuais <= 2
            ? INTERVALOS.APRENDENDO_ACERTOU.apos_2_erros
            : INTERVALOS.APRENDENDO_ACERTOU.apos_3_erros

        estadoNovo = repeticoesAtuais >= 3 ? 'dominada' : 'aprendendo'
        proximaRevisao = adicionarDias(hoje, intervalo)
        repeticoesNovas = repeticoesAtuais + 1
        nivelAprendizado = Math.min(nivelAprendizado + 1, 4)
      } else if (estadoAtual === 'dominada' || estadoAtual === 'manutencao') {
        const idx = Math.min(repeticoesAtuais - 2, INTERVALOS.ACERTOU_PRIMEIRA.manutencao.length - 1)
        const intervalo = INTERVALOS.ACERTOU_PRIMEIRA.manutencao[Math.max(0, idx)]

        estadoNovo = 'manutencao'
        proximaRevisao = adicionarDias(hoje, intervalo)
        repeticoesNovas = repeticoesAtuais + 1
        nivelAprendizado = 4
      } else {
        estadoNovo = 'confirmacao'
        proximaRevisao = adicionarDias(hoje, 3)
        repeticoesNovas = repeticoesAtuais + 1
      }
    } else {
      if (estadoAtual === 'nova') {
        estadoNovo = 'aprendendo'
        proximaRevisao = adicionarDias(hoje, INTERVALOS.ERROU.primeira)
        repeticoesNovas = 1
        nivelAprendizado = 1
      } else if (estadoAtual === 'confirmacao') {
        estadoNovo = 'aprendendo'
        proximaRevisao = adicionarDias(hoje, INTERVALOS.ERROU.primeira)
        repeticoesNovas = 1
        nivelAprendizado = 1
      } else if (estadoAtual === 'aprendendo') {
        const intervalo = repeticoesAtuais <= 1
          ? INTERVALOS.ERROU.segunda
          : repeticoesAtuais <= 2
            ? INTERVALOS.ERROU.terceira
            : INTERVALOS.ERROU.depois

        estadoNovo = 'aprendendo'
        proximaRevisao = adicionarDias(hoje, intervalo)
        repeticoesNovas = Math.max(1, repeticoesAtuais)
        nivelAprendizado = 1
      } else {
        estadoNovo = 'aprendendo'
        proximaRevisao = adicionarDias(hoje, INTERVALOS.ERROU.primeira)
        repeticoesNovas = 1
        nivelAprendizado = 2
      }
    }

    console.log('📊 Novo estado:', estadoNovo)
    console.log('📅 Próxima revisão:', proximaRevisao.toISOString().split('T')[0])

    // 3. ATUALIZAR controle_envios (registro desta sessão)
    const { error: errUpdate } = await supabase
      .from('controle_envios')
      .update({
        sabe,
        data_resposta: new Date().toISOString(),
        proxima_revisao: proximaRevisao.toISOString().split('T')[0],
        estado: estadoNovo,
        repeticoes: repeticoesNovas,
        nivel_aprendizado: nivelAprendizado,
        acertou_primeira: estadoAtual === 'nova' ? sabe : acertouPrimeira
      })
      .eq('id', controle.id)

    if (errUpdate) {
      console.error('Erro ao atualizar controle:', errUpdate)
      throw new Error('Falha ao registrar resposta')
    }

    // 4. ATUALIZAR SESSÃO
    const { data: sessao, error: errSessao } = await supabase
      .from('sessoes')
      .select('*')
      .eq('id', sessao_id)
      .single()

    if (errSessao || !sessao) {
      throw new Error('Sessão não encontrada')
    }

    const novosFrasesRespondidas = (sessao.frases_respondidas || 0) + 1
    const novosAcertos = (sessao.acertos || 0) + (sabe ? 1 : 0)
    const novosErros = (sessao.erros || 0) + (sabe ? 0 : 1)
    const sessaoConcluida = novosFrasesRespondidas >= sessao.total_frases

    const updateSessao: any = {
      frases_respondidas: novosFrasesRespondidas,
      acertos: novosAcertos,
      erros: novosErros
    }

    if (sessaoConcluida) {
      updateSessao.status = 'concluida'
      updateSessao.concluida_em = new Date().toISOString()
    }

    await supabase
      .from('sessoes')
      .update(updateSessao)
      .eq('id', sessao_id)

    // 5. ATUALIZAR USUÁRIO (incrementar contadores)
    const { data: userData } = await supabase
      .from('users')
      .select('total_frases_vistas, total_frases_corretas')
      .eq('id', user_id)
      .single()

    const updateUser: any = {
      ultima_interacao: new Date().toISOString(),
      total_frases_vistas: ((userData?.total_frases_vistas || 0) + 1),
    }

    if (sabe) {
      updateUser.total_frases_corretas = ((userData?.total_frases_corretas || 0) + 1)
    }

    if (sessaoConcluida) {
      updateUser.tem_sessao_ativa = false
    }

    await supabase
      .from('users')
      .update(updateUser)
      .eq('id', user_id)

    // 6. GERAR FEEDBACK
    const feedback = gerarFeedback(sabe, estadoAtual, estadoNovo)

    // 7. RESPOSTA
    const response = {
      success: true,
      feedback,
      proxima_revisao: proximaRevisao.toISOString().split('T')[0],
      estado_novo: estadoNovo,
      sessao: {
        frases_respondidas: novosFrasesRespondidas,
        total_frases: sessao.total_frases,
        acertos: novosAcertos,
        erros: novosErros,
        concluida: sessaoConcluida
      },
      frase_info: {
        traducao: (controle.frases as any).traducao,
        explicacao: (controle.frases as any).explicacao
      }
    }

    console.log('✅ Resposta processada com sucesso')

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Erro:', error.message)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

// FUNÇÕES AUXILIARES

function adicionarDias(data: Date, dias: number): Date {
  const resultado = new Date(data)
  resultado.setDate(resultado.getDate() + dias)
  return resultado
}

function gerarFeedback(sabe: boolean, estadoAnterior: string, estadoNovo: string) {
  if (sabe) {
    if (estadoAnterior === 'nova') {
      return { mensagem: 'Você já conhece essa! Vamos confirmar amanhã.', tipo: 'acerto' as const, emoji: '✨' }
    } else if (estadoAnterior === 'confirmacao') {
      return { mensagem: 'Confirmado! Essa frase está dominada.', tipo: 'confirmacao' as const, emoji: '🎯' }
    } else if (estadoAnterior === 'aprendendo') {
      return { mensagem: 'Ótimo progresso! Continue assim.', tipo: 'acerto' as const, emoji: '📈' }
    } else {
      return { mensagem: 'Memória afiada! Mantendo o ritmo.', tipo: 'acerto' as const, emoji: '💪' }
    }
  } else {
    if (estadoAnterior === 'nova') {
      return { mensagem: 'Normal não lembrar! Vamos praticar.', tipo: 'erro' as const, emoji: '🧠' }
    } else if (estadoAnterior === 'dominada' || estadoAnterior === 'manutencao') {
      return { mensagem: 'Acontece! Vamos reforçar essa.', tipo: 'erro' as const, emoji: '🔄' }
    } else {
      return { mensagem: 'Tudo bem! Repetição é o segredo.', tipo: 'erro' as const, emoji: '💡' }
    }
  }
}
