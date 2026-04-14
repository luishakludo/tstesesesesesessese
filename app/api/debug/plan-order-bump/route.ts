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
        
        // ========== BUSCAR ORDER BUMPS ESPECIFICOS DO PLANO ==========
        // PRIORIDADE (igual webhook linhas 2425-2473):
        // 1. Se plano veio do banco (flow_plans) e tem order_bumps -> usar dbPlan.order_bumps
        // 2. Se plano esta no config JSON e tem order_bumps -> usar flowConfig.plans[].order_bumps
        // 3. Se nenhum dos acima -> usar order bump global (orderBumpConfig.inicial)
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let planOrderBumps: any[] = []
        let orderBumpSource = "nenhum"
        
        // PRIMEIRO: Verificar se plano do banco tem order_bumps
        if (planosDb && planosDb.length > 0 && p.order_bumps && Array.isArray(p.order_bumps)) {
          planOrderBumps = p.order_bumps
          orderBumpSource = "flow_plans.order_bumps (banco)"
        } else {
          // SEGUNDO: Buscar no config JSON (flows.config.plans[])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const selectedPlanConfig = planosConfig.find((cp: any) => 
            cp.id === p.id || cp.name?.toLowerCase().trim() === p.name?.toLowerCase().trim()
          )
          if (selectedPlanConfig?.order_bumps) {
            planOrderBumps = selectedPlanConfig.order_bumps
            orderBumpSource = "flows.config.plans[].order_bumps (JSON)"
          }
        }
        
        // Filtrar apenas order bumps ATIVOS com preco > 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const activePlanOrderBumps = planOrderBumps.filter((ob: any) => 
          ob.enabled && ob.price && ob.price > 0
        )
        
        botSim.planos.push({
          id: p.id,
          nome: p.name,
          preco: preco,
          preco_formatado: formatarPreco(preco),
          callback: `plan_${p.id}`,
          // NOVO: Order bumps especificos do plano
          order_bumps_especificos: {
            fonte: orderBumpSource,
            total_configurados: planOrderBumps.length,
            total_ativos: activePlanOrderBumps.length,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            lista: activePlanOrderBumps.map((ob: any, idx: number) => ({
              index: idx,
              id: ob.id || `bump_${idx}`,
              nome: ob.name || `Order Bump ${idx + 1}`,
              preco: ob.price,
              preco_formatado: formatarPreco(ob.price),
              enabled: ob.enabled,
              descricao: ob.description || null,
              botao_aceitar: ob.acceptText || "ADICIONAR",
              botao_recusar: ob.rejectText || "NAO QUERO",
              callback_aceitar: `ob_multi_${Math.round(preco * 100)}_${Math.round(ob.price * 100)}_${idx}`
            })),
            codigo_webhook: `activePlanOrderBumps = planOrderBumps.filter(ob => ob.enabled && ob.price > 0) // linha 2466-2468`
          }
        })
        resultado.resumo.total_planos++
        
        // Contar order bumps ativos
        if (activePlanOrderBumps.length > 0) {
          resultado.resumo.order_bumps_ativos += activePlanOrderBumps.length
        }
      }

      // ========== 6. BUSCAR ORDER BUMP GLOBAL (fallback) ==========
      const obConfig = config.orderBump || config.order_bump || {}
      const obInicial = obConfig.inicial || obConfig
      const obEnabled = obInicial.enabled === true
      const obPrice = Number(obInicial.price) || 0
      const obAtivo = obEnabled && obPrice > 0

      botSim.order_bump_global = {
        ativo: obAtivo,
        nome: obInicial.name || "Order Bump Global",
        preco: obPrice,
        preco_formatado: obAtivo ? formatarPreco(obPrice) : null,
        descricao: obInicial.description || null,
        botao_aceitar: obInicial.acceptText || obInicial.acceptButtonText || "ADICIONAR",
        botao_recusar: obInicial.rejectText || obInicial.declineButtonText || "NAO QUERO",
        explicacao: "Este order bump global so eh usado se o plano NAO tiver order bumps especificos"
      }
      
      if (!obAtivo && obConfig.enabled === false) {
        // Nao eh problema se o plano tem order bumps especificos
        const planoComOB = botSim.planos.some(p => p.order_bumps_especificos?.total_ativos > 0)
        if (!planoComOB) {
          botSim.problemas.push("ORDER BUMP GLOBAL DESABILITADO e planos nao tem order bumps especificos")
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
      
      // VERIFICAR ORDER BUMPS - Prioridade:
      // 1. Order bumps ESPECIFICOS do plano (plan.order_bumps_especificos)
      // 2. Order bump GLOBAL (orderBumpConfig.inicial)
      // 3. Se nenhum -> vai direto pro PIX
      
      const temOrderBumpEspecifico = planoEscolhido.order_bumps_especificos?.total_ativos > 0
      const temOrderBumpGlobal = obAtivo
      const temAlgumOrderBump = temOrderBumpEspecifico || temOrderBumpGlobal
      
      // Adicionar debug sobre qual order bump sera usado
      botSim.simulacao.decisao_order_bump = {
        tem_order_bump_especifico: temOrderBumpEspecifico,
        total_especificos_ativos: planoEscolhido.order_bumps_especificos?.total_ativos || 0,
        tem_order_bump_global: temOrderBumpGlobal,
        qual_sera_usado: temOrderBumpEspecifico ? "ESPECIFICO_DO_PLANO" : (temOrderBumpGlobal ? "GLOBAL" : "NENHUM"),
        codigo_webhook_decisao: "if (activePlanOrderBumps.length > 0) { /* usa especifico */ } else if (orderBumpInicial?.enabled) { /* usa global */ } else { /* PIX direto */ }"
      }
      
      if (temOrderBumpEspecifico) {
        // COM ORDER BUMP ESPECIFICO DO PLANO (prioridade 1)
        const primeiroOB = planoEscolhido.order_bumps_especificos!.lista[0]
        const obAcceptCallback = primeiroOB.callback_aceitar
        const mainPriceRounded = Math.round(planoEscolhido.preco * 100)

        botSim.simulacao.etapas.push({
          numero: etapaNum++,
          acao_usuario: `Seleciona plano "${planoEscolhido.nome}"`,
          callback_enviado: callbackPlano,
          resposta_bot: {
            texto: primeiroOB.descricao || `Deseja adicionar ${primeiroOB.nome} por apenas ${primeiroOB.preco_formatado}?`,
            botoes: planoEscolhido.order_bumps_especificos!.lista.map(ob => ({
              texto: ob.botao_aceitar,
              callback: ob.callback_aceitar
            }))
          },
          status: "OK",
          erro: null,
          debug_order_bump: {
            tipo: "ESPECIFICO_DO_PLANO",
            fonte: planoEscolhido.order_bumps_especificos!.fonte,
            total_bumps: planoEscolhido.order_bumps_especificos!.total_ativos
          }
        })

        // --- ETAPA 3: Usuario clica ADICIONAR ---
        const totalComBump = planoEscolhido.preco + primeiroOB.preco
        
        botSim.simulacao.etapas.push({
          numero: etapaNum++,
          acao_usuario: `Clica em "${primeiroOB.botao_aceitar}" (${primeiroOB.nome})`,
          callback_enviado: obAcceptCallback,
          resposta_bot: {
            texto: `Adicionado!\n\nResumo do Pedido:\n${planoEscolhido.nome}: ${planoEscolhido.preco_formatado}\n${primeiroOB.nome}: ${primeiroOB.preco_formatado}\n\nEscolha um dos produtos acima ou continue com o conteudo principal`,
            botoes: [
              { texto: `PROSSEGUIR - ${formatarPreco(totalComBump)}`, callback: `ob_finish_${mainPriceRounded}` }
            ]
          },
          status: "OK",
          erro: null
        })

        // --- ETAPA 4: Usuario clica PROSSEGUIR ---
        const obFinishCallback = `ob_finish_${mainPriceRounded}`
        
        let erroProsseguir: string | null = null
        let textoResposta = ""
        
        if (!botSim.estado_usuarios?.tem_waiting_multi_order_bump) {
          erroProsseguir = `ESTADO NAO ENCONTRADO! O webhook busca user_flow_state com status="waiting_multi_order_bump" mas nao encontrou. Estados atuais: ${botSim.estado_usuarios?.estados.map(e => e.status).join(", ") || "nenhum"}`
          textoResposta = "Erro ao processar. Tente novamente."
        } else if (totalComBump <= 0) {
          erroProsseguir = "VALOR TOTAL ZERADO! mainAmount + totalBumpAmount <= 0"
          textoResposta = "Erro ao processar. Tente novamente."
        } else if (!botSim.gateway?.configurado) {
          erroProsseguir = "Gateway de pagamento nao configurado!"
          textoResposta = "Nenhum gateway de pagamento configurado. Configure em Configuracoes > Integracoes."
        }
        
        if (erroProsseguir) {
          botSim.simulacao.etapas.push({
            numero: etapaNum++,
            acao_usuario: "Clica em 'PROSSEGUIR'",
            callback_enviado: obFinishCallback,
            resposta_bot: { texto: textoResposta, botoes: [] },
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
            resposta_bot: { texto: `Gerando PIX no valor de ${formatarPreco(totalComBump)}...`, botoes: [] },
            status: "OK",
            erro: null
          })
          botSim.simulacao.resultado_final = "SUCESSO"
          botSim.simulacao.mensagem_final = `Fluxo completo OK! PIX de ${formatarPreco(totalComBump)} seria gerado.`
          resultado.resumo.pode_processar_pagamento = true
        }

      } else if (temOrderBumpGlobal && botSim.order_bump_global) {
        // COM ORDER BUMP GLOBAL (prioridade 2)
        const obGlobal = botSim.order_bump_global
        const obAcceptCallback = `ob_accept_${Math.round(planoEscolhido.preco * 100)}_${Math.round(obGlobal.preco * 100)}`
        const obDeclineCallback = `ob_decline_${Math.round(planoEscolhido.preco * 100)}_0`

        botSim.simulacao.etapas.push({
          numero: etapaNum++,
          acao_usuario: `Seleciona plano "${planoEscolhido.nome}"`,
          callback_enviado: callbackPlano,
          resposta_bot: {
            texto: obGlobal.descricao || `Aproveite! Adicione ${obGlobal.nome} por apenas ${obGlobal.preco_formatado}!`,
            botoes: [
              { texto: obGlobal.botao_aceitar, callback: obAcceptCallback },
              { texto: obGlobal.botao_recusar, callback: obDeclineCallback }
            ]
          },
          status: "OK",
          erro: null,
          debug_order_bump: {
            tipo: "GLOBAL",
            fonte: "flows.config.orderBump.inicial",
            total_bumps: 1
          }
        })

        // Continua com order bump global...
        const totalComBump = planoEscolhido.preco + obGlobal.preco
        
        botSim.simulacao.etapas.push({
          numero: etapaNum++,
          acao_usuario: `Clica em "${obGlobal.botao_aceitar}"`,
          callback_enviado: obAcceptCallback,
          resposta_bot: {
            texto: `Adicionado!\n\nResumo:\n${planoEscolhido.nome}: ${planoEscolhido.preco_formatado}\n${obGlobal.nome}: ${obGlobal.preco_formatado}`,
            botoes: [{ texto: `PROSSEGUIR - ${formatarPreco(totalComBump)}`, callback: "proceed_payment" }]
          },
          status: "OK",
          erro: null
        })

        // Etapa PROSSEGUIR com order bump global usa callback diferente!
        if (botSim.gateway?.configurado) {
          botSim.simulacao.etapas.push({
            numero: etapaNum++,
            acao_usuario: "Clica em 'PROSSEGUIR'",
            callback_enviado: obAcceptCallback,
            resposta_bot: { texto: `Gerando PIX no valor de ${formatarPreco(totalComBump)}...`, botoes: [] },
            status: "OK",
            erro: null
          })
          botSim.simulacao.resultado_final = "SUCESSO"
          botSim.simulacao.mensagem_final = `Fluxo completo OK! PIX de ${formatarPreco(totalComBump)} seria gerado.`
          resultado.resumo.pode_processar_pagamento = true
        } else {
          botSim.simulacao.etapas.push({
            numero: etapaNum++,
            acao_usuario: "Clica em 'PROSSEGUIR'",
            callback_enviado: "proceed_payment",
            resposta_bot: { texto: "Erro ao processar. Tente novamente.", botoes: [] },
            status: "ERRO",
            erro: "Gateway de pagamento nao configurado!"
          })
          botSim.simulacao.resultado_final = "ERRO_GATEWAY"
          botSim.simulacao.mensagem_final = "Pagamento falha porque gateway nao esta configurado"
        }

      } else {
        // SEM ORDER BUMP - vai direto pro PIX (linha 2651-2766 do webhook)
        // Codigo webhook: if (activePlanOrderBumps.length === 0 && !orderBumpInicial?.enabled) { /* gera PIX direto */ }
        
        botSim.simulacao.etapas.push({
          numero: etapaNum++,
          acao_usuario: `Seleciona plano "${planoEscolhido.nome}"`,
          callback_enviado: callbackPlano,
          resposta_bot: {
            texto: `Voce selecionou: ${planoEscolhido.nome}\nValor: ${planoEscolhido.preco_formatado}\n\nGerando pagamento PIX...`,
            botoes: [] // SEM BOTAO PROSSEGUIR! VAI DIRETO PRO PIX!
          },
          status: "OK",
          erro: null,
          debug_order_bump: {
            tipo: "NENHUM",
            fonte: "N/A - vai direto pro PIX",
            total_bumps: 0,
            codigo_webhook: "// Linha 2651: Send processing message, Linha 2694: Generate PIX"
          }
        })

        // PIX eh gerado automaticamente, sem botao PROSSEGUIR
        if (botSim.gateway?.configurado) {
          botSim.simulacao.etapas.push({
            numero: etapaNum++,
            acao_usuario: "AUTOMATICO - Sistema gera PIX direto (sem botao PROSSEGUIR)",
            callback_enviado: "N/A - PIX automatico",
            resposta_bot: {
              texto: `Gerando PIX no valor de ${planoEscolhido.preco_formatado}...\n\n[QR CODE SERIA GERADO AQUI]\n\nPix Copia e Cola: 00020126...`,
              botoes: []
            },
            status: "OK",
            erro: null
          })
          botSim.simulacao.resultado_final = "SUCESSO"
          botSim.simulacao.mensagem_final = `Fluxo completo OK! PIX de ${planoEscolhido.preco_formatado} seria gerado DIRETO (sem order bump).`
          resultado.resumo.pode_processar_pagamento = true
        } else {
          botSim.simulacao.etapas.push({
            numero: etapaNum++,
            acao_usuario: "AUTOMATICO - Sistema tenta gerar PIX",
            callback_enviado: "N/A - PIX automatico",
            resposta_bot: {
              texto: "Gateway de pagamento nao configurado. Entre em contato com o suporte.",
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
    // Order bumps especificos do plano (prioridade 1)
    order_bumps_especificos?: {
      fonte: string
      total_configurados: number
      total_ativos: number
      lista: Array<{
        index: number
        id: string
        nome: string
        preco: number
        preco_formatado: string
        enabled: boolean
        descricao: string | null
        botao_aceitar: string
        botao_recusar: string
        callback_aceitar: string
      }>
      codigo_webhook: string
    }
  }>
  
  // Order bump global (prioridade 2 - usado se plano nao tem especificos)
  order_bump_global?: {
    ativo: boolean
    nome: string | null
    preco: number
    preco_formatado: string | null
    descricao: string | null
    botao_aceitar: string
    botao_recusar: string
    explicacao: string
  }
  
  simulacao: {
    // Decisao sobre qual order bump usar
    decisao_order_bump?: {
      tem_order_bump_especifico: boolean
      total_especificos_ativos: number
      tem_order_bump_global: boolean
      qual_sera_usado: "ESPECIFICO_DO_PLANO" | "GLOBAL" | "NENHUM"
      codigo_webhook_decisao: string
    }
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
      debug_order_bump?: {
        tipo: string
        fonte: string
        total_bumps: number
        codigo_webhook?: string
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
