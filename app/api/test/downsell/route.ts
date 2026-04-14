import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const results: Array<{
    bot_id: string
    bot_name: string
    flow_id: string
    downsell_enabled: boolean
    sequences: Array<{
      id: string
      message: string
      delay_minutes: number
      scheduled_for: string
      plans: Array<{ id: string; buttonText: string; price: number }>
    }>
    simulation: {
      would_send: boolean
      reason: string
    }
  }> = []

  try {
    // 1. Buscar todos os bots ativos
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("id, name, token, user_id")
      .eq("status", "ativo")

    if (botsError) {
      return NextResponse.json({ error: "Erro ao buscar bots", details: botsError.message }, { status: 500 })
    }

    if (!bots || bots.length === 0) {
      return NextResponse.json({ message: "Nenhum bot ativo encontrado", results: [] })
    }

    // 2. Para cada bot, buscar flow ativo e verificar downsell
    for (const bot of bots) {
      const { data: flow } = await supabase
        .from("flows")
        .select("id, config")
        .eq("bot_id", bot.id)
        .eq("status", "ativo")
        .limit(1)
        .single()

      if (!flow) {
        results.push({
          bot_id: bot.id,
          bot_name: bot.name || "Sem nome",
          flow_id: "",
          downsell_enabled: false,
          sequences: [],
          simulation: {
            would_send: false,
            reason: "Nenhum flow ativo encontrado"
          }
        })
        continue
      }

      const flowConfig = (flow.config as Record<string, unknown>) || {}
      const downsellConfig = flowConfig.downsell as {
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
        }>
      } | undefined

      if (!downsellConfig?.enabled || !downsellConfig.sequences?.length) {
        results.push({
          bot_id: bot.id,
          bot_name: bot.name || "Sem nome",
          flow_id: flow.id,
          downsell_enabled: false,
          sequences: [],
          simulation: {
            would_send: false,
            reason: "Downsell nao habilitado ou sem sequencias"
          }
        })
        continue
      }

      // 3. Processar cada sequencia de downsell
      const now = new Date()
      const sequences = downsellConfig.sequences.map(seq => {
        let delayMinutes = seq.sendDelayValue || 1
        if (seq.sendDelayUnit === "hours") delayMinutes = (seq.sendDelayValue || 1) * 60
        else if (seq.sendDelayUnit === "days") delayMinutes = (seq.sendDelayValue || 1) * 60 * 24

        const scheduledFor = new Date(now.getTime() + delayMinutes * 60 * 1000)

        return {
          id: seq.id,
          message: seq.message || "(sem mensagem)",
          delay_minutes: delayMinutes,
          scheduled_for: scheduledFor.toISOString(),
          plans: seq.plans || []
        }
      })

      results.push({
        bot_id: bot.id,
        bot_name: bot.name || "Sem nome",
        flow_id: flow.id,
        downsell_enabled: true,
        sequences,
        simulation: {
          would_send: true,
          reason: `${sequences.length} downsell(s) seriam agendados`
        }
      })
    }

    return NextResponse.json({
      message: "Simulacao concluida",
      timestamp: new Date().toISOString(),
      total_bots: bots.length,
      bots_with_downsell: results.filter(r => r.downsell_enabled).length,
      results
    })

  } catch (error) {
    return NextResponse.json({ 
      error: "Erro na simulacao", 
      details: error instanceof Error ? error.message : "Erro desconhecido" 
    }, { status: 500 })
  }
}

// POST - Simula um /start completo e agenda os downsells de verdade (para teste)
export async function POST(request: Request) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    const body = await request.json().catch(() => ({}))
    const { simulate_time_passed_minutes = 0, dry_run = true } = body

    // 1. Buscar todos os bots ativos com downsell
    const { data: bots } = await supabase
      .from("bots")
      .select("id, name, token")
      .eq("status", "ativo")

    if (!bots || bots.length === 0) {
      return NextResponse.json({ message: "Nenhum bot encontrado" })
    }

    const testResults: Array<{
      bot_id: string
      bot_name: string
      scheduled_messages: Array<{
        sequence_id: string
        scheduled_for: string
        would_be_sent_now: boolean
        time_until_send_minutes: number
      }>
      cron_simulation: {
        messages_that_would_send: number
        details: string[]
      }
    }> = []

    for (const bot of bots) {
      const { data: flow } = await supabase
        .from("flows")
        .select("id, config")
        .eq("bot_id", bot.id)
        .eq("status", "ativo")
        .limit(1)
        .single()

      if (!flow) continue

      const flowConfig = (flow.config as Record<string, unknown>) || {}
      const downsellConfig = flowConfig.downsell as {
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

      if (!downsellConfig?.enabled || !downsellConfig.sequences?.length) continue

      const now = new Date()
      const simulatedNow = new Date(now.getTime() + simulate_time_passed_minutes * 60 * 1000)
      
      const scheduledMessages: Array<{
        sequence_id: string
        scheduled_for: string
        would_be_sent_now: boolean
        time_until_send_minutes: number
      }> = []

      const cronDetails: string[] = []
      let messagesThatWouldSend = 0

      // Simular agendamento de cada sequencia
      for (const seq of downsellConfig.sequences) {
        let delayMinutes = seq.sendDelayValue || 1
        if (seq.sendDelayUnit === "hours") delayMinutes = (seq.sendDelayValue || 1) * 60
        else if (seq.sendDelayUnit === "days") delayMinutes = (seq.sendDelayValue || 1) * 60 * 24

        const scheduledFor = new Date(now.getTime() + delayMinutes * 60 * 1000)
        const wouldBeSentNow = simulatedNow >= scheduledFor
        const timeUntilSend = Math.round((scheduledFor.getTime() - simulatedNow.getTime()) / 60000)

        scheduledMessages.push({
          sequence_id: seq.id,
          scheduled_for: scheduledFor.toISOString(),
          would_be_sent_now: wouldBeSentNow,
          time_until_send_minutes: timeUntilSend
        })

        if (wouldBeSentNow) {
          messagesThatWouldSend++
          cronDetails.push(`[ENVIARIA] Seq ${seq.id}: "${seq.message?.substring(0, 50)}..." com ${seq.plans?.length || 0} plano(s)`)
        } else {
          cronDetails.push(`[AGUARDANDO] Seq ${seq.id}: faltam ${Math.abs(timeUntilSend)} minutos`)
        }

        // Se nao for dry_run, realmente insere no banco
        if (!dry_run) {
          await supabase.from("scheduled_messages").insert({
            bot_id: bot.id,
            flow_id: flow.id,
            telegram_user_id: "TEST_USER_" + Date.now(),
            telegram_chat_id: "TEST_CHAT_" + Date.now(),
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
        }
      }

      testResults.push({
        bot_id: bot.id,
        bot_name: bot.name || "Sem nome",
        scheduled_messages: scheduledMessages,
        cron_simulation: {
          messages_that_would_send: messagesThatWouldSend,
          details: cronDetails
        }
      })
    }

    return NextResponse.json({
      message: dry_run ? "Simulacao concluida (dry run)" : "Teste executado - mensagens agendadas no banco",
      timestamp: new Date().toISOString(),
      simulated_time_passed_minutes: simulate_time_passed_minutes,
      dry_run,
      results: testResults
    })

  } catch (error) {
    return NextResponse.json({ 
      error: "Erro no teste", 
      details: error instanceof Error ? error.message : "Erro desconhecido" 
    }, { status: 500 })
  }
}
