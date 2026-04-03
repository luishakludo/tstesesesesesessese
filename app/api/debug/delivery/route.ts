import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const botId = searchParams.get("bot_id")
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // 1. Buscar bot
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, name, token, user_id")
      .eq("id", botId)
      .single()

    if (botError || !bot) {
      return NextResponse.json({ 
        error: "Bot nao encontrado",
        details: botError?.message 
      }, { status: 404 })
    }

    // 2. Buscar flow direto pelo bot_id
    const { data: directFlow, error: directFlowError } = await supabase
      .from("flows")
      .select("id, name, config, status")
      .eq("bot_id", botId)
      .limit(1)
      .single()

    // 3. Buscar flow via flow_bots
    const { data: flowBotLink, error: flowBotError } = await supabase
      .from("flow_bots")
      .select("flow_id")
      .eq("bot_id", botId)
      .limit(1)
      .single()

    let flowViaFlowBots = null
    if (flowBotLink?.flow_id) {
      const { data: flowData } = await supabase
        .from("flows")
        .select("id, name, config, status")
        .eq("id", flowBotLink.flow_id)
        .single()
      flowViaFlowBots = flowData
    }

    // Usar o flow que foi encontrado
    const flow = directFlow || flowViaFlowBots
    const flowConfig = flow?.config as Record<string, unknown> | null

    // Analisar entregaveis
    const deliverables = (flowConfig?.deliverables || []) as Array<{id: string; name: string; type: string}>
    const mainDeliverableId = flowConfig?.mainDeliverableId as string | null
    const mainDeliverable = deliverables.find(d => d.id === mainDeliverableId)
    const delivery = flowConfig?.delivery as Record<string, unknown> | null

    // Verificar o que seria entregue
    let entregaResult = "NADA SERIA ENTREGUE"
    let entregaReason = ""

    if (mainDeliverableId && mainDeliverable) {
      entregaResult = "ENTREGAVEL PRINCIPAL"
      entregaReason = `Entregavel "${mainDeliverable.name}" (tipo: ${mainDeliverable.type})`
    } else if (deliverables.length > 0) {
      entregaResult = "SEM ENTREGAVEL PRINCIPAL"
      entregaReason = `Existem ${deliverables.length} entregaveis, mas nenhum foi selecionado como principal`
    } else if (delivery) {
      entregaResult = "SISTEMA ANTIGO (delivery)"
      entregaReason = `Usando sistema antigo de entrega`
    } else {
      entregaResult = "NENHUMA ENTREGA CONFIGURADA"
      entregaReason = "Nao ha entregaveis nem delivery configurado"
    }

    return NextResponse.json({
      bot: {
        id: bot.id,
        name: bot.name,
        user_id: bot.user_id
      },
      flowSearch: {
        directFlow: directFlow ? { id: directFlow.id, name: directFlow.name } : null,
        directFlowError: directFlowError?.message || null,
        flowBotLink: flowBotLink?.flow_id || null,
        flowBotError: flowBotError?.message || null,
        flowViaFlowBots: flowViaFlowBots ? { id: flowViaFlowBots.id, name: flowViaFlowBots.name } : null
      },
      flowUsado: flow ? { id: flow.id, name: flow.name, status: flow.status } : null,
      configKeys: flowConfig ? Object.keys(flowConfig) : [],
      entregaveis: {
        total: deliverables.length,
        mainDeliverableId: mainDeliverableId || "NAO DEFINIDO",
        mainDeliverable: mainDeliverable || null,
        lista: deliverables.map(d => ({ id: d.id, name: d.name, type: d.type }))
      },
      sistemaAntigo: {
        delivery: delivery ? {
          type: delivery.type,
          hasVipGroupId: !!delivery.vipGroupId,
          hasLink: !!delivery.link,
          hasMedias: Array.isArray(delivery.medias) && delivery.medias.length > 0
        } : null
      },
      RESULTADO: {
        oQueSeriaEntregue: entregaResult,
        razao: entregaReason
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
