import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * API Unificada de Status do Order Bump de Planos
 * 
 * Endpoint: GET /api/debug/order-bump-status
 * 
 * Retorna uma resposta JSON consolidada com todo o fluxo de dados e status
 * do processo de "Order Bump de Planos", simulando a interacao do usuario.
 * 
 * Query params opcionais:
 * - bot_id: UUID do bot especifico
 * - flow_id: UUID do fluxo especifico
 * - telegram_user_id: ID do usuario do Telegram
 * - plan_id: UUID do plano selecionado
 * - simulate_action: "ver_planos" | "selecionar_plano" | "adicionar_bump" | "prosseguir"
 * 
 * Resposta: JSON completo com status de cada etapa, configuracoes, erros e dados
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(request.url)
  
  const botId = searchParams.get("bot_id")
  const flowId = searchParams.get("flow_id")
  const telegramUserId = searchParams.get("telegram_user_id")
  const planId = searchParams.get("plan_id")
  const simulateAction = searchParams.get("simulate_action") || "completo"

  // Estrutura de resposta unificada
  const response: {
    meta: {
      titulo: string
      descricao: string
      timestamp: string
      versao: string
      parametros_recebidos: Record<string, string | null>
    }
    resumo: {
      status_geral: "ok" | "erro" | "aviso"
      mensagem: string
      total_etapas: number
      etapas_com_sucesso: number
      etapas_com_erro: number
      pode_processar_pagamento: boolean
    }
    etapas: Array<{
      numero: number
      nome: string
      descricao: string
      status: "sucesso" | "erro" | "aviso" | "pendente"
      dados: Record<string, unknown>
      erro?: string
      sugestao_correcao?: string
    }>
    fluxo_dados: {
      bots_disponiveis: Array<{
        id: string
        nome: string
        username: string | null
        status: string
        url_simulacao: string
      }>
      bot_selecionado: Record<string, unknown> | null
      fluxo_ativo: Record<string, unknown> | null
      planos_configurados: Array<{
        id: string
        nome: string
        preco: number
        descricao: string | null
        ativo: boolean
      }>
      order_bump_config: Record<string, unknown> | null
      gateway_pagamento: Record<string, unknown> | null
      estado_usuario: Record<string, unknown> | null
      pagamentos_recentes: Array<Record<string, unknown>>
    }
    simulacao_interacao: {
      acao_atual: string
      mensagens_bot: Array<{
        ordem: number
        tipo: string
        conteudo: string
        botoes?: Array<{ texto: string; callback: string }>
        imagem?: string | null
      }>
      proxima_acao: string | null
      dados_pagamento?: Record<string, unknown>
    }
    diagnostico: {
      problemas_encontrados: Array<{
        severidade: "critico" | "importante" | "menor"
        local: string
        descricao: string
        como_resolver: string
      }>
      verificacoes_ok: string[]
      tempo_processamento_ms: number
    }
    links_uteis: {
      documentacao: string
      api_logs: string
      api_simulate: string
      api_config: string
    }
  } = {
    meta: {
      titulo: "Status Completo do Order Bump de Planos",
      descricao: "API unificada que retorna todo o fluxo de dados e status do processo de Order Bump, simulando interacao do usuario",
      timestamp: new Date().toISOString(),
      versao: "1.0.0",
      parametros_recebidos: {
        bot_id: botId,
        flow_id: flowId,
        telegram_user_id: telegramUserId,
        plan_id: planId,
        simulate_action: simulateAction
      }
    },
    resumo: {
      status_geral: "ok",
      mensagem: "",
      total_etapas: 0,
      etapas_com_sucesso: 0,
      etapas_com_erro: 0,
      pode_processar_pagamento: false
    },
    etapas: [],
    fluxo_dados: {
      bots_disponiveis: [],
      bot_selecionado: null,
      fluxo_ativo: null,
      planos_configurados: [],
      order_bump_config: null,
      gateway_pagamento: null,
      estado_usuario: null,
      pagamentos_recentes: []
    },
    simulacao_interacao: {
      acao_atual: simulateAction,
      mensagens_bot: [],
      proxima_acao: null
    },
    diagnostico: {
      problemas_encontrados: [],
      verificacoes_ok: [],
      tempo_processamento_ms: 0
    },
    links_uteis: {
      documentacao: "/api/debug/order-bump-status?help=true",
      api_logs: "/api/debug/order-bump-logs",
      api_simulate: "/api/debug/simulate-order-bump",
      api_config: "/api/fluxo/{flowId}/order-bump"
    }
  }

  const startTime = Date.now()

  try {
    // ========== ETAPA 1: Buscar Bots Disponiveis ==========
    const etapa1: typeof response.etapas[0] = {
      numero: 1,
      nome: "Buscar Bots",
      descricao: "Listar todos os bots cadastrados no sistema",
      status: "pendente",
      dados: {}
    }

    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("id, name, username, status, token, telegram_bot_id")
      .order("created_at", { ascending: false })

    if (botsError) {
      etapa1.status = "erro"
      etapa1.erro = botsError.message
      etapa1.sugestao_correcao = "Verifique a conexao com o banco de dados"
      response.diagnostico.problemas_encontrados.push({
        severidade: "critico",
        local: "Tabela bots",
        descricao: `Erro ao buscar bots: ${botsError.message}`,
        como_resolver: "Verifique se a tabela bots existe e as permissoes RLS"
      })
    } else {
      etapa1.status = "sucesso"
      etapa1.dados = { total_bots: bots?.length || 0 }
      response.fluxo_dados.bots_disponiveis = (bots || []).map(bot => ({
        id: bot.id,
        nome: bot.name || "Sem nome",
        username: bot.username,
        status: bot.status || "desconhecido",
        url_simulacao: `/api/debug/order-bump-status?bot_id=${bot.id}`
      }))
      response.diagnostico.verificacoes_ok.push(`${bots?.length || 0} bot(s) encontrado(s)`)
    }

    response.etapas.push(etapa1)

    // ========== ETAPA 2: Identificar Bot Ativo ==========
    let botAtivo: typeof bots[0] | null = null
    const etapa2: typeof response.etapas[0] = {
      numero: 2,
      nome: "Identificar Bot Ativo",
      descricao: "Determinar qual bot sera usado para a operacao",
      status: "pendente",
      dados: {}
    }

    if (botId) {
      botAtivo = bots?.find(b => b.id === botId) || null
      if (botAtivo) {
        etapa2.status = "sucesso"
        etapa2.dados = { bot_id: botAtivo.id, bot_nome: botAtivo.name }
      } else {
        etapa2.status = "erro"
        etapa2.erro = `Bot com ID ${botId} nao encontrado`
        etapa2.sugestao_correcao = "Verifique se o bot_id esta correto"
      }
    } else if (bots && bots.length > 0) {
      botAtivo = bots[0]
      etapa2.status = "aviso"
      etapa2.dados = { bot_id: botAtivo.id, bot_nome: botAtivo.name, motivo: "Usando primeiro bot disponivel" }
      response.diagnostico.problemas_encontrados.push({
        severidade: "menor",
        local: "Parametros",
        descricao: "Nenhum bot_id especificado, usando primeiro disponivel",
        como_resolver: "Passe ?bot_id=UUID para especificar um bot"
      })
    } else {
      etapa2.status = "erro"
      etapa2.erro = "Nenhum bot disponivel no sistema"
      etapa2.sugestao_correcao = "Cadastre um bot em /bots"
    }

    if (botAtivo) {
      response.fluxo_dados.bot_selecionado = {
        id: botAtivo.id,
        nome: botAtivo.name,
        username: botAtivo.username,
        status: botAtivo.status,
        telegram_bot_id: botAtivo.telegram_bot_id,
        token_configurado: !!botAtivo.token
      }
    }

    response.etapas.push(etapa2)

    // ========== ETAPA 3: Buscar Fluxo Vinculado ==========
    let fluxoAtivo: { id: string; name: string; config: Record<string, unknown>; bot_id: string | null; status: string } | null = null
    const etapa3: typeof response.etapas[0] = {
      numero: 3,
      nome: "Buscar Fluxo Vinculado",
      descricao: "Encontrar o fluxo associado ao bot",
      status: "pendente",
      dados: {}
    }

    if (flowId) {
      // Buscar fluxo especifico
      const { data: flow, error: flowError } = await supabase
        .from("flows")
        .select("id, name, config, bot_id, status")
        .eq("id", flowId)
        .single()

      if (flow) {
        fluxoAtivo = flow as typeof fluxoAtivo
        etapa3.status = "sucesso"
        etapa3.dados = { flow_id: flow.id, flow_nome: flow.name, fonte: "parametro flow_id" }
      } else {
        etapa3.status = "erro"
        etapa3.erro = flowError?.message || "Fluxo nao encontrado"
      }
    } else if (botAtivo) {
      // Buscar fluxo direto
      const { data: flowDireto } = await supabase
        .from("flows")
        .select("id, name, config, bot_id, status")
        .eq("bot_id", botAtivo.id)
        .limit(1)
        .single()

      if (flowDireto) {
        fluxoAtivo = flowDireto as typeof fluxoAtivo
        etapa3.status = "sucesso"
        etapa3.dados = { flow_id: flowDireto.id, flow_nome: flowDireto.name, fonte: "vinculo direto (flows.bot_id)" }
      } else {
        // Tentar via flow_bots
        const { data: flowBot } = await supabase
          .from("flow_bots")
          .select("flow_id, flow:flows(id, name, config, bot_id, status)")
          .eq("bot_id", botAtivo.id)
          .limit(1)
          .single()

        if (flowBot?.flow) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fluxoAtivo = flowBot.flow as any
          etapa3.status = "sucesso"
          etapa3.dados = { 
            flow_id: fluxoAtivo?.id, 
            flow_nome: fluxoAtivo?.name, 
            fonte: "vinculo indireto (flow_bots)" 
          }
        } else {
          etapa3.status = "erro"
          etapa3.erro = "Nenhum fluxo vinculado ao bot"
          etapa3.sugestao_correcao = "Vincule um fluxo ao bot em /fluxos"
          response.diagnostico.problemas_encontrados.push({
            severidade: "critico",
            local: "Vinculo Bot-Fluxo",
            descricao: "Bot nao tem nenhum fluxo vinculado",
            como_resolver: "Va em Fluxos > Editar > Vincular Bot"
          })
        }
      }
    }

    if (fluxoAtivo) {
      response.fluxo_dados.fluxo_ativo = {
        id: fluxoAtivo.id,
        nome: fluxoAtivo.name,
        status: fluxoAtivo.status,
        bot_id_direto: fluxoAtivo.bot_id,
        config_keys: Object.keys(fluxoAtivo.config || {})
      }
    }

    response.etapas.push(etapa3)

    // ========== ETAPA 4: Verificar Planos Configurados ==========
    const etapa4: typeof response.etapas[0] = {
      numero: 4,
      nome: "Verificar Planos",
      descricao: "Listar planos disponiveis para selecao",
      status: "pendente",
      dados: {}
    }

    if (fluxoAtivo) {
      // Buscar planos da tabela flow_plans
      const { data: dbPlans } = await supabase
        .from("flow_plans")
        .select("id, name, price, description, is_active, position")
        .eq("flow_id", fluxoAtivo.id)
        .eq("is_active", true)
        .order("position", { ascending: true })

      // Tambem buscar do config
      const configPlans = (fluxoAtivo.config?.plans as Array<{
        id: string
        name: string
        price: number
        description?: string
      }>) || []

      const planosAtivos = dbPlans && dbPlans.length > 0 ? dbPlans : configPlans

      if (planosAtivos.length > 0) {
        etapa4.status = "sucesso"
        etapa4.dados = { 
          total_planos: planosAtivos.length,
          fonte: dbPlans && dbPlans.length > 0 ? "banco de dados (flow_plans)" : "config JSON"
        }
        response.fluxo_dados.planos_configurados = planosAtivos.map(p => ({
          id: p.id,
          nome: p.name,
          preco: p.price,
          descricao: p.description || null,
          ativo: true
        }))
        response.diagnostico.verificacoes_ok.push(`${planosAtivos.length} plano(s) ativo(s)`)
      } else {
        etapa4.status = "erro"
        etapa4.erro = "Nenhum plano configurado"
        etapa4.sugestao_correcao = "Configure planos no fluxo"
        response.diagnostico.problemas_encontrados.push({
          severidade: "critico",
          local: "Configuracao de Planos",
          descricao: "O fluxo nao tem nenhum plano configurado",
          como_resolver: "Va em Fluxos > Editar > Adicionar Planos"
        })
      }
    } else {
      etapa4.status = "erro"
      etapa4.erro = "Nao foi possivel verificar planos sem fluxo ativo"
    }

    response.etapas.push(etapa4)

    // ========== ETAPA 5: Verificar Order Bump ==========
    const etapa5: typeof response.etapas[0] = {
      numero: 5,
      nome: "Verificar Order Bump",
      descricao: "Analisar configuracao do Order Bump",
      status: "pendente",
      dados: {}
    }

    if (fluxoAtivo?.config) {
      const orderBumpConfig = fluxoAtivo.config.orderBump as Record<string, unknown> | undefined
      const orderBumpInicial = (orderBumpConfig?.inicial as Record<string, unknown>) || orderBumpConfig

      if (orderBumpConfig) {
        const enabled = orderBumpInicial?.enabled === true
        const price = Number(orderBumpInicial?.price || 0)
        const name = orderBumpInicial?.name as string | undefined

        response.fluxo_dados.order_bump_config = {
          enabled,
          nome: name || "Nao definido",
          preco: price,
          descricao: orderBumpInicial?.description || "Nao definida",
          texto_aceitar: orderBumpInicial?.acceptText || "ADICIONAR",
          texto_recusar: orderBumpInicial?.rejectText || "NAO QUERO",
          tipo_entrega: orderBumpInicial?.deliveryType || "same",
          config_completa: orderBumpInicial
        }

        if (enabled && price > 0) {
          etapa5.status = "sucesso"
          etapa5.dados = { 
            order_bump_ativo: true, 
            nome: name, 
            preco: price,
            sera_exibido: true
          }
          response.diagnostico.verificacoes_ok.push("Order Bump configurado e ativo")
        } else {
          etapa5.status = "aviso"
          etapa5.dados = { 
            order_bump_ativo: false,
            motivo: !enabled ? "enabled = false" : "preco = 0"
          }
          response.diagnostico.problemas_encontrados.push({
            severidade: "importante",
            local: "Order Bump Config",
            descricao: !enabled ? "Order Bump esta desativado" : "Order Bump com preco zero",
            como_resolver: "Ative o Order Bump e defina um preco > 0"
          })
        }
      } else {
        etapa5.status = "aviso"
        etapa5.erro = "Order Bump nao configurado"
        etapa5.sugestao_correcao = "Configure o Order Bump no fluxo"
      }
    } else {
      etapa5.status = "erro"
      etapa5.erro = "Sem fluxo para verificar Order Bump"
    }

    response.etapas.push(etapa5)

    // ========== ETAPA 6: Verificar Gateway de Pagamento ==========
    const etapa6: typeof response.etapas[0] = {
      numero: 6,
      nome: "Verificar Gateway",
      descricao: "Confirmar gateway de pagamento configurado",
      status: "pendente",
      dados: {}
    }

    if (botAtivo) {
      const { data: gateway } = await supabase
        .from("user_gateways")
        .select("id, gateway_name, access_token, is_active, created_at")
        .eq("bot_id", botAtivo.id)
        .eq("is_active", true)
        .limit(1)
        .single()

      if (gateway?.access_token) {
        etapa6.status = "sucesso"
        etapa6.dados = {
          gateway: gateway.gateway_name,
          ativo: gateway.is_active,
          token_configurado: true
        }
        response.fluxo_dados.gateway_pagamento = {
          id: gateway.id,
          nome: gateway.gateway_name,
          ativo: gateway.is_active,
          token_presente: true,
          configurado_em: gateway.created_at
        }
        response.diagnostico.verificacoes_ok.push(`Gateway ${gateway.gateway_name} configurado`)
      } else {
        etapa6.status = "erro"
        etapa6.erro = "Gateway de pagamento nao configurado"
        etapa6.sugestao_correcao = "Configure um gateway (Mercado Pago) em /gateways"
        response.diagnostico.problemas_encontrados.push({
          severidade: "critico",
          local: "Gateway de Pagamento",
          descricao: "Nenhum gateway de pagamento ativo para este bot",
          como_resolver: "Va em Gateways e conecte seu Mercado Pago"
        })
      }
    } else {
      etapa6.status = "erro"
      etapa6.erro = "Bot nao identificado para buscar gateway"
    }

    response.etapas.push(etapa6)

    // ========== ETAPA 7: Estado do Usuario (se especificado) ==========
    if (telegramUserId && botAtivo) {
      const etapa7: typeof response.etapas[0] = {
        numero: 7,
        nome: "Estado do Usuario",
        descricao: "Verificar estado atual do usuario no fluxo",
        status: "pendente",
        dados: {}
      }

      const { data: userState } = await supabase
        .from("user_flow_state")
        .select("*")
        .eq("telegram_user_id", telegramUserId)
        .eq("bot_id", botAtivo.id)
        .single()

      if (userState) {
        etapa7.status = "sucesso"
        etapa7.dados = {
          status: userState.status,
          flow_id: userState.flow_id,
          ultima_atualizacao: userState.updated_at
        }
        response.fluxo_dados.estado_usuario = userState
      } else {
        etapa7.status = "aviso"
        etapa7.dados = { mensagem: "Usuario sem estado no fluxo" }
      }

      response.etapas.push(etapa7)

      // Buscar pagamentos recentes
      const { data: payments } = await supabase
        .from("payments")
        .select("id, amount, status, product_type, description, created_at")
        .eq("telegram_user_id", telegramUserId)
        .order("created_at", { ascending: false })
        .limit(5)

      if (payments && payments.length > 0) {
        response.fluxo_dados.pagamentos_recentes = payments
      }
    }

    // ========== SIMULACAO DE INTERACAO ==========
    const planoSelecionado = response.fluxo_dados.planos_configurados.find(p => p.id === planId) ||
                            response.fluxo_dados.planos_configurados[0]
    const orderBump = response.fluxo_dados.order_bump_config

    if (simulateAction === "ver_planos" || simulateAction === "completo") {
      response.simulacao_interacao.mensagens_bot.push({
        ordem: 1,
        tipo: "MENSAGEM_COM_BOTOES",
        conteudo: "Escolha seu plano:",
        botoes: response.fluxo_dados.planos_configurados.map(p => ({
          texto: p.nome,
          callback: `plan_${p.id}`
        }))
      })
    }

    if ((simulateAction === "selecionar_plano" || simulateAction === "completo") && planoSelecionado) {
      response.simulacao_interacao.mensagens_bot.push({
        ordem: 2,
        tipo: "CONFIRMACAO_PLANO",
        conteudo: `Voce selecionou: ${planoSelecionado.nome}\nValor: R$ ${planoSelecionado.preco.toFixed(2).replace(".", ",")}`
      })

      // Order Bump aparece aqui
      if (orderBump && (orderBump.enabled as boolean)) {
        response.simulacao_interacao.mensagens_bot.push({
          ordem: 3,
          tipo: "ORDER_BUMP",
          conteudo: (orderBump.descricao as string) || `Deseja adicionar ${orderBump.nome} por apenas R$ ${(orderBump.preco as number)?.toFixed(2).replace(".", ",")}?`,
          botoes: [
            { texto: (orderBump.texto_aceitar as string) || "ADICIONAR", callback: "ob_accept" },
            { texto: (orderBump.texto_recusar as string) || "NAO QUERO", callback: "ob_decline" }
          ]
        })
      }
    }

    if (simulateAction === "adicionar_bump" || simulateAction === "completo") {
      if (orderBump && (orderBump.enabled as boolean)) {
        response.simulacao_interacao.mensagens_bot.push({
          ordem: 4,
          tipo: "CONFIRMACAO_BUMP",
          conteudo: "Adicionado!"
        })
      }
    }

    if (simulateAction === "prosseguir" || simulateAction === "completo") {
      const valorPlano = planoSelecionado?.preco || 0
      const valorBump = (orderBump?.enabled as boolean) ? (orderBump?.preco as number) || 0 : 0
      const valorTotal = valorPlano + valorBump

      response.simulacao_interacao.mensagens_bot.push({
        ordem: 5,
        tipo: "RESUMO_PEDIDO",
        conteudo: `Resumo do Pedido:\n${planoSelecionado?.nome || "Plano"}: R$ ${valorPlano.toFixed(2).replace(".", ",")}${valorBump > 0 ? `\n${orderBump?.nome || "Bump"}: R$ ${valorBump.toFixed(2).replace(".", ",")}` : ""}`,
        botoes: [
          { texto: `PROSSEGUIR - R$ ${valorTotal.toFixed(2).replace(".", ",")}`, callback: "proceed_payment" }
        ]
      })

      // Verificar se pode processar pagamento
      const gatewayOk = etapa6.status === "sucesso"

      if (gatewayOk) {
        response.simulacao_interacao.mensagens_bot.push({
          ordem: 6,
          tipo: "GERANDO_PIX",
          conteudo: `Gerando pagamento PIX no valor de R$ ${valorTotal.toFixed(2).replace(".", ",")}...`
        })
        response.simulacao_interacao.dados_pagamento = {
          valor_plano: valorPlano,
          valor_order_bump: valorBump,
          valor_total: valorTotal,
          gateway: response.fluxo_dados.gateway_pagamento?.nome || "nao configurado",
          status: "simulado"
        }
      } else {
        response.simulacao_interacao.mensagens_bot.push({
          ordem: 6,
          tipo: "ERRO",
          conteudo: "Erro ao processar. Tente novamente."
        })
      }
    }

    response.simulacao_interacao.proxima_acao = 
      simulateAction === "ver_planos" ? "selecionar_plano" :
      simulateAction === "selecionar_plano" ? "adicionar_bump" :
      simulateAction === "adicionar_bump" ? "prosseguir" :
      simulateAction === "prosseguir" ? "aguardando_pagamento" : null

    // ========== CALCULAR RESUMO FINAL ==========
    response.resumo.total_etapas = response.etapas.length
    response.resumo.etapas_com_sucesso = response.etapas.filter(e => e.status === "sucesso").length
    response.resumo.etapas_com_erro = response.etapas.filter(e => e.status === "erro").length
    
    const errosCriticos = response.diagnostico.problemas_encontrados.filter(p => p.severidade === "critico")
    response.resumo.pode_processar_pagamento = errosCriticos.length === 0 && 
      response.fluxo_dados.gateway_pagamento !== null &&
      response.fluxo_dados.planos_configurados.length > 0

    if (response.resumo.etapas_com_erro > 0) {
      response.resumo.status_geral = "erro"
      response.resumo.mensagem = `${response.resumo.etapas_com_erro} etapa(s) com erro. Verifique os diagnosticos.`
    } else if (response.diagnostico.problemas_encontrados.length > 0) {
      response.resumo.status_geral = "aviso"
      response.resumo.mensagem = `Sistema funcionando com ${response.diagnostico.problemas_encontrados.length} aviso(s).`
    } else {
      response.resumo.status_geral = "ok"
      response.resumo.mensagem = "Sistema configurado corretamente. Pronto para processar pagamentos."
    }

    // Tempo de processamento
    response.diagnostico.tempo_processamento_ms = Date.now() - startTime

    return NextResponse.json(response)

  } catch (error) {
    response.resumo.status_geral = "erro"
    response.resumo.mensagem = `Erro interno: ${error instanceof Error ? error.message : "Desconhecido"}`
    response.diagnostico.tempo_processamento_ms = Date.now() - startTime
    
    return NextResponse.json(response, { status: 500 })
  }
}
