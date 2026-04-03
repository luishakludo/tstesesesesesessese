import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ 
      error: "Variaveis de ambiente nao configuradas",
      missing: {
        NEXT_PUBLIC_SUPABASE_URL: !supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !supabaseServiceKey
      }
    }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // 1. Buscar todos os bots (para debug - sem auth)
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("id, name, username")
      .limit(10)

    if (botsError) {
      return NextResponse.json({ 
        error: "Erro ao buscar bots",
        details: botsError.message 
      }, { status: 500 })
    }

    if (!bots || bots.length === 0) {
      return NextResponse.json({ 
        error: "Nenhum bot encontrado no sistema"
      }, { status: 404 })
    }

    // Analisar cada bot
    const botsAnalysis = await Promise.all(bots.map(async (bot) => {
      // 2. Buscar flow_bots para encontrar fluxos conectados
      const { data: flowBots } = await supabase
        .from("flow_bots")
        .select("flow_id")
        .eq("bot_id", bot.id)

      // 3. Buscar flows diretamente conectados ao bot
      const { data: directFlows } = await supabase
        .from("flows")
        .select("id, name, config, is_active, status")
        .eq("bot_id", bot.id)

      // 4. Buscar flows via flow_bots
      let flowBotsFlows: { id: string; name: string; config: Record<string, unknown>; is_active: boolean; status: string }[] = []
      if (flowBots && flowBots.length > 0) {
        const flowIds = flowBots.map(fb => fb.flow_id)
        const { data } = await supabase
          .from("flows")
          .select("id, name, config, is_active, status")
          .in("id", flowIds)
        flowBotsFlows = (data || []) as typeof flowBotsFlows
      }

      // Combinar todos os fluxos (remover duplicados)
      const allFlowsMap = new Map<string, typeof directFlows[0]>()
      for (const f of [...(directFlows || []), ...flowBotsFlows]) {
        if (!allFlowsMap.has(f.id)) {
          allFlowsMap.set(f.id, f)
        }
      }
      const allFlows = Array.from(allFlowsMap.values())
      
      // Filtrar apenas ativos
      const activeFlows = allFlows.filter(f => f.is_active || f.status === "active")

      // Analisar cada fluxo
      const flowsAnalysis = allFlows.map(flow => {
        const config = (flow.config || {}) as Record<string, unknown>
        const orderBump = config.orderBump as { enabled?: boolean; packs?: { enabled?: boolean; name?: string; price?: number; description?: string } } | null
        const orderBumpPacks = orderBump?.packs || null

        const wouldShow = !!(
          orderBump?.enabled && 
          orderBumpPacks?.enabled && 
          orderBumpPacks?.price && 
          orderBumpPacks.price > 0
        )

        let reason = "OK - Order Bump SERA mostrado!"
        if (!orderBump) {
          reason = "orderBump NAO EXISTE no config"
        } else if (!orderBump.enabled) {
          reason = "orderBump.enabled = false"
        } else if (!orderBumpPacks) {
          reason = "orderBump.packs NAO EXISTE"
        } else if (!orderBumpPacks.enabled) {
          reason = "orderBump.packs.enabled = false"
        } else if (!orderBumpPacks.price || orderBumpPacks.price <= 0) {
          reason = `orderBump.packs.price = ${orderBumpPacks.price || 0} (precisa ser > 0)`
        }

        return {
          flowId: flow.id,
          flowName: flow.name,
          isActive: flow.is_active || flow.status === "active",
          configKeys: Object.keys(config),
          orderBump: {
            exists: !!orderBump,
            enabled: orderBump?.enabled || false,
            rawValue: orderBump
          },
          orderBumpPacks: {
            exists: !!orderBumpPacks,
            enabled: orderBumpPacks?.enabled || false,
            price: orderBumpPacks?.price || 0,
            name: orderBumpPacks?.name || null,
            rawValue: orderBumpPacks
          },
          RESULTADO: wouldShow ? "VAI MOSTRAR ORDER BUMP" : "NAO VAI MOSTRAR",
          reason
        }
      })

      // Qual fluxo seria usado (primeiro ativo)
      const activeFlow = activeFlows[0] || null
      const activeFlowAnalysis = flowsAnalysis.find(f => f.flowId === activeFlow?.id)
      
      return {
        bot: {
          id: bot.id,
          name: bot.name,
          username: bot.username
        },
        resumo: {
          totalFluxos: allFlows.length,
          fluxosAtivos: activeFlows.length,
          fluxoQueSeriaUsado: activeFlow?.name || "NENHUM",
          orderBumpVaiMostrar: activeFlowAnalysis?.RESULTADO || "N/A"
        },
        fluxos: flowsAnalysis
      }
    }))

    return NextResponse.json({
      message: "Debug Order Bump Packs",
      totalBots: bots.length,
      bots: botsAnalysis
    })

  } catch (error) {
    console.error("Debug error:", error)
    return NextResponse.json({ 
      error: "Erro ao processar",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
