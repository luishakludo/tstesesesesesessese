import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

// GET - Lista todos os bots com downsell configurado
export async function GET(request: Request) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(request.url)
  const flowId = searchParams.get("flow_id")

  try {
    // Se passou flow_id, busca direto esse fluxo
    if (flowId) {
      const { data: flow, error: flowError } = await supabase
        .from("flows")
        .select("id, name, config, status, bot_id")
        .eq("id", flowId)
        .single()

      if (flowError || !flow) {
        return NextResponse.json({ error: "Fluxo nao encontrado", flow_id: flowId, details: flowError?.message }, { status: 404 })
      }

      const { data: bot } = await supabase
        .from("bots")
        .select("id, name, token")
        .eq("id", flow.bot_id)
        .single()

      const config = flow.config as Record<string, unknown> || {}
      const downsellConfig = config.downsell as {
        enabled?: boolean
        sequences?: Array<{
          id: string
          message: string
          medias?: string[]
          sendTiming?: string
          sendDelayValue?: number
          sendDelayUnit?: string
          plans?: Array<{ id: string; buttonText: string; price: number }>
        }>
      } | undefined

      return NextResponse.json({
        timestamp: new Date().toISOString(),
        flow: {
          id: flow.id,
          name: flow.name,
          status: flow.status,
          bot_id: flow.bot_id,
          bot_name: bot?.name || "N/A"
        },
        downsell_enabled: downsellConfig?.enabled || false,
        downsell_sequences: downsellConfig?.sequences?.length || 0,
        downsell_config: downsellConfig,
        config_completo: config
      })
    }

    // 1. Buscar todos os bots (ativos e inativos para debug)
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("id, name, token, status")

    if (botsError) {
      return NextResponse.json({ error: "Erro ao buscar bots", details: botsError.message }, { status: 500 })
    }

    if (!bots || bots.length === 0) {
      return NextResponse.json({ message: "Nenhum bot encontrado", bots: [] })
    }

    const results = []

    for (const bot of bots) {
      // Buscar TODOS os fluxos do bot (nao apenas ativos)
      const { data: flows } = await supabase
        .from("flows")
        .select("id, name, config, status")
        .eq("bot_id", bot.id)

      if (!flows || flows.length === 0) {
        results.push({
          bot_id: bot.id,
          bot_name: bot.name,
          status: "SEM_FLUXO_ATIVO",
          downsell: null
        })
        continue
      }

      const flow = flows[0]
      const config = flow.config as Record<string, unknown> || {}
      const downsellConfig = config.downsell as {
        enabled?: boolean
        sequences?: Array<{
          id: string
          message: string
          medias?: string[]
          sendTiming?: string
          sendDelayValue?: number
          sendDelayUnit?: string
          plans?: Array<{ id: string; buttonText: string; price: number }>
        }>
      } | undefined

      if (!downsellConfig?.enabled || !downsellConfig.sequences?.length) {
        results.push({
          bot_id: bot.id,
          bot_name: bot.name,
          flow_id: flow.id,
          flow_name: flow.name,
          status: "DOWNSELL_DESATIVADO",
          downsell: downsellConfig
        })
        continue
      }

      const now = new Date()
      const sequencesInfo = downsellConfig.sequences.map((seq, index) => {
        let delayMinutes = seq.sendDelayValue || 1
        if (seq.sendDelayUnit === "hours") delayMinutes = (seq.sendDelayValue || 1) * 60
        else if (seq.sendDelayUnit === "days") delayMinutes = (seq.sendDelayValue || 1) * 60 * 24

        const scheduledFor = new Date(now.getTime() + delayMinutes * 60 * 1000)

        return {
          index,
          id: seq.id,
          message_preview: seq.message?.substring(0, 50) + (seq.message?.length > 50 ? "..." : ""),
          delay_config: `${seq.sendDelayValue || 1} ${seq.sendDelayUnit || "minutes"}`,
          delay_minutes: delayMinutes,
          seria_enviado_em: scheduledFor.toISOString(),
          plans_count: seq.plans?.length || 0,
          medias_count: seq.medias?.length || 0
        }
      })

      results.push({
        bot_id: bot.id,
        bot_name: bot.name,
        flow_id: flow.id,
        flow_name: flow.name,
        status: "DOWNSELL_CONFIGURADO",
        total_sequences: downsellConfig.sequences.length,
        sequences: sequencesInfo
      })
    }

    // Buscar mensagens agendadas pendentes
    const { data: pendingMessages } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .eq("message_type", "downsell")
      .order("scheduled_for", { ascending: true })

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      total_bots: bots.length,
      bots_com_downsell: results.filter(r => r.status === "DOWNSELL_CONFIGURADO").length,
      results,
      mensagens_pendentes: {
        total: pendingMessages?.length || 0,
        mensagens: pendingMessages?.map(m => ({
          id: m.id,
          bot_id: m.bot_id,
          telegram_user_id: m.telegram_user_id,
          sequence_id: m.sequence_id,
          scheduled_for: m.scheduled_for,
          status: m.status,
          ja_passou: new Date(m.scheduled_for) < new Date(),
          falta_minutos: Math.round((new Date(m.scheduled_for).getTime() - Date.now()) / 60000)
        })) || []
      }
    })

  } catch (error) {
    return NextResponse.json({
      error: "Erro interno",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// POST - Simula agendamento de downsells
export async function POST(request: Request) {
  const supabase = getSupabaseAdmin()

  try {
    const body = await request.json().catch(() => ({}))
    const {
      simulate_time_passed_minutes = 0,
      dry_run = true,
      bot_id = null,
      telegram_user_id = "TEST_USER_123"
    } = body

    let botsQuery = supabase
      .from("bots")
      .select("id, name, token, status")
      .eq("status", "active")

    if (bot_id) {
      botsQuery = botsQuery.eq("id", bot_id)
    }

    const { data: bots, error: botsError } = await botsQuery

    if (botsError || !bots || bots.length === 0) {
      return NextResponse.json({ error: "Nenhum bot encontrado", details: botsError?.message }, { status: 404 })
    }

    const simulationResults = []
    const now = new Date()
    const simulatedNow = new Date(now.getTime() + simulate_time_passed_minutes * 60 * 1000)

    for (const bot of bots) {
      const { data: flows } = await supabase
        .from("flows")
        .select("id, name, config")
        .eq("bot_id", bot.id)
        .eq("status", "ativo")
        .limit(1)

      if (!flows || flows.length === 0) {
        simulationResults.push({
          bot_id: bot.id,
          bot_name: bot.name,
          status: "SEM_FLUXO",
          actions: []
        })
        continue
      }

      const flow = flows[0]
      const config = flow.config as Record<string, unknown> || {}
      const downsellConfig = config.downsell as {
        enabled?: boolean
        sequences?: Array<{
          id: string
          message: string
          medias?: string[]
          sendTiming?: string
          sendDelayValue?: number
          sendDelayUnit?: string
          plans?: Array<{ id: string; buttonText: string; price: number }>
          deliveryType?: string
          deliverableId?: string
          customDelivery?: string
        }>
      } | undefined

      if (!downsellConfig?.enabled || !downsellConfig.sequences?.length) {
        simulationResults.push({
          bot_id: bot.id,
          bot_name: bot.name,
          status: "DOWNSELL_DESATIVADO",
          actions: []
        })
        continue
      }

      const actions = []

      for (const seq of downsellConfig.sequences) {
        let delayMinutes = seq.sendDelayValue || 1
        if (seq.sendDelayUnit === "hours") delayMinutes = (seq.sendDelayValue || 1) * 60
        else if (seq.sendDelayUnit === "days") delayMinutes = (seq.sendDelayValue || 1) * 60 * 24

        const scheduledFor = new Date(now.getTime() + delayMinutes * 60 * 1000)
        const shouldSendNow = simulatedNow >= scheduledFor

        const action: Record<string, unknown> = {
          sequence_id: seq.id,
          sequence_index: downsellConfig.sequences.indexOf(seq),
          delay_config: `${seq.sendDelayValue || 1} ${seq.sendDelayUnit || "minutes"}`,
          delay_minutes: delayMinutes,
          scheduled_for: scheduledFor.toISOString(),
          simulated_now: simulatedNow.toISOString(),
          should_send_now: shouldSendNow,
          message_preview: seq.message?.substring(0, 100),
          plans: seq.plans || [],
          will_insert_to_db: !dry_run
        }

        if (!dry_run) {
          const { data: inserted, error: insertError } = await supabase
            .from("scheduled_messages")
            .insert({
              bot_id: bot.id,
              flow_id: flow.id,
              telegram_user_id: telegram_user_id,
              telegram_chat_id: telegram_user_id,
              message_type: "downsell",
              sequence_id: seq.id,
              sequence_index: downsellConfig.sequences.indexOf(seq),
              scheduled_for: scheduledFor.toISOString(),
              status: "pending",
              metadata: {
                message: seq.message,
                medias: seq.medias || [],
                plans: seq.plans || [],
                deliveryType: seq.deliveryType,
                deliverableId: seq.deliverableId,
                customDelivery: seq.customDelivery,
                botToken: bot.token,
                is_test: true
              }
            })
            .select()

          action.inserted = inserted?.[0] || null
          action.insert_error = insertError?.message || null
        }

        actions.push(action)
      }

      simulationResults.push({
        bot_id: bot.id,
        bot_name: bot.name,
        flow_id: flow.id,
        flow_name: flow.name,
        status: "SIMULADO",
        total_sequences: downsellConfig.sequences.length,
        actions
      })
    }

    return NextResponse.json({
      simulation: {
        timestamp_real: now.toISOString(),
        simulated_time_passed: `${simulate_time_passed_minutes} minutos`,
        timestamp_simulado: simulatedNow.toISOString(),
        dry_run,
        telegram_user_id
      },
      total_bots: bots.length,
      results: simulationResults
    })

  } catch (error) {
    return NextResponse.json({
      error: "Erro interno",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
