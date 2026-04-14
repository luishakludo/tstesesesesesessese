import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * API Simples de Status do Order Bump de Planos
 * 
 * Endpoint: GET /api/debug/order-bump-status
 * 
 * SEM PARAMETROS NECESSARIOS - puxa TUDO automaticamente do Supabase
 * 
 * Retorna JSON completo com todos os dados do processo de Order Bump
 */
export async function GET() {
  const supabase = getSupabase()
  const startTime = Date.now()

  // Estrutura de resposta
  const response: {
    meta: {
      titulo: string
      timestamp: string
      tempo_processamento_ms?: number
    }
    resumo: {
      total_bots: number
      total_fluxos: number
      total_planos: number
      total_order_bumps_ativos: number
      total_gateways_configurados: number
      total_pagamentos: number
      status_geral: "ok" | "problemas_encontrados"
    }
    bots: Array<{
      id: string
      nome: string
      username: string | null
      status: string
      token_configurado: boolean
      telegram_bot_id: string | null
      criado_em: string
      fluxos_vinculados: Array<{
        id: string
        nome: string
        status: string
        config: Record<string, unknown>
        planos: Array<{
          id: string
          nome: string
          preco: number
          descricao: string | null
          ativo: boolean
          posicao: number
        }>
        order_bump: {
          configurado: boolean
          ativo: boolean
          nome: string | null
          preco: number | null
          descricao: string | null
          texto_aceitar: string | null
          texto_recusar: string | null
          config_completa: Record<string, unknown> | null
        }
      }>
      gateway: {
        configurado: boolean
        nome: string | null
        ativo: boolean
        token_presente: boolean
      }
      usuarios_no_fluxo: Array<{
        telegram_user_id: string
        telegram_username: string | null
        status: string
        flow_id: string | null
        plano_selecionado: string | null
        ultima_atualizacao: string
      }>
      pagamentos_recentes: Array<{
        id: string
        telegram_user_id: string
        valor: number
        status: string
        tipo_produto: string | null
        descricao: string | null
        criado_em: string
      }>
    }>
    problemas: Array<{
      bot_id: string
      bot_nome: string
      tipo: string
      descricao: string
      como_resolver: string
    }>
    simulacao_fluxo_completo: {
      descricao: string
      etapas: Array<{
        numero: number
        acao_usuario: string
        resposta_bot: {
          tipo: string
          conteudo: string
          botoes?: Array<{ texto: string; callback: string }>
        }
      }>
    }
  } = {
    meta: {
      titulo: "Status Completo do Order Bump de Planos",
      timestamp: new Date().toISOString()
    },
    resumo: {
      total_bots: 0,
      total_fluxos: 0,
      total_planos: 0,
      total_order_bumps_ativos: 0,
      total_gateways_configurados: 0,
      total_pagamentos: 0,
      status_geral: "ok"
    },
    bots: [],
    problemas: [],
    simulacao_fluxo_completo: {
      descricao: "Simulacao do fluxo completo de selecao de plano com order bump",
      etapas: []
    }
  }

  try {
    // ========== 1. BUSCAR TODOS OS BOTS ==========
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("*")
      .order("created_at", { ascending: false })

    if (botsError) throw new Error(`Erro ao buscar bots: ${botsError.message}`)

    response.resumo.total_bots = bots?.length || 0

    // ========== 2. PARA CADA BOT, BUSCAR TODOS OS DADOS ==========
    for (const bot of (bots || [])) {
      const botData: typeof response.bots[0] = {
        id: bot.id,
        nome: bot.name || "Sem nome",
        username: bot.username,
        status: bot.status || "desconhecido",
        token_configurado: !!bot.token,
        telegram_bot_id: bot.telegram_bot_id,
        criado_em: bot.created_at,
        fluxos_vinculados: [],
        gateway: {
          configurado: false,
          nome: null,
          ativo: false,
          token_presente: false
        },
        usuarios_no_fluxo: [],
        pagamentos_recentes: []
      }

      // 2.1 Buscar fluxos vinculados diretamente
      const { data: fluxosDiretos } = await supabase
        .from("flows")
        .select("*")
        .eq("bot_id", bot.id)

      // 2.2 Buscar fluxos via flow_bots
      const { data: flowBots } = await supabase
        .from("flow_bots")
        .select("flow_id")
        .eq("bot_id", bot.id)

      const flowIdsIndiretos = flowBots?.map(fb => fb.flow_id) || []
      
      let fluxosIndiretos: typeof fluxosDiretos = []
      if (flowIdsIndiretos.length > 0) {
        const { data } = await supabase
          .from("flows")
          .select("*")
          .in("id", flowIdsIndiretos)
        fluxosIndiretos = data || []
      }

      // Combinar fluxos (sem duplicatas)
      const todosFluxos = [...(fluxosDiretos || [])]
      for (const f of fluxosIndiretos) {
        if (!todosFluxos.find(tf => tf.id === f.id)) {
          todosFluxos.push(f)
        }
      }

      response.resumo.total_fluxos += todosFluxos.length

      // 2.3 Para cada fluxo, buscar planos e order bump
      for (const fluxo of todosFluxos) {
        // Buscar planos do banco
        const { data: planosDb } = await supabase
          .from("flow_plans")
          .select("*")
          .eq("flow_id", fluxo.id)
          .order("position", { ascending: true })

        // Planos do config JSON
        const planosConfig = (fluxo.config?.plans as Array<{
          id: string
          name: string
          price: number
          description?: string
        }>) || []

        const planosFinal = (planosDb && planosDb.length > 0) 
          ? planosDb.map(p => ({
              id: p.id,
              nome: p.name,
              preco: p.price,
              descricao: p.description,
              ativo: p.is_active,
              posicao: p.position || 0
            }))
          : planosConfig.map((p, idx) => ({
              id: p.id || `config_${idx}`,
              nome: p.name,
              preco: p.price,
              descricao: p.description || null,
              ativo: true,
              posicao: idx
            }))

        response.resumo.total_planos += planosFinal.length

        // Order Bump
        const obConfig = fluxo.config?.orderBump as Record<string, unknown> | undefined
        const obInicial = (obConfig?.inicial as Record<string, unknown>) || obConfig

        const orderBumpAtivo = obInicial?.enabled === true && Number(obInicial?.price || 0) > 0
        if (orderBumpAtivo) {
          response.resumo.total_order_bumps_ativos++
        }

        const fluxoData: typeof botData.fluxos_vinculados[0] = {
          id: fluxo.id,
          nome: fluxo.name || "Sem nome",
          status: fluxo.status || "desconhecido",
          config: fluxo.config || {},
          planos: planosFinal,
          order_bump: {
            configurado: !!obConfig,
            ativo: orderBumpAtivo,
            nome: (obInicial?.name as string) || null,
            preco: Number(obInicial?.price || 0) || null,
            descricao: (obInicial?.description as string) || null,
            texto_aceitar: (obInicial?.acceptText as string) || "ADICIONAR",
            texto_recusar: (obInicial?.rejectText as string) || "NAO QUERO",
            config_completa: obInicial as Record<string, unknown> || null
          }
        }

        botData.fluxos_vinculados.push(fluxoData)

        // Verificar problemas
        if (planosFinal.length === 0) {
          response.problemas.push({
            bot_id: bot.id,
            bot_nome: bot.name || "Sem nome",
            tipo: "SEM_PLANOS",
            descricao: `Fluxo "${fluxo.name}" nao tem planos configurados`,
            como_resolver: "Va em Fluxos > Editar > Adicionar Planos"
          })
        }

        if (obConfig && !orderBumpAtivo) {
          response.problemas.push({
            bot_id: bot.id,
            bot_nome: bot.name || "Sem nome",
            tipo: "ORDER_BUMP_INATIVO",
            descricao: `Order Bump do fluxo "${fluxo.name}" esta configurado mas inativo`,
            como_resolver: "Ative o Order Bump e defina um preco maior que zero"
          })
        }
      }

      if (todosFluxos.length === 0) {
        response.problemas.push({
          bot_id: bot.id,
          bot_nome: bot.name || "Sem nome",
          tipo: "SEM_FLUXO",
          descricao: "Bot nao tem nenhum fluxo vinculado",
          como_resolver: "Va em Fluxos e vincule um fluxo a este bot"
        })
      }

      // 2.4 Buscar gateway de pagamento
      const { data: gateway } = await supabase
        .from("user_gateways")
        .select("*")
        .eq("bot_id", bot.id)
        .eq("is_active", true)
        .limit(1)
        .single()

      if (gateway) {
        botData.gateway = {
          configurado: true,
          nome: gateway.gateway_name,
          ativo: gateway.is_active,
          token_presente: !!gateway.access_token
        }
        response.resumo.total_gateways_configurados++
      } else {
        response.problemas.push({
          bot_id: bot.id,
          bot_nome: bot.name || "Sem nome",
          tipo: "SEM_GATEWAY",
          descricao: "Bot nao tem gateway de pagamento configurado",
          como_resolver: "Va em Gateways e conecte seu Mercado Pago"
        })
      }

      // 2.5 Buscar usuarios no fluxo
      const { data: usuarios } = await supabase
        .from("user_flow_state")
        .select("*")
        .eq("bot_id", bot.id)
        .order("updated_at", { ascending: false })
        .limit(20)

      botData.usuarios_no_fluxo = (usuarios || []).map(u => ({
        telegram_user_id: u.telegram_user_id,
        telegram_username: u.telegram_username,
        status: u.status,
        flow_id: u.flow_id,
        plano_selecionado: u.selected_plan_id,
        ultima_atualizacao: u.updated_at
      }))

      // 2.6 Buscar pagamentos recentes
      const { data: pagamentos } = await supabase
        .from("payments")
        .select("*")
        .eq("bot_id", bot.id)
        .order("created_at", { ascending: false })
        .limit(10)

      botData.pagamentos_recentes = (pagamentos || []).map(p => ({
        id: p.id,
        telegram_user_id: p.telegram_user_id,
        valor: p.amount,
        status: p.status,
        tipo_produto: p.product_type,
        descricao: p.description,
        criado_em: p.created_at
      }))

      response.resumo.total_pagamentos += pagamentos?.length || 0

      response.bots.push(botData)
    }

    // ========== 3. CRIAR SIMULACAO DO FLUXO ==========
    // Usar dados do primeiro bot/fluxo como exemplo
    const primeiroBot = response.bots[0]
    const primeiroFluxo = primeiroBot?.fluxos_vinculados[0]

    if (primeiroFluxo && primeiroFluxo.planos.length > 0) {
      const planoExemplo = primeiroFluxo.planos[0]
      const obAtivo = primeiroFluxo.order_bump.ativo

      response.simulacao_fluxo_completo.etapas = [
        {
          numero: 1,
          acao_usuario: "Clica em 'Ver Planos'",
          resposta_bot: {
            tipo: "MENSAGEM_COM_BOTOES",
            conteudo: "Escolha seu plano:",
            botoes: primeiroFluxo.planos.map(p => ({
              texto: p.nome,
              callback: `plan_${p.id}`
            }))
          }
        },
        {
          numero: 2,
          acao_usuario: `Seleciona o plano "${planoExemplo.nome}"`,
          resposta_bot: {
            tipo: "CONFIRMACAO",
            conteudo: `Voce selecionou: ${planoExemplo.nome}\nValor: R$ ${planoExemplo.preco.toFixed(2).replace(".", ",")}`
          }
        }
      ]

      if (obAtivo) {
        response.simulacao_fluxo_completo.etapas.push({
          numero: 3,
          acao_usuario: "Visualiza oferta de Order Bump",
          resposta_bot: {
            tipo: "ORDER_BUMP",
            conteudo: primeiroFluxo.order_bump.descricao || 
              `Adicione ${primeiroFluxo.order_bump.nome} por apenas R$ ${primeiroFluxo.order_bump.preco?.toFixed(2).replace(".", ",")}`,
            botoes: [
              { texto: primeiroFluxo.order_bump.texto_aceitar || "ADICIONAR", callback: "ob_accept" },
              { texto: primeiroFluxo.order_bump.texto_recusar || "NAO QUERO", callback: "ob_decline" }
            ]
          }
        })

        response.simulacao_fluxo_completo.etapas.push({
          numero: 4,
          acao_usuario: "Clica em 'ADICIONAR' (aceita Order Bump)",
          resposta_bot: {
            tipo: "CONFIRMACAO_BUMP",
            conteudo: `Adicionado!\n\nResumo do Pedido:\n${planoExemplo.nome}: R$ ${planoExemplo.preco.toFixed(2).replace(".", ",")}\n${primeiroFluxo.order_bump.nome}: R$ ${primeiroFluxo.order_bump.preco?.toFixed(2).replace(".", ",")}\n\nTotal: R$ ${((planoExemplo.preco || 0) + (primeiroFluxo.order_bump.preco || 0)).toFixed(2).replace(".", ",")}`,
            botoes: [
              { texto: `PROSSEGUIR - R$ ${((planoExemplo.preco || 0) + (primeiroFluxo.order_bump.preco || 0)).toFixed(2).replace(".", ",")}`, callback: "proceed_payment" }
            ]
          }
        })
      } else {
        response.simulacao_fluxo_completo.etapas.push({
          numero: 3,
          acao_usuario: "Confirma plano selecionado",
          resposta_bot: {
            tipo: "RESUMO_PEDIDO",
            conteudo: `Resumo do Pedido:\n${planoExemplo.nome}: R$ ${planoExemplo.preco.toFixed(2).replace(".", ",")}`,
            botoes: [
              { texto: `PROSSEGUIR - R$ ${planoExemplo.preco.toFixed(2).replace(".", ",")}`, callback: "proceed_payment" }
            ]
          }
        })
      }

      response.simulacao_fluxo_completo.etapas.push({
        numero: obAtivo ? 5 : 4,
        acao_usuario: "Clica em 'PROSSEGUIR'",
        resposta_bot: {
          tipo: "LINK_PAGAMENTO",
          conteudo: primeiroBot.gateway.configurado 
            ? "Gerando link de pagamento... (gateway configurado)"
            : "ERRO: Gateway de pagamento nao configurado!"
        }
      })
    }

    // Definir status geral
    if (response.problemas.length > 0) {
      response.resumo.status_geral = "problemas_encontrados"
    }

    response.meta.tempo_processamento_ms = Date.now() - startTime

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    return NextResponse.json({
      erro: true,
      mensagem: error instanceof Error ? error.message : "Erro desconhecido",
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
