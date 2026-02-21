// Edge Function: iniciar-sessao-app
// Cria sessão de prática e retorna frases para o app
// Prioridade científica: APRENDENDO > CONFIRMAÇÃO > NOVAS > MANUTENÇÃO
//
// FIX v2: Para frases de revisão, CRIA NOVOS registros em controle_envios
// ao invés de tentar fazer UPDATE nos registros antigos (que já têm sabe preenchido).
// O estado/repeticoes/nivel_aprendizado são copiados do registro mais recente.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FraseParaApp {
  frase_id: string
  frase: string
  traducao: string
  explicacao: string | null
  audio_url: string | null
  estado: string
  ordem: number
}

interface SessaoResponse {
  success: boolean
  sessao_id: string
  tipo: string
  total_frases: number
  frases: FraseParaApp[]
  mensagem_motivacional?: string
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('🚀 iniciar-sessao-app v2 chamada')

  try {
    const { user_id, tipo = 'pratica' } = await req.json()

    if (!user_id) {
      throw new Error('Parâmetro obrigatório: user_id')
    }

    console.log('👤 User ID:', user_id)
    console.log('📋 Tipo sessão:', tipo)

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. VERIFICAR SE HÁ SESSÃO ATIVA NÃO CONCLUÍDA
    const { data: sessaoAtiva, error: errSessaoAtiva } = await supabase
      .from('sessoes')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'ativa')
      .order('iniciada_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sessaoAtiva) {
      console.log('⚠️ Sessão ativa existente:', sessaoAtiva.id)

      // Retornar frases da sessão existente
      const { data: frasesExistentes } = await supabase
        .from('controle_envios')
        .select(`
          id,
          frase_id,
          estado,
          ordem_na_sessao,
          sabe,
          frases!inner(frase, traducao, explicacao, audio_url)
        `)
        .eq('sessao_id', sessaoAtiva.id)
        .order('ordem_na_sessao', { ascending: true })

      // Filtrar apenas frases não respondidas
      const frasesNaoRespondidas = (frasesExistentes || [])
        .filter(f => f.sabe === null)
        .map(f => ({
          frase_id: f.frase_id,
          frase: (f.frases as any).frase,
          traducao: (f.frases as any).traducao,
          explicacao: (f.frases as any).explicacao,
          audio_url: (f.frases as any).audio_url,
          estado: f.estado || 'nova',
          ordem: f.ordem_na_sessao
        }))

      if (frasesNaoRespondidas.length > 0) {
        return new Response(JSON.stringify({
          success: true,
          sessao_id: sessaoAtiva.id,
          tipo: sessaoAtiva.tipo,
          total_frases: sessaoAtiva.total_frases,
          frases_respondidas: sessaoAtiva.frases_respondidas,
          frases: frasesNaoRespondidas,
          retomada: true,
          mensagem_motivacional: 'Você parou na metade! Vamos continuar 💪'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else {
        // Sessão sem frases pendentes, marcar como concluída
        await supabase
          .from('sessoes')
          .update({ status: 'concluida', concluida_em: new Date().toISOString() })
          .eq('id', sessaoAtiva.id)
      }
    }

    // 2. BUSCAR DADOS DO USUÁRIO
    const { data: usuario, error: errUsuario } = await supabase
      .from('users')
      .select('*')
      .eq('id', user_id)
      .single()

    if (errUsuario || !usuario) {
      throw new Error('Usuário não encontrado')
    }

    const nivelUsuario = usuario.nivel || 'basico'
    const frasesPorDia = usuario.frases_por_dia || 5
    console.log('📊 Nível:', nivelUsuario, '| Frases/dia:', frasesPorDia)

    // 3. BUSCAR FRASES COM PRIORIDADE CIENTÍFICA
    const hoje = new Date().toISOString().split('T')[0]

    // Estrutura para guardar frases selecionadas + metadados do registro anterior
    interface FraseSelecionada extends FraseParaApp {
      // Dados do registro anterior (para copiar no novo registro)
      _repeticoes: number
      _nivel_aprendizado: number
      _acertou_primeira: boolean | null
      _is_revisao: boolean
    }

    const frasesParaSessao: FraseSelecionada[] = []
    let ordem = 1

    // 3a. APRENDENDO (errou antes, precisa revisar - MÁXIMA PRIORIDADE)
    const { data: aprendendo } = await supabase
      .from('controle_envios')
      .select(`
        id, frase_id, estado, repeticoes, nivel_aprendizado, acertou_primeira,
        frases!inner(frase, traducao, explicacao, audio_url, nivel)
      `)
      .eq('user_id', user_id)
      .eq('estado', 'aprendendo')
      .lte('proxima_revisao', hoje)
      .not('sabe', 'is', null)
      .order('proxima_revisao', { ascending: true })
      .limit(frasesPorDia)

    if (aprendendo && aprendendo.length > 0) {
      console.log(`📚 ${aprendendo.length} frases APRENDENDO`)
      for (const f of aprendendo) {
        if (frasesParaSessao.length >= frasesPorDia) break
        // Evitar duplicatas
        if (frasesParaSessao.some(fs => fs.frase_id === f.frase_id)) continue
        frasesParaSessao.push({
          frase_id: f.frase_id,
          frase: (f.frases as any).frase,
          traducao: (f.frases as any).traducao,
          explicacao: (f.frases as any).explicacao,
          audio_url: (f.frases as any).audio_url,
          estado: 'aprendendo',
          ordem: ordem++,
          _repeticoes: f.repeticoes || 0,
          _nivel_aprendizado: f.nivel_aprendizado || 1,
          _acertou_primeira: f.acertou_primeira,
          _is_revisao: true,
        })
      }
    }

    // 3b. CONFIRMAÇÃO (acertou na primeira, confirmar - 2ª PRIORIDADE)
    if (frasesParaSessao.length < frasesPorDia) {
      const { data: confirmacao } = await supabase
        .from('controle_envios')
        .select(`
          id, frase_id, estado, repeticoes, nivel_aprendizado, acertou_primeira,
          frases!inner(frase, traducao, explicacao, audio_url, nivel)
        `)
        .eq('user_id', user_id)
        .eq('estado', 'confirmacao')
        .lte('proxima_revisao', hoje)
        .not('sabe', 'is', null)
        .order('proxima_revisao', { ascending: true })
        .limit(frasesPorDia - frasesParaSessao.length)

      if (confirmacao && confirmacao.length > 0) {
        console.log(`✓ ${confirmacao.length} frases CONFIRMAÇÃO`)
        for (const f of confirmacao) {
          if (frasesParaSessao.length >= frasesPorDia) break
          if (frasesParaSessao.some(fs => fs.frase_id === f.frase_id)) continue
          frasesParaSessao.push({
            frase_id: f.frase_id,
            frase: (f.frases as any).frase,
            traducao: (f.frases as any).traducao,
            explicacao: (f.frases as any).explicacao,
            audio_url: (f.frases as any).audio_url,
            estado: 'confirmacao',
            ordem: ordem++,
            _repeticoes: f.repeticoes || 0,
            _nivel_aprendizado: f.nivel_aprendizado || 2,
            _acertou_primeira: f.acertou_primeira,
            _is_revisao: true,
          })
        }
      }
    }

    // 3c. NOVAS (nunca viu - 3ª PRIORIDADE)
    if (frasesParaSessao.length < frasesPorDia) {
      // IDs de frases que o usuário já viu
      const { data: frasesJaVistas } = await supabase
        .from('controle_envios')
        .select('frase_id')
        .eq('user_id', user_id)

      const idsJaVistas = (frasesJaVistas || []).map(f => f.frase_id)

      // Buscar frases novas do nível do usuário
      let queryNovas = supabase
        .from('frases')
        .select('id, frase, traducao, explicacao, audio_url, nivel')
        .eq('nivel', nivelUsuario)
        .eq('status', 'ativa')
        .limit(frasesPorDia - frasesParaSessao.length)

      // Excluir frases já vistas
      if (idsJaVistas.length > 0) {
        queryNovas = queryNovas.not('id', 'in', `(${idsJaVistas.join(',')})`)
      }

      const { data: novas } = await queryNovas

      if (novas && novas.length > 0) {
        console.log(`🆕 ${novas.length} frases NOVAS`)
        const novasEmbaralhadas = novas.sort(() => Math.random() - 0.5)

        for (const f of novasEmbaralhadas) {
          if (frasesParaSessao.length >= frasesPorDia) break
          frasesParaSessao.push({
            frase_id: f.id,
            frase: f.frase,
            traducao: f.traducao,
            explicacao: f.explicacao,
            audio_url: f.audio_url,
            estado: 'nova',
            ordem: ordem++,
            _repeticoes: 0,
            _nivel_aprendizado: 1,
            _acertou_primeira: null,
            _is_revisao: false,
          })
        }
      }
    }

    // 3d. MANUTENÇÃO (dominadas há muito tempo - 4ª PRIORIDADE)
    if (frasesParaSessao.length < frasesPorDia) {
      const { data: manutencao } = await supabase
        .from('controle_envios')
        .select(`
          id, frase_id, estado, repeticoes, nivel_aprendizado, acertou_primeira,
          frases!inner(frase, traducao, explicacao, audio_url, nivel)
        `)
        .eq('user_id', user_id)
        .in('estado', ['dominada', 'manutencao'])
        .lte('proxima_revisao', hoje)
        .not('sabe', 'is', null)
        .order('proxima_revisao', { ascending: true })
        .limit(frasesPorDia - frasesParaSessao.length)

      if (manutencao && manutencao.length > 0) {
        console.log(`🔄 ${manutencao.length} frases MANUTENÇÃO`)
        for (const f of manutencao) {
          if (frasesParaSessao.length >= frasesPorDia) break
          if (frasesParaSessao.some(fs => fs.frase_id === f.frase_id)) continue
          frasesParaSessao.push({
            frase_id: f.frase_id,
            frase: (f.frases as any).frase,
            traducao: (f.frases as any).traducao,
            explicacao: (f.frases as any).explicacao,
            audio_url: (f.frases as any).audio_url,
            estado: f.estado || 'manutencao',
            ordem: ordem++,
            _repeticoes: f.repeticoes || 0,
            _nivel_aprendizado: f.nivel_aprendizado || 4,
            _acertou_primeira: f.acertou_primeira,
            _is_revisao: true,
          })
        }
      }
    }

    // Verificar se temos frases
    if (frasesParaSessao.length === 0) {
      console.log('⚠️ Nenhuma frase disponível')
      return new Response(JSON.stringify({
        success: false,
        error: 'Nenhuma frase disponível para praticar',
        code: 'NO_PHRASES'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    console.log(`✅ Total selecionado: ${frasesParaSessao.length} frases`)

    // 4. CRIAR SESSÃO
    const { data: novaSessao, error: errSessao } = await supabase
      .from('sessoes')
      .insert({
        user_id,
        tipo,
        status: 'ativa',
        total_frases: frasesParaSessao.length,
        frases_respondidas: 0,
        acertos: 0,
        erros: 0,
        iniciada_em: new Date().toISOString()
      })
      .select()
      .single()

    if (errSessao || !novaSessao) {
      console.error('Erro ao criar sessão:', errSessao)
      throw new Error('Falha ao criar sessão')
    }

    console.log('📝 Sessão criada:', novaSessao.id)

    // 5. CRIAR NOVOS REGISTROS EM controle_envios PARA TODAS AS FRASES
    // FIX v2: Sempre cria novos registros (tanto para novas quanto para revisões).
    // Para revisões, copia estado/repeticoes/nivel do registro anterior.
    // Isso garante que cada sessão tem seus próprios registros com sabe=null.
    const registrosEnvio = frasesParaSessao.map(f => ({
      user_id,
      frase_id: f.frase_id,
      sessao_id: novaSessao.id,
      data_envio: new Date().toISOString(),
      tipo_envio: f._is_revisao ? 'revisao' : 'nova',
      estado: f.estado,
      repeticoes: f._repeticoes,
      nivel_aprendizado: f._nivel_aprendizado,
      acertou_primeira: f._acertou_primeira,
      origem: 'sessao',
      ordem_na_sessao: f.ordem,
      total_sessao: frasesParaSessao.length,
      // sabe: null (default) — será preenchido por responder-frase-app
    }))

    const { error: errInsert } = await supabase
      .from('controle_envios')
      .insert(registrosEnvio)

    if (errInsert) {
      console.error('Erro ao inserir controle_envios:', errInsert)
      // Não falhar a sessão inteira por isso, mas logar
    }

    // 6. ATUALIZAR USUÁRIO
    await supabase
      .from('users')
      .update({
        tem_sessao_ativa: true,
        ultima_interacao: new Date().toISOString()
      })
      .eq('id', user_id)

    // 7. MENSAGEM MOTIVACIONAL
    const qtdAprendendo = frasesParaSessao.filter(f => f.estado === 'aprendendo').length
    const qtdConfirmacao = frasesParaSessao.filter(f => f.estado === 'confirmacao').length
    const qtdNovas = frasesParaSessao.filter(f => f.estado === 'nova').length

    let mensagem = ''
    if (qtdAprendendo > 0) {
      mensagem = `${qtdAprendendo} revisão${qtdAprendendo > 1 ? 'ões' : ''} esperando você. Seu cérebro vai agradecer! 🧠`
    } else if (qtdConfirmacao > 0) {
      mensagem = `${qtdConfirmacao} frase${qtdConfirmacao > 1 ? 's' : ''} para confirmar hoje! ✓`
    } else if (qtdNovas > 0) {
      mensagem = `${qtdNovas} frase${qtdNovas > 1 ? 's' : ''} nova${qtdNovas > 1 ? 's' : ''} para você hoje! 🚀`
    } else {
      mensagem = 'Hora de manter o que você já domina afiado! 💪'
    }

    // RESPOSTA FINAL (sem campos internos _prefixados)
    const response: SessaoResponse = {
      success: true,
      sessao_id: novaSessao.id,
      tipo,
      total_frases: frasesParaSessao.length,
      frases: frasesParaSessao.map(f => ({
        frase_id: f.frase_id,
        frase: f.frase,
        traducao: f.traducao,
        explicacao: f.explicacao,
        audio_url: f.audio_url,
        estado: f.estado,
        ordem: f.ordem,
      })),
      mensagem_motivacional: mensagem,
    }

    console.log('✅ Sessão iniciada com sucesso')

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
