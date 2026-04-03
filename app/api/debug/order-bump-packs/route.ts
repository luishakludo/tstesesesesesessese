import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const botId = searchParams.get("botId")

  if (!botId) {
    return NextResponse.json({ error: "botId é obrigatório" }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // 1. Buscar o bot
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, name, username")
      .eq("id", botId)
      .single()

    if (botError || !bot) {
      return NextResponse.json({ 
        error: "Bot não encontrado",
        details: botError?.message 
      }, { status: 404 })
    }

    // 2. Buscar flow_bots para encontrar fluxos conectados
    const { data: flowBots, error: flowBotsError } = await supabase
      .from("flow_bots")
      .select("flow_id")
      .eq("bot_id", botId)

    // 3. Buscar flows diretamente conectados ao bot
    const { data: directFlows, error: directFlowsError } = await supabase
      .from("flows")
      .select("id, name, config, is_active")
      .eq("bot_id", botId)

    // 4. Buscar flows via flow_bots
    let flowBotsFlows: any[] = []
    if (flowBots && flowBots.length > 0) {
      const flowIds = flowBots.map(fb => fb.flow_id)
      const { data } = await supabase
        .from("flows")
        .select("id, name, config, is_active")
        .in("id", flowIds)
      flowBotsFlows = data || []
    }

    // Combinar todos os fluxos
    const allFlows = [...(directFlows || []), ...flowBotsFlows]
    
    // Filtrar apenas ativos
    const activeFlows = allFlows.filter(f => f.is_active)

    // Analisar cada fluxo
    const flowsAnalysis = allFlows.map(flow => {
      const config = flow.config || {}
      const orderBump = config.orderBump || null
      const orderBumpPacks = orderBump?.packs || null

      return {
        flowId: flow.id,
        flowName: flow.name,
        isActive: flow.is_active,
        hasConfig: !!flow.config,
        orderBump: {
          exists: !!orderBump,
          enabled: orderBump?.enabled || false,
          raw: orderBump
        },
        orderBumpPacks: {
          exists: !!orderBumpPacks,
          enabled: orderBumpPacks?.enabled || false,
          name: orderBumpPacks?.name || null,
          price: orderBumpPacks?.price || null,
          description: orderBumpPacks?.description || null,
          hasMedias: !!(orderBumpPacks?.medias?.length > 0),
          raw: orderBumpPacks
        },
        wouldShowOrderBump: !!(
          orderBump?.enabled && 
          orderBumpPacks?.enabled && 
          orderBumpPacks?.price && 
          orderBumpPacks.price > 0
        ),
        conditions: {
          "orderBump.enabled": orderBump?.enabled,
          "orderBumpPacks.enabled": orderBumpPacks?.enabled,
          "orderBumpPacks.price": orderBumpPacks?.price,
          "price > 0": orderBumpPacks?.price > 0
        }
      }
    })

    // Qual fluxo seria usado (primeiro ativo)
    const activeFlow = activeFlows[0] || null
    let wouldUseFlow = null
    
    if (activeFlow) {
      const config = activeFlow.config || {}
      const orderBump = config.orderBump
      const orderBumpPacks = orderBump?.packs
      
      wouldUseFlow = {
        flowId: activeFlow.id,
        flowName: activeFlow.name,
        wouldShowOrderBump: !!(
          orderBump?.enabled && 
          orderBumpPacks?.enabled && 
          orderBumpPacks?.price && 
          orderBumpPacks.price > 0
        ),
        reason: !orderBump?.enabled 
          ? "Order Bump está desabilitado"
          : !orderBumpPacks?.enabled 
            ? "Order Bump de Packs está desabilitado"
            : !orderBumpPacks?.price 
              ? "Preço do Order Bump não definido"
              : orderBumpPacks.price <= 0
                ? "Preço do Order Bump é 0 ou negativo"
                : "Todas as condições atendidas - Order Bump SERÁ mostrado"
      }
    }

    return NextResponse.json({
      bot: {
        id: bot.id,
        name: bot.name,
        username: bot.username
      },
      summary: {
        totalFlows: allFlows.length,
        activeFlows: activeFlows.length,
        flowsWithOrderBump: flowsAnalysis.filter(f => f.orderBump.enabled).length,
        flowsWithPacksOrderBump: flowsAnalysis.filter(f => f.orderBumpPacks.enabled).length,
        flowsThatWouldShowOrderBump: flowsAnalysis.filter(f => f.wouldShowOrderBump).length
      },
      wouldUseFlow,
      flowsAnalysis
    })

  } catch (error) {
    console.error("Debug error:", error)
    return NextResponse.json({ 
      error: "Erro ao processar",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
