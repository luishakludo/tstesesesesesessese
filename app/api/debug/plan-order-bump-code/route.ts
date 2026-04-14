import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * API SIMPLES - Mostra o CODIGO EXATO do webhook que roda quando clica PROSSEGUIR
 * 
 * GET /api/debug/plan-order-bump-code
 * 
 * Retorna os trechos de codigo relevantes do webhook + dados do banco
 */

export async function GET() {
  const supabase = getSupabase()
  
  try {
    // Buscar bot Vbjii especificamente
    const { data: bot } = await supabase
      .from("bots")
      .select("*")
      .eq("name", "Vbjii")
      .single()
    
    if (!bot) {
      return NextResponse.json({ erro: "Bot Vbjii nao encontrado" })
    }

    // Buscar gateway
    const { data: gateway } = await supabase
      .from("user_gateways")
      .select("*")
      .eq("user_id", bot.user_id)
      .eq("is_active", true)
      .single()

    // Buscar fluxo
    const { data: flowBot } = await supabase
      .from("flow_bots")
      .select("flow_id")
      .eq("bot_id", bot.id)
      .single()
    
    let fluxo = null
    if (flowBot) {
      const { data: f } = await supabase
        .from("flows")
        .select("*")
        .eq("id", flowBot.flow_id)
        .single()
      fluxo = f
    }

    // Buscar planos do banco (flow_plans)
    const { data: planosDb } = await supabase
      .from("flow_plans")
      .select("*")
      .eq("flow_id", fluxo?.id)
      .eq("is_active", true)

    // Buscar planos do config JSON
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = (fluxo?.config || {}) as Record<string, any>
    const planosConfig = config.plans || []

    // Buscar estados do usuario
    const { data: estados } = await supabase
      .from("user_flow_state")
      .select("*")
      .eq("bot_id", bot.id)
      .order("updated_at", { ascending: false })
      .limit(5)

    // =============== ANALISE DO PROBLEMA ===============
    const analise = {
      bot: {
        id: bot.id,
        nome: bot.name,
        user_id: bot.user_id
      },
      
      gateway: gateway ? {
        encontrado: true,
        id: gateway.id,
        nome: gateway.gateway || gateway.gateway_name,
        user_id: gateway.user_id,
        is_active: gateway.is_active,
        tem_token: !!gateway.access_token
      } : {
        encontrado: false,
        query_usada: `SELECT * FROM user_gateways WHERE user_id = '${bot.user_id}' AND is_active = true`
      },
      
      fluxo: fluxo ? {
        id: fluxo.id,
        nome: fluxo.name,
        status: fluxo.status
      } : null,
      
      planos: {
        do_banco: planosDb?.map(p => ({
          id: p.id,
          nome: p.name,
          preco: p.price,
          tem_order_bumps: !!p.order_bumps && Array.isArray(p.order_bumps) && p.order_bumps.length > 0,
          order_bumps: p.order_bumps
        })),
        do_config: planosConfig.map((p: Record<string, unknown>) => ({
          id: p.id,
          nome: p.name,
          preco: p.price,
          tem_order_bumps: !!p.order_bumps && Array.isArray(p.order_bumps) && (p.order_bumps as unknown[]).length > 0,
          order_bumps: p.order_bumps
        }))
      },
      
      order_bump_global: {
        config_completo: config.orderBump,
        enabled: config.orderBump?.enabled,
        price: config.orderBump?.price,
        inicial: config.orderBump?.inicial
      },
      
      estados_usuario: estados?.map(e => ({
        telegram_user_id: e.telegram_user_id,
        status: e.status,
        updated_at: e.updated_at,
        metadata: e.metadata
      })),
      
      tem_waiting_multi_order_bump: estados?.some(e => e.status === "waiting_multi_order_bump")
    }

    // =============== CODIGO DO WEBHOOK ===============
    const codigo_webhook = {
      descricao: "Trechos EXATOS do arquivo app/api/telegram/webhook/[botId]/route.ts",
      
      quando_clica_no_plano: {
        linhas: "2316-2766",
        logica: `
// Linha 2316-2320: Detecta callback do plano
if (data.startsWith("plan_")) {
  const planId = data.replace("plan_", "")
  
  // Linha 2425-2445: Busca order bumps ESPECIFICOS do plano
  // PRIMEIRO: Se plano veio do banco (flow_plans) e tem order_bumps
  let planOrderBumps = []
  if (dbPlan?.order_bumps && Array.isArray(dbPlan.order_bumps)) {
    planOrderBumps = dbPlan.order_bumps
  } else {
    // SEGUNDO: Busca no config JSON (flows.config.plans[])
    const selectedPlanConfig = flowConfig.plans?.find(p => p.id === planId)
    if (selectedPlanConfig?.order_bumps) {
      planOrderBumps = selectedPlanConfig.order_bumps
    }
  }
  
  // Linha 2466-2468: Filtra apenas order bumps ATIVOS
  const activePlanOrderBumps = planOrderBumps.filter(ob => 
    ob.enabled && ob.price && ob.price > 0
  )
  
  // Linha 2473-2575: SE TEM ORDER BUMPS ATIVOS DO PLANO
  if (activePlanOrderBumps.length > 0) {
    // Mostra botoes ADICIONAR para cada order bump
    // Salva estado com status = "waiting_multi_order_bump"
    // Mostra botao PROSSEGUIR
  }
  
  // Linha 2578-2647: SE NAO TEM ESPECIFICO, USA GLOBAL
  else if (orderBumpConfig?.inicial?.enabled) {
    // Mostra order bump global
    // Salva estado com status = "waiting_order_bump"
  }
  
  // Linha 2651-2766: SE NAO TEM NENHUM ORDER BUMP
  else {
    // VAI DIRETO PRO PIX! Nao mostra botao PROSSEGUIR!
  }
}
        `
      },
      
      quando_clica_prosseguir: {
        linhas: "1525-1720",
        logica: `
// Linha 1525-1536: Detecta callback ob_finish_
if (data.startsWith("ob_finish_")) {
  
  // Linha 1543-1560: Busca estado do usuario
  const { data: userState } = await supabase
    .from("user_flow_state")
    .select("metadata, flow_id")
    .eq("bot_id", botId)
    .eq("telegram_user_id", String(telegramUserId))
    .eq("status", "waiting_multi_order_bump")  // <-- AQUI!
    .single()
  
  // Linha 1571-1575: SE NAO ENCONTRAR ESTADO
  if (!userState) {
    await sendTelegramMessage(botToken, chatId, "Erro ao processar. Tente novamente.")
    return  // <-- PARA AQUI!
  }
  
  // Linha 1580-1590: Pega metadata do estado
  const metadata = userState.metadata
  const mainAmount = metadata.mainAmount || 0
  const bumpSelections = metadata.bumpSelections || []
  const totalBumpAmount = bumpSelections.reduce((sum, b) => sum + b.price, 0)
  const totalAmount = mainAmount + totalBumpAmount
  
  // Linha 1597-1601: SE VALOR ZERADO
  if (totalAmount <= 0) {
    await sendTelegramMessage(botToken, chatId, "Erro ao processar. Tente novamente.")
    return  // <-- PARA AQUI!
  }
  
  // Linha 1640-1655: Busca gateway
  const { data: gatewayMulti } = await supabase
    .from("user_gateways")
    .select("*")
    .eq("user_id", botDataPack.user_id)
    .eq("is_active", true)
    .single()
  
  // Linha 1657-1661: SE NAO TEM GATEWAY
  if (!gatewayMulti) {
    await sendTelegramMessage(botToken, chatId, "Nenhum gateway de pagamento configurado...")
    return  // <-- PARA AQUI!
  }
  
  // Linha 1694+: Gera PIX via MercadoPago
  const pixResponse = await createPixPayment(...)
}
        `
      },
      
      problema_identificado: `
================== PROBLEMA IDENTIFICADO ==================

O plano "tetse" tem order_bumps configurados?
- No banco (flow_plans.order_bumps): ${JSON.stringify(planosDb?.[0]?.order_bumps)}
- No config (flows.config.plans[].order_bumps): ${JSON.stringify(planosConfig[0]?.order_bumps)}

Order bump global esta ativo?
- config.orderBump.enabled: ${config.orderBump?.enabled}
- config.orderBump.inicial.enabled: ${config.orderBump?.inicial?.enabled}

SE activePlanOrderBumps.length === 0 E orderBumpGlobal nao esta ativo:
-> O webhook vai direto pro PIX (linha 2651+)
-> NAO salva estado "waiting_multi_order_bump"
-> NAO mostra botao PROSSEGUIR

MAS se a interface mostra botao PROSSEGUIR mesmo assim:
-> Quando clica, busca estado "waiting_multi_order_bump"
-> NAO encontra (porque nunca foi salvo)
-> Mostra "Erro ao processar. Tente novamente."

==========================================================
      `
    }

    return NextResponse.json({
      ok: true,
      analise,
      codigo_webhook,
      solucao: {
        opcao_1: "Ativar order bumps no plano 'tetse' (flow_plans.order_bumps ou flows.config.plans[].order_bumps)",
        opcao_2: "Ativar order bump global (flows.config.orderBump.enabled = true)",
        opcao_3: "Se nao quer order bump, verificar por que a interface mostra botao PROSSEGUIR quando nao deveria"
      }
    }, { status: 200 })

  } catch (error) {
    return NextResponse.json({
      ok: false,
      erro: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 })
  }
}
