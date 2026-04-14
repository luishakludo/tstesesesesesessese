import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

// GET - Testa downsell automaticamente
// /api/test/downsell - Lista todos os fluxos e bots
// /api/test/downsell?flow_id=xxx - Simula downsell de um fluxo especifico
// /api/test/downsell?flow_id=xxx&minutos=3 - Simula como se 3 minutos tivessem passado
// /api/test/downsell?flow_id=xxx&vincular_bot=yyy - Vincula o fluxo a um bot
export async function GET(request: Request) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(request.url)
  const flowId = searchParams.get("flow_id")
  const minutos = parseInt(searchParams.get("minutos") || "0")
  const vincularBot = searchParams.get("vincular_bot")

  try {
    // Se passou vincular_bot, faz a vinculacao primeiro
    if (flowId && vincularBot) {
      // Buscar o bot pelo nome ou ID
      const { data: bot, error: botError } = await supabase
        .from("bots")
        .select("id, name, token")
        .or(`id.eq.${vincularBot},name.ilike.%${vincularBot}%`)
        .limit(1)
        .single()

      if (botError || !bot) {
        return NextResponse.json({
          status: "ERRO",
          erro: "Bot nao encontrado",
          busca: vincularBot,
          dica: "Use o ID ou nome do bot"
        }, { status: 404 })
      }

      // Vincular o fluxo ao bot
      const { error: updateError } = await supabase
        .from("flows")
        .update({ bot_id: bot.id })
        .eq("id", flowId)

      if (updateError) {
        return NextResponse.json({
          status: "ERRO",
          erro: "Erro ao vincular bot",
          detalhes: updateError.message
        }, { status: 500 })
      }

      return NextResponse.json({
        status: "VINCULADO",
        flow_id: flowId,
        bot_id: bot.id,
        bot_name: bot.name,
        mensagem: `Fluxo vinculado ao bot "${bot.name}" com sucesso!`,
        proximo_passo: `/api/test/downsell?flow_id=${flowId}`
      })
    }

    // Se passou flow_id, faz simulacao completa automatica
    if (flowId) {
      const { data: flow, error: flowError } = await supabase
        .from("flows")
        .select("id, name, config, status, bot_id")
        .eq("id", flowId)
        .single()

      if (flowError || !flow) {
        return NextResponse.json({ 
          erro: "Fluxo nao encontrado", 
          flow_id: flowId, 
          detalhes: flowError?.message 
        }, { status: 404 })
      }

      // Buscar bot se existir
      let botToken = null
      let botName = "SEM BOT VINCULADO"
      if (flow.bot_id) {
        const { data: bot } = await supabase
          .from("bots")
          .select("id, name, token")
          .eq("id", flow.bot_id)
          .single()
        if (bot) {
          botToken = bot.token
          botName = bot.name
        }
      }

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

      // Verificar problemas
      const problemas = []
      if (!flow.bot_id) problemas.push("FLUXO SEM BOT VINCULADO - precisa vincular a um bot")
      if (!botToken) problemas.push("BOT SEM TOKEN - nao consegue enviar mensagem")
      if (!downsellConfig?.enabled) problemas.push("DOWNSELL DESATIVADO - precisa ativar")
      if (!downsellConfig?.sequences?.length) problemas.push("SEM SEQUENCIAS - precisa adicionar pelo menos uma")

      if (problemas.length > 0) {
        return NextResponse.json({
          status: "ERRO",
          flow_id: flowId,
          flow_name: flow.name,
          flow_status: flow.status,
          bot_id: flow.bot_id,
          bot_name: botName,
          problemas,
          downsell_config: downsellConfig
        })
      }

      // Simular agendamento
      const now = new Date()
      const simulatedNow = new Date(now.getTime() + minutos * 60 * 1000)
      
      const sequencias = downsellConfig.sequences!.map((seq, index) => {
        let delayMinutes = seq.sendDelayValue || 1
        if (seq.sendDelayUnit === "hours") delayMinutes = (seq.sendDelayValue || 1) * 60
        else if (seq.sendDelayUnit === "days") delayMinutes = (seq.sendDelayValue || 1) * 60 * 24

        const scheduledFor = new Date(now.getTime() + delayMinutes * 60 * 1000)
        const jaPassou = simulatedNow >= scheduledFor
        const faltaMinutos = Math.max(0, Math.round((scheduledFor.getTime() - simulatedNow.getTime()) / 60000))

        return {
          posicao: index + 1,
          id: seq.id,
          delay_configurado: `${seq.sendDelayValue || 1} ${seq.sendDelayUnit || "minutes"}`,
          delay_em_minutos: delayMinutes,
          horario_envio: scheduledFor.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          ja_passou_tempo: jaPassou,
          falta_minutos: faltaMinutos,
          vai_enviar_agora: jaPassou ? "SIM" : "NAO",
          mensagem: seq.message,
          midias: seq.medias?.length || 0,
          planos: seq.plans?.map(p => ({
            texto: p.buttonText,
            preco: `R$ ${p.price.toFixed(2).replace(".", ",")}`
          })) || []
        }
      })

      return NextResponse.json({
        status: "OK",
        simulacao: {
          flow_id: flow.id,
          flow_name: flow.name,
          bot_name: botName,
          agora: now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          simulando_minutos_passados: minutos,
          tempo_simulado: simulatedNow.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
        },
        downsell: {
          ativado: true,
          total_sequencias: sequencias.length,
          sequencias
        },
        explicacao: minutos > 0 
          ? `Simulando como se ${minutos} minuto(s) tivessem passado apos o /start`
          : "Mostrando quando cada sequencia seria enviada apos o /start"
      })
    }

    // Sem flow_id - busca TODOS os fluxos com downsell (independente de bot)
    const { data: flows, error: flowsError } = await supabase
      .from("flows")
      .select("id, name, config, status, bot_id")

    if (flowsError) {
      return NextResponse.json({ erro: "Erro ao buscar fluxos", detalhes: flowsError.message }, { status: 500 })
    }

    const fluxosComDownsell = []
    const fluxosSemDownsell = []

    for (const flow of flows || []) {
      const config = flow.config as Record<string, unknown> || {}
      const downsellConfig = config.downsell as {
        enabled?: boolean
        sequences?: Array<unknown>
      } | undefined

      // Buscar nome do bot
      let botName = "SEM BOT"
      if (flow.bot_id) {
        const { data: bot } = await supabase
          .from("bots")
          .select("name")
          .eq("id", flow.bot_id)
          .single()
        botName = bot?.name || "BOT NAO ENCONTRADO"
      }

      const info = {
        flow_id: flow.id,
        flow_name: flow.name,
        flow_status: flow.status,
        bot_id: flow.bot_id,
        bot_name: botName,
        downsell_enabled: downsellConfig?.enabled || false,
        downsell_sequences: downsellConfig?.sequences?.length || 0,
        link_teste: `/api/test/downsell?flow_id=${flow.id}`
      }

      if (downsellConfig?.enabled && downsellConfig?.sequences?.length) {
        fluxosComDownsell.push(info)
      } else {
        fluxosSemDownsell.push(info)
      }
    }

    // Buscar mensagens pendentes
    const { data: pendentes } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .eq("message_type", "downsell")
      .order("scheduled_for", { ascending: true })

    return NextResponse.json({
      timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      resumo: {
        total_fluxos: flows?.length || 0,
        com_downsell_ativo: fluxosComDownsell.length,
        sem_downsell: fluxosSemDownsell.length,
        mensagens_pendentes: pendentes?.length || 0
      },
      fluxos_com_downsell: fluxosComDownsell,
      fluxos_sem_downsell: fluxosSemDownsell,
      mensagens_pendentes: pendentes?.map(m => ({
        id: m.id,
        flow_id: m.flow_id,
        telegram_user: m.telegram_user_id,
        agendado_para: new Date(m.scheduled_for).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        ja_passou: new Date(m.scheduled_for) < new Date(),
        falta_minutos: Math.round((new Date(m.scheduled_for).getTime() - Date.now()) / 60000)
      })) || [],
      instrucoes: "Use ?flow_id=xxx para testar um fluxo especifico. Use ?flow_id=xxx&minutos=3 para simular passagem de tempo."
    })

  } catch (error) {
    return NextResponse.json({
      erro: "Erro interno",
      detalhes: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
