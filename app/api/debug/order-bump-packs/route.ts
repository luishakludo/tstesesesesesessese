import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  try {
    // 1. Buscar todos os bots (para debug - sem auth)
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("id, name, token")
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

    // 2. Buscar todos os registros de flow_bots COM os dados do flow via join
    const { data: allFlowBots, error: flowBotsError } = await supabase
      .from("flow_bots")
      .select(`
        *,
        flows:flow_id (
          id,
          name,
          config,
          status,
          bot_id,
          user_id
        )
      `)
    
    // 3. Extrair os flows dos flow_bots (contorna RLS)
    const allSystemFlows = (allFlowBots || [])
      .map(fb => fb.flows)
      .filter(Boolean) as { id: string; name: string; config: Record<string, unknown>; status: string; bot_id: string; user_id: string }[]
    
    console.log("[v0] flowBotsError:", flowBotsError?.message)
    console.log("[v0] allFlowBots count:", allFlowBots?.length)
    console.log("[v0] allSystemFlows extracted:", allSystemFlows?.length)

    // Analisar cada bot
    const botsAnalysis = await Promise.all(bots.map(async (bot) => {
      // Buscar flows via flow_bots COM join (contorna RLS)
      const { data: flowBotsWithFlows } = await supabase
        .from("flow_bots")
        .select(`
          flow_id,
          flows:flow_id (
            id,
            name,
            config,
            status
          )
        `)
        .eq("bot_id", bot.id)
      
      // Extrair os flows do join
      const allFlows = (flowBotsWithFlows || [])
        .map(fb => fb.flows as { id: string; name: string; config: Record<string, unknown>; status: string } | null)
        .filter(Boolean) as { id: string; name: string; config: Record<string, unknown>; status: string }[]
      
      // Filtrar apenas ativos (aceitando "ativo" ou "active")
      const activeFlows = allFlows.filter(f => f.status === "active" || f.status === "ativo")

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
          isActive: flow.status === "active" || flow.status === "ativo",
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
          name: bot.name
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
      bots: botsAnalysis,
      debug: {
        totalFlowsNoSistema: allSystemFlows?.length || 0,
        flowsComOrderBump: allSystemFlows?.filter(f => {
          const config = (f.config || {}) as Record<string, unknown>
          const ob = config.orderBump as Record<string, unknown> | undefined
          return ob?.enabled
        }).map(f => ({
          id: f.id,
          name: f.name,
          status: f.status,
          bot_id: f.bot_id,
          orderBumpConfig: (f.config as Record<string, unknown>)?.orderBump
        })) || [],
        totalFlowBots: allFlowBots?.length || 0,
        flowBotsRecords: allFlowBots || []
      }
    })

  } catch (error) {
    console.error("Debug error:", error)
    return NextResponse.json({ 
      error: "Erro ao processar",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
