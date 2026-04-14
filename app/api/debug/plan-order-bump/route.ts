import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * =====================================================
 * API: SIMULACAO PESADA - ORDER BUMP DE PLANOS
 * =====================================================
 * 
 * GET /api/debug/plan-order-bump
 * 
 * SEM PARAMETROS! Puxa TUDO do Supabase e simula o fluxo
 * completo como se o usuario estivesse clicando nos botoes.
 * 
 * Retorna JSON com cada etapa da simulacao e o que aconteceu.
 * =====================================================
 */

export async function GET() {
  const supabase = getSupabase()
  const inicio = Date.now()

  const resultado = {
    ok: true,
    timestamp: new Date().toISOString(),
    tempo_execucao_ms: 0,
    
    // Resumo geral
    resumo: {
      total_bots: 0,
      total_fluxos: 0,
      total_planos: 0,
      order_bumps_ativos: 0,
      gateways_configurados: 0,
      total_problemas: 0,
      pode_processar_pagamento: false
    },
    
    // Dados de cada bot
    bots: [] as BotSimulacao[],
    
    // Problemas globais
    problemas_globais: [] as string[]
  }

  try {
    // ========== 1. BUSCAR TODOS OS BOTS ==========
    const { data: bots, error: botsErr } = await supabase
      .from("bots")
      .select("*")
      .order("created_at", { ascending: false })

    if (botsErr) throw new Error(`Erro ao buscar bots: ${botsErr.message}`)
    
    if (!bots || bots.length === 0) {
      resultado.ok = false
      resultado.problemas_globais.push("Nenhum bot cadastrado no sistema")
      return NextResponse.json(resultado)
    }

    resultado.resumo.total_bots = bots.length

    // ========== 2. PROCESSAR CADA BOT ==========
    for (const bot of bots) {
      const botSim: BotSimulacao = {
        bot_id: bot.id,
        bot_nome: bot.name || "Sem nome",
        bot_username: bot.username,
        bot_link: bot.username ? `https://t.me/${bot.username}` : null,
        
        gateway: null,
        fluxo: null,
        planos: [],
        order_bump: null,
        
        simulacao: {
          etapas: [],
          resultado_final: "NAO_INICIADO",
          mensagem_final: ""
        },
        
        problemas: []
      }

      // ========== 3. VERIFICAR GATEWAY ==========
      // IMPORTANTE: O webhook usa user_id (dono do bot), NAO bot_id!
      // Codigo REAL do webhook linha 1164:
      //   .eq("user_id", botDataPack.user_id)
      //   .eq("is_active", true)
      
      // Primeira tentativa: buscar por user_id (como o webhook faz)
      const { data: gwByUser } = await supabase
        .from("user_gateways")
        .select("*")
        .eq("user_id", bot.user_id)
        .eq("is_active", true)
        .limit(1)
        .single()
      
      // Segunda tentativa: buscar por bot_id (algumas partes do codigo usam isso)
      const { data: gwByBot } = await supabase
        .from("user_gateways")
        .select("*")
        .eq("bot_id", bot.id)
        .eq("is_active", true)
        .limit(1)
        .single()
      
      const gw = gwByUser || gwByBot

      if (gw && gw.access_token) {
        botSim.gateway = {
          id: gw.id,
          nome: gw.gateway_name || gw.gateway || "Mercado Pago",
          configurado: true,
          token_presente: true,
          encontrado_por: gwByUser ? "user_id" : "bot_id",
          user_id_usado: bot.user_id,
          bot_id_usado: bot.id,
          codigo_webhook: `supabase.from("user_gateways").select("*").eq("user_id", "${bot.user_id}").eq("is_active", true)`
        }
        resultado.resumo.gateways_configurados++
      } else {
        botSim.gateway = {
          id: null,
          nome: null,
          configurado: false,
          token_presente: false,
          encontrado_por: null,
          user_id_usado: bot.user_id,
          bot_id_usado: bot.id,
          codigo_webhook: `supabase.from("user_gateways").select("*").eq("user_id", "${bot.user_id}").eq("is_active", true)`,
          debug_info: {
            tentou_user_id: bot.user_id,
            resultado_user_id: gwByUser ? "encontrou" : "NAO ENCONTROU",
            tentou_bot_id: bot.id,
            resultado_bot_id: gwByBot ? "encontrou" : "NAO ENCONTROU"
          }
        }
        botSim.problemas.push(`GATEWAY NAO CONFIGURADO - Buscou por user_id="${bot.user_id}" e bot_id="${bot.id}" mas nao encontrou nenhum ativo!`)
      }

      // ========== 4. BUSCAR FLUXO ==========
      let fluxo: FluxoData | null = null

      // Tentar flow_bots primeiro
      const { data: fb } = await supabase
        .from("flow_bots")
        .select("flow_id")
        .eq("bot_id", bot.id)
        .limit(1)
        .single()

      if (fb?.flow_id) {
        const { data: f } = await supabase
          .from("flows")
          .select("*")
          .eq("id", fb.flow_id)
          .single()
        if (f) fluxo = f as FluxoData
      }

      // Fallback: flow.bot_id
      if (!fluxo) {
        const { data: f } = await supabase
          .from("flows")
          .select("*")
          .eq("bot_id", bot.id)
          .limit(1)
          .single()
        if (f) fluxo = f as FluxoData
      }

      if (!fluxo) {
        botSim.problemas.push("FLUXO NAO VINCULADO - Bot nao tem fluxo")
        botSim.simulacao.resultado_final = "ERRO"
        botSim.simulacao.mensagem_final = "Sem fluxo vinculado"
        resultado.bots.push(botSim)
        continue
      }

      resultado.resumo.total_fluxos++
      
      botSim.fluxo = {
        id: fluxo.id,
        nome: fluxo.name || "Sem nome",
        status: fluxo.status || "N/A"
      }

      // ========== 5. BUSCAR PLANOS ==========
      const { data: planosDb } = await supabase
        .from("flow_plans")
        .select("*")
        .eq("flow_id", fluxo.id)
        .eq("is_active", true)
        .order("position", { ascending: true })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = (fluxo.config || {}) as Record<string, any>
      const planosConfig = config.plans || []

      const todosPlanos = (planosDb && planosDb.length > 0) ? planosDb : planosConfig

      if (todosPlanos.length === 0) {
        botSim.problemas.push("SEM PLANOS - Fluxo nao tem planos cadastrados")
        botSim.simulacao.resultado_final = "ERRO"
        botSim.simulacao.mensagem_final = "Sem planos"
        resultado.bots.push(botSim)
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of todosPlanos as any[]) {
        const preco = Number(p.price) || 0
        botSim.planos.push({
          id: p.id,
          nome: p.name,
          preco: preco,
          preco_formatado: formatarPreco(preco),
          callback: `plan_${p.id}`
        })
        resultado.resumo.total_planos++
      }

      // ========== 6. BUSCAR ORDER BUMP ==========
      const obConfig = config.orderBump || config.order_bump || {}
      const obEnabled = obConfig.enabled === true
      const obPrice = Number(obConfig.price) || 0
      const obAtivo = obEnabled && obPrice > 0

      if (obAtivo) {
        resultado.resumo.order_bumps_ativos++
        botSim.order_bump = {
          ativo: true,
          nome: obConfig.name || "Order Bump",
          preco: obPrice,
          preco_formatado: formatarPreco(obPrice),
          descricao: obConfig.description || null,
          botao_aceitar: obConfig.acceptText || obConfig.acceptButtonText || "ADICIONAR",
          botao_recusar: obConfig.rejectText || obConfig.declineButtonText || "NAO QUERO"
        }
      } else {
        botSim.order_bump = {
          ativo: false,
          nome: null,
          preco: 0,
          preco_formatado: null,
          descricao: null,
          botao_aceitar: "ADICIONAR",
          botao_recusar: "NAO QUERO"
        }
        if (obConfig.enabled === false) {
          botSim.problemas.push("ORDER BUMP DESABILITADO - enabled=false no config")
        }
      }

      // ========== 7. VERIFICAR ESTADO DO USUARIO (CRUCIAL!) ==========
      // Codigo REAL do webhook linhas 1543-1575:
      // Busca estado com status = "waiting_multi_order_bump"
      // Se nao encontrar -> "Erro ao processar. Tente novamente."
      
      const { data: userStates } = await supabase
        .from("user_flow_state")
        .select("*")
        .eq("bot_id", bot.id)
        .order("updated_at", { ascending: false })
        .limit(5)
      
      const estadoWaiting = userStates?.find(s => s.status === "waiting_multi_order_bump")
      const estadoRecente = userStates?.[0]
      
      // Adicionar info de debug do estado
      botSim.estado_usuarios = {
        total_estados: userStates?.length || 0,
        estados: (userStates || []).map(s => ({
          telegram_user_id: s.telegram_user_id,
          status: s.status,
          updated_at: s.updated_at,
          metadata: s.metadata
        })),
        tem_waiting_multi_order_bump: !!estadoWaiting,
        estado_recente: estadoRecente ? {
          status: estadoRecente.status,
          updated_at: estadoRecente.updated_at,
          metadata: estadoRecente.metadata
        } : null,
        codigo_webhook: `supabase.from("user_flow_state").select("metadata, flow_id").eq("bot_id", "${bot.id}").eq("telegram_user_id", "XXX").eq("status", "waiting_multi_order_bump").single()`,
        explicacao: "Se nao encontrar estado com status='waiting_multi_order_bump', mostra 'Erro ao processar. Tente novamente.'"
      }

      // ========== 8. SIMULACAO DO FLUXO COMPLETO ==========
      const planoEscolhido = botSim.planos[0]
      let etapaNum = 1

      // --- ETAPA 1: Usuario clica "Ver Planos" ---
      botSim.simulacao.etapas.push({
        numero: etapaNum++,
        acao_usuario: "Clica no botao 'Ver Planos'",
        callback_enviado: "view_plans",
        resposta_bot: {
          texto: "Escolha seu plano:",
          botoes: botSim.planos.map(p => ({
            texto: p.nome,
            callback: p.callback
          }))
        },
        status: "OK",
        erro: null
      })

      // --- ETAPA 2: Usuario seleciona um plano ---
      const callbackPlano = `plan_${planoEscolhido.id}`
      
      if (obAtivo && botSim.order_bump) {
        // Com Order Bump
        const obAcceptCallback = `ob_accept_${Math.round(planoEscolhido.preco * 100)}_${Math.round(obPrice * 100)}`
        const obDeclineCallback = `ob_decline_${Math.round(planoEscolhido.preco * 100)}_0`

        botSim.simulacao.etapas.push({
          numero: etapaNum++,
          acao_usuario: `Seleciona plano "${planoEscolhido.nome}"`,
          callback_enviado: callbackPlano,
          resposta_bot: {
            texto: botSim.order_bump.descricao || `Aproveite! Adicione ${botSim.order_bump.nome} por apenas ${botSim.order_bump.preco_formatado}!`,
            botoes: [
              { texto: botSim.order_bump.botao_aceitar, callback: obAcceptCallback },
              { texto: botSim.order_bump.botao_recusar, callback: obDeclineCallback }
            ]
          },
          status: "OK",
          erro: null
        })

        // --- ETAPA 3: Usuario aceita Order Bump ---
        const totalComBump = planoEscolhido.preco + obPrice
        
        botSim.simulacao.etapas.push({
          numero: etapaNum++,
          acao_usuario: `Clica em "${botSim.order_bump.botao_aceitar}"`,
          callback_enviado: obAcceptCallback,
          resposta_bot: {
            texto: `Adicionado!\n\nResumo do Pedido:\n${planoEscolhido.nome}: ${planoEscolhido.preco_formatado}\n${botSim.order_bump.nome}: ${botSim.order_bump.preco_formatado}\n\nEscolha um dos produtos acima ou continue com o conteudo principal`,
            botoes: [
              { texto: `PROSSEGUIR - ${formatarPreco(totalComBump)}`, callback: "proceed_payment" }
            ]
          },
          status: "OK",
          erro: null
        })

        // --- ETAPA 4: Usuario clica PROSSEGUIR ---
        // AQUI EH ONDE O ERRO ACONTECE!
        // Codigo REAL do webhook linhas 1543-1603:
        // 1. Busca estado com status = "waiting_multi_order_bump"
        // 2. Se nao encontrar -> "Erro ao processar. Tente novamente."
        // 3. Se totalAmount <= 0 -> "Erro ao processar. Tente novamente."
        // 4. Se gateway nao configurado -> "Nenhum gateway de pagamento configurado"
        
        const obFinishCallback = `ob_finish_${Math.round(planoEscolhido.preco * 100)}`
        
        // Verificar se vai dar erro no PROSSEGUIR
        let erroProsseguir: string | null = null
        let textoResposta = ""
        
        if (!botSim.estado_usuarios?.tem_waiting_multi_order_bump) {
          // ERRO MAIS COMUM: Estado nao existe ou status errado
          erroProsseguir = `ESTADO NAO ENCONTRADO! O webhook busca user_flow_state com status="waiting_multi_order_bump" mas nao encontrou. Estados atuais: ${botSim.estado_usuarios?.estados.map(e => e.status).join(", ") || "nenhum"}`
          textoResposta = "Erro ao processar. Tente novamente."
        } else if (totalComBump <= 0) {
          // ERRO: Valor zero
          erroProsseguir = "VALOR TOTAL ZERADO! mainAmount + totalBumpAmount <= 0"
          textoResposta = "Erro ao processar. Tente novamente."
        } else if (!botSim.gateway?.configurado) {
          // ERRO: Gateway nao configurado
          erroProsseguir = "Gateway de pagamento nao configurado!"
          textoResposta = "Nenhum gateway de pagamento configurado. Configure em Configuracoes > Integracoes."
        }
        
        if (erroProsseguir) {
          botSim.simulacao.etapas.push({
            numero: etapaNum++,
            acao_usuario: "Clica em 'PROSSEGUIR'",
            callback_enviado: obFinishCallback,
            resposta_bot: {
              texto: textoResposta,
              botoes: []
            },
            status: "ERRO",
            erro: erroProsseguir,
            codigo_executado: {
              linha_1543: `supabase.from("user_flow_state").select("metadata, flow_id").eq("bot_id", "${bot.id}").eq("telegram_user_id", "XXX").eq("status", "waiting_multi_order_bump").single()`,
              linha_1571: "if (!userState) { await sendTelegramMessage(botToken, chatId, 'Erro ao processar. Tente novamente.'); return }",
              linha_1597: "if (totalAmount <= 0) { await sendTelegramMessage(botToken, chatId, 'Erro ao processar. Tente novamente.'); return }",
              linha_1652: "if (!gatewayMulti) { await sendTelegramMessage(botToken, chatId, 'Nenhum gateway de pagamento configurado...'); return }"
            }
          })
          botSim.simulacao.resultado_final = "ERRO"
          botSim.simulacao.mensagem_final = erroProsseguir
        } else {
          botSim.simulacao.etapas.push({
            numero: etapaNum++,
            acao_usuario: "Clica em 'PROSSEGUIR'",
            callback_enviado: obFinishCallback,
            resposta_bot: {
              texto: `Gerando PIX no valor de ${formatarPreco(totalComBump)}...\n\n[QR CODE SERIA GERADO AQUI]\n\nPix Copia e Cola: 00020126...`,
              botoes: []
            },
            status: "OK",
            erro: null
          })
          botSim.simulacao.resultado_final = "SUCESSO"
          botSim.simulacao.mensagem_final = `Fluxo completo OK! PIX de ${formatarPreco(totalComBump)} seria gerado.`
          resultado.resumo.pode_processar_pagamento = true
        }

      } else {
        // Sem Order Bump - vai direto pro pagamento
        botSim.simulacao.etapas.push({
          numero: etapaNum++,
          acao_usuario: `Seleciona plano "${planoEscolhido.nome}"`,
          callback_enviado: callbackPlano,
          resposta_bot: {
            texto: `Voce selecionou: ${planoEscolhido.nome}\nValor: ${planoEscolhido.preco_formatado}`,
            botoes: [
              { texto: `PROSSEGUIR - ${planoEscolhido.preco_formatado}`, callback: "proceed_payment" }
            ]
          },
          status: "OK",
          erro: null
        })

        // --- ETAPA 3: Usuario clica PROSSEGUIR ---
        if (botSim.gateway?.configurado) {
          botSim.simulacao.etapas.push({
            numero: etapaNum++,
            acao_usuario: "Clica em 'PROSSEGUIR'",
            callback_enviado: "proceed_payment",
            resposta_bot: {
              texto: `Gerando PIX no valor de ${planoEscolhido.preco_formatado}...\n\n[QR CODE SERIA GERADO AQUI]\n\nPix Copia e Cola: 00020126...`,
              botoes: []
            },
            status: "OK",
            erro: null
          })
          botSim.simulacao.resultado_final = "SUCESSO"
          botSim.simulacao.mensagem_final = `Fluxo completo OK! PIX de ${planoEscolhido.preco_formatado} seria gerado.`
          resultado.resumo.pode_processar_pagamento = true
        } else {
          botSim.simulacao.etapas.push({
            numero: etapaNum++,
            acao_usuario: "Clica em 'PROSSEGUIR'",
            callback_enviado: "proceed_payment",
            resposta_bot: {
              texto: "Erro ao processar. Tente novamente.",
              botoes: []
            },
            status: "ERRO",
            erro: "Gateway de pagamento nao configurado! Nao consegue gerar PIX."
          })
          botSim.simulacao.resultado_final = "ERRO_GATEWAY"
          botSim.simulacao.mensagem_final = "Pagamento falha porque gateway nao esta configurado"
        }
      }

      // Contabilizar problemas
      resultado.resumo.total_problemas += botSim.problemas.length

      resultado.bots.push(botSim)
    }

    resultado.tempo_execucao_ms = Date.now() - inicio
    resultado.ok = resultado.resumo.total_problemas === 0

    return NextResponse.json(resultado, { status: 200 })

  } catch (error) {
    return NextResponse.json({
      ok: false,
      erro: error instanceof Error ? error.message : "Erro desconhecido",
      timestamp: new Date().toISOString(),
      tempo_execucao_ms: Date.now() - inicio
    }, { status: 500 })
  }
}

