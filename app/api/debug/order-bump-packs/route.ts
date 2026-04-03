import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  // Autenticar usuario
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nao autenticado. Faca login primeiro." }, { status: 401 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // 1. Buscar todos os bots do usuario
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("id, name, username")
      .eq("user_id", session.user.id)

    if (botsError) {
      return NextResponse.json({ 
        error: "Erro ao buscar bots",
        details: botsError.message 
      }, { status: 500 })
    }

    if (!bots || bots.length === 0) {
      return NextResponse.json({ 
        error: "Voce nao tem nenhum bot cadastrado",
        userId: session.user.id
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
        .select("id, name, config, is_active")
        .eq("bot_id", bot.id)

      // 4. Buscar flows via flow_bots
      let flowBotsFlows: { id: string; name: string; config: Record<string, unknown>; is_active: boolean }[] = []
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
        const config = (flow.config || {}) as Record<string, unknown>
        const orderBump = config.orderBump as { enabled?: boolean; packs?: { enabled?: boolean; name?: string; price?: number; description?: string } } | null
        const orderBumpPacks = orderBump?.packs || null

        const wouldShow = !!(
          orderBump?.enabled && 
          orderBumpPacks?.enabled && 
          orderBumpPacks?.price && 
          orderBumpPacks.price > 0
        )

        return {
          flowId: flow.id,
          flowName: flow.name,
          isActive: flow.is_active,
          orderBumpEnabled: orderBump?.enabled || false,
          orderBumpPacksEnabled: orderBumpPacks?.enabled || false,
          orderBumpPacksPrice: orderBumpPacks?.price || 0,
          orderBumpPacksName: orderBumpPacks?.name || null,
          wouldShowOrderBump: wouldShow,
          reason: !orderBump?.enabled 
            ? "Order Bump DESABILITADO"
            : !orderBumpPacks?.enabled 
              ? "Order Bump de PACKS desabilitado"
              : !orderBumpPacks?.price 
                ? "Preco nao definido"
                : orderBumpPacks.price <= 0
                  ? "Preco é 0 ou negativo"
                  : "OK - Order Bump SERA mostrado!"
        }
      })

      // Qual fluxo seria usado (primeiro ativo)
      const activeFlow = activeFlows[0] || null
      
      return {
        bot: {
          id: bot.id,
          name: bot.name,
          username: bot.username
        },
        totalFlows: allFlows.length,
        activeFlows: activeFlows.length,
        flowsWithOrderBumpEnabled: flowsAnalysis.filter(f => f.wouldShowOrderBump).length,
        wouldUseFlowId: activeFlow?.id || null,
        wouldUseFlowName: activeFlow?.name || null,
        flows: flowsAnalysis
      }
    }))

    return NextResponse.json({
      userId: session.user.id,
      userEmail: session.user.email,
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