// ========== TIPOS ==========

interface BotSimulacao {
  bot_id: string
  bot_nome: string
  bot_username: string | null
  bot_link: string | null
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  estado_usuarios?: {
    total_estados: number
    estados: Array<{
      telegram_user_id: string
      status: string
      updated_at: string
      metadata: unknown
    }>
    tem_waiting_multi_order_bump: boolean
    estado_recente: {
      status: string
      updated_at: string
      metadata: unknown
    } | null
    codigo_webhook: string
    explicacao: string
  }
  
  gateway: {
    id: string | null
    nome: string | null
    configurado: boolean
    token_presente: boolean
    encontrado_por: "user_id" | "bot_id" | null
    user_id_usado: string | null
    bot_id_usado: string | null
    codigo_webhook: string
    debug_info?: {
      tentou_user_id: string | null
      resultado_user_id: string
      tentou_bot_id: string | null
      resultado_bot_id: string
    }
  } | null
  
  fluxo: {
    id: string
    nome: string
    status: string
  } | null
  
  planos: Array<{
    id: string
    nome: string
    preco: number
    preco_formatado: string
    callback: string
  }>
  
  order_bump: {
    ativo: boolean
    nome: string | null
    preco: number
    preco_formatado: string | null
    descricao: string | null
    botao_aceitar: string
    botao_recusar: string
  } | null
  
  simulacao: {
    etapas: Array<{
      numero: number
      acao_usuario: string
      callback_enviado: string
      resposta_bot: {
        texto: string
        botoes: Array<{ texto: string; callback: string }>
      }
      status: "OK" | "ERRO"
      erro: string | null
      codigo_executado?: {
        linha_1543?: string
        linha_1571?: string
        linha_1597?: string
        linha_1652?: string
      }
    }>
    resultado_final: "NAO_INICIADO" | "SUCESSO" | "ERRO" | "ERRO_GATEWAY"
    mensagem_final: string
  }
  
  problemas: string[]
}

interface FluxoData {
  id: string
  name: string
  status?: string
  config?: Record<string, unknown>
  bot_id?: string
}

// ========== HELPERS ==========

function formatarPreco(valor: number): string {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`
}
