import { getSupabaseAdmin } from "@/lib/supabase"
import { NextRequest, NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// Telegram helpers - Envio de mensagens
// ---------------------------------------------------------------------------
async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  replyMarkup?: unknown
) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  }
  if (replyMarkup) body.reply_markup = replyMarkup
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function sendTelegramPhoto(
  botToken: string,
  chatId: number | string,
  photoUrl: string,
  caption?: string
) {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
    parse_mode: "HTML",
  }
  if (caption) body.caption = caption
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function sendTelegramVideo(
  botToken: string,
  chatId: number | string,
  videoUrl: string,
  caption?: string
) {
  const url = `https://api.telegram.org/bot${botToken}/sendVideo`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    video: videoUrl,
    parse_mode: "HTML",
  }
  if (caption) body.caption = caption
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

// ---------------------------------------------------------------------------
// POST /api/test/downsell - DISPARA TESTE DE DOWNSELL INSTANTANEO
// Params:
//   - botId: ID do bot (opcional, se nao passar testa todos)
//   - flowId: ID do fluxo (opcional)
//   - telegramChatId: Chat ID do Telegram para enviar o teste
//   - sequenceIndex: Index da sequencia (opcional, 0 = primeira, -1 = todas)
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  
  try {
    const body = await request.json()
    const { botId, flowId, telegramChatId, sequenceIndex = 0 } = body

    if (!telegramChatId) {
      return NextResponse.json({ 
        erro: "telegramChatId obrigatorio - envie o chat_id do Telegram onde quer receber o teste" 
      }, { status: 400 })
    }

    // Se passou flowId, busca direto
    let targetFlow: {
      id: string
      name: string
      bot_id: string | null
      config: Record<string, unknown>
    } | null = null

    if (flowId) {
      const { data: flow } = await supabase
        .from("flows")
        .select("id, name, bot_id, config")
        .eq("id", flowId)
        .single()
      targetFlow = flow
    } else if (botId) {
      // Busca via flow_bots ou direto
      const { data: flowBot } = await supabase
        .from("flow_bots")
        .select("flow_id")
        .eq("bot_id", botId)
        .limit(1)
        .single()
      
      if (flowBot?.flow_id) {
        const { data: flow } = await supabase
          .from("flows")
          .select("id, name, bot_id, config")
          .eq("id", flowBot.flow_id)
          .single()
        targetFlow = flow
      } else {
        // Fallback: busca direto pelo bot_id
        const { data: flow } = await supabase
          .from("flows")
          .select("id, name, bot_id, config")
          .eq("bot_id", botId)
          .limit(1)
          .single()
        targetFlow = flow
      }
    } else {
      // Busca primeiro fluxo que tenha downsell ativo
      const { data: flows } = await supabase
        .from("flows")
        .select("id, name, bot_id, config")
      
      for (const flow of flows || []) {
        const config = (flow.config as Record<string, unknown>) || {}
        const downsell = config.downsell as { enabled?: boolean; sequences?: unknown[] }
        if (downsell?.enabled && downsell?.sequences?.length) {
          targetFlow = flow
          break
        }
      }
    }

    if (!targetFlow) {
      return NextResponse.json({ 
        erro: "Nenhum fluxo encontrado com downsell ativo",
        dica: "Passe botId ou flowId, ou certifique-se de ter um fluxo com downsell habilitado"
      }, { status: 404 })
    }

    // Buscar bot vinculado
    let botToken: string | null = null
    let botUuid: string | null = targetFlow.bot_id

    // Se nao tem bot_id direto, busca via flow_bots
    if (!botUuid) {
      const { data: flowBot } = await supabase
        .from("flow_bots")
        .select("bot_id")
        .eq("flow_id", targetFlow.id)
        .limit(1)
        .single()
      botUuid = flowBot?.bot_id || null
    }

    if (botUuid) {
      const { data: bot } = await supabase
        .from("bots")
        .select("id, name, token")
        .eq("id", botUuid)
        .single()
      
      if (bot?.token) {
        botToken = bot.token
      }
    }

    if (!botToken) {
      return NextResponse.json({ 
        erro: "Bot sem token configurado",
        flowId: targetFlow.id,
        flowName: targetFlow.name,
        dica: "Configure o token do bot vinculado a esse fluxo"
      }, { status: 400 })
    }

    // Extrair config de downsell
    const config = (targetFlow.config as Record<string, unknown>) || {}
    const downsell = config.downsell as {
      enabled?: boolean
      sequences?: Array<{
        id: string
        message: string
        medias?: string[]
        sendDelayValue?: number
        sendDelayUnit?: string
        plans?: Array<{ id: string; buttonText: string; price: number }>
      }>
    }

    if (!downsell?.enabled) {
      return NextResponse.json({ 
        erro: "Downsell desabilitado neste fluxo",
        flowId: targetFlow.id,
        flowName: targetFlow.name
      }, { status: 400 })
    }

    if (!downsell?.sequences?.length) {
      return NextResponse.json({ 
        erro: "Nenhuma sequencia de downsell configurada",
        flowId: targetFlow.id,
        flowName: targetFlow.name
      }, { status: 400 })
    }

    // Determinar quais sequencias disparar
    const sequencesToSend = sequenceIndex === -1 
      ? downsell.sequences 
      : [downsell.sequences[sequenceIndex] || downsell.sequences[0]]

    const resultados: Array<{
      sequenceId: string
      sequenceIndex: number
      message: string
      medias: number
      plans: number
      delay: string
      enviado: boolean
      telegram_response?: unknown
      erro?: string
    }> = []

    // Disparar cada sequencia
    for (let i = 0; i < sequencesToSend.length; i++) {
      const seq = sequencesToSend[i]
      const seqIndex = sequenceIndex === -1 ? i : sequenceIndex

      try {
        const message = seq.message || "(mensagem vazia)"
        const medias = seq.medias || []
        const plans = seq.plans || []

        // Montar delay info (apenas informativo, nao vamos esperar)
        let delayInfo = `${seq.sendDelayValue || 0} ${seq.sendDelayUnit || "min"}`
        
        let telegramResponse: unknown = null

        // Enviar midias (se tiver)
        if (medias.length > 0) {
          const firstMedia = medias[0]
          if (firstMedia.includes("video") || firstMedia.includes("mp4")) {
            telegramResponse = await sendTelegramVideo(botToken!, telegramChatId, firstMedia, message)
          } else {
            telegramResponse = await sendTelegramPhoto(botToken!, telegramChatId, firstMedia, message)
          }
          
          // Enviar demais midias
          for (let m = 1; m < medias.length; m++) {
            const media = medias[m]
            if (media.includes("video") || media.includes("mp4")) {
              await sendTelegramVideo(botToken!, telegramChatId, media)
            } else {
              await sendTelegramPhoto(botToken!, telegramChatId, media)
            }
          }
        } else {
          // Apenas texto
          telegramResponse = await sendTelegramMessage(botToken!, telegramChatId, message)
        }

        // Enviar botoes dos planos (se tiver)
        if (plans.length > 0) {
          const inlineKeyboard = {
            inline_keyboard: [
              ...plans.map(plan => [{ 
                text: `${plan.buttonText} - R$ ${plan.price.toFixed(2).replace(".", ",")}`, 
                callback_data: `ds_test_${seq.id}_${plan.id}_${plan.price}` 
              }]),
              [{ text: "Nao tenho interesse", callback_data: `ds_test_decline_${seq.id}` }]
            ]
          }
          await sendTelegramMessage(botToken!, telegramChatId, "Escolha uma opcao:", inlineKeyboard)
        }

        resultados.push({
          sequenceId: seq.id,
          sequenceIndex: seqIndex,
          message: message.substring(0, 100) + (message.length > 100 ? "..." : ""),
          medias: medias.length,
          plans: plans.length,
          delay: delayInfo,
          enviado: true,
          telegram_response: telegramResponse
        })

      } catch (err) {
        resultados.push({
          sequenceId: seq.id,
          sequenceIndex: seqIndex,
          message: seq.message?.substring(0, 50) || "(vazio)",
          medias: seq.medias?.length || 0,
          plans: seq.plans?.length || 0,
          delay: `${seq.sendDelayValue || 0} ${seq.sendDelayUnit || "min"}`,
          enviado: false,
          erro: err instanceof Error ? err.message : "Erro desconhecido"
        })
      }
    }

    return NextResponse.json({
      sucesso: true,
      teste: "DOWNSELL_INSTANTANEO",
      fluxo: {
        id: targetFlow.id,
        nome: targetFlow.name
      },
      destino: {
        telegramChatId,
        nota: "Mensagens enviadas instantaneamente (sem esperar delay)"
      },
      sequencias_total: downsell.sequences.length,
      sequencias_testadas: resultados.length,
      resultados
    })

  } catch (err) {
    return NextResponse.json({ 
      erro: err instanceof Error ? err.message : "Erro" 
    }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// GET /api/test/downsell - PUXA TUDO E ANALISA (sem disparar)
// ---------------------------------------------------------------------------
export async function GET() {
  const supabase = getSupabaseAdmin()
  const agora = new Date()

  try {
    // 1. Buscar TODOS os bots
    const { data: bots } = await supabase.from("bots").select("*")

    // 2. Buscar TODOS os fluxos
    const { data: flows } = await supabase.from("flows").select("*")

    // 3. Buscar mensagens pendentes
    const { data: pendentes } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .eq("message_type", "downsell")

    // 4. Analisar cada fluxo
    const analise = []

    for (const flow of flows || []) {
      const config = (flow.config as Record<string, unknown>) || {}
      const downsell = config.downsell as {
        enabled?: boolean
        sequences?: Array<{
          id: string
          message: string
          medias?: string[]
          sendDelayValue?: number
          sendDelayUnit?: string
          plans?: Array<{ id: string; buttonText: string; price: number }>
        }>
      } | undefined

      const bot = bots?.find(b => b.id === flow.bot_id)

      // Problemas
      const problemas = []
      if (!flow.bot_id) problemas.push("SEM BOT VINCULADO")
      else if (!bot) problemas.push("BOT NAO EXISTE")
      else if (!bot.token) problemas.push("BOT SEM TOKEN")
      if (!downsell?.enabled) problemas.push("DOWNSELL DESATIVADO")
      if (!downsell?.sequences?.length) problemas.push("SEM SEQUENCIAS")

      // Sequencias
      const seqs = []
      for (const seq of downsell?.sequences || []) {
        let delayMin = seq.sendDelayValue || 1
        if (seq.sendDelayUnit === "hours") delayMin *= 60
        if (seq.sendDelayUnit === "days") delayMin *= 1440

        const envioEm = new Date(agora.getTime() + delayMin * 60000)

        seqs.push({
          id: seq.id,
          msg: seq.message?.substring(0, 50) || "(vazio)",
          delay: `${seq.sendDelayValue || 1} ${seq.sendDelayUnit || "min"}`,
          delay_minutos: delayMin,
          enviaria_em: envioEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          tem_midia: (seq.medias?.length || 0) > 0,
          planos: seq.plans?.length || 0
        })
      }

      analise.push({
        fluxo: flow.name,
        fluxo_id: flow.id,
        status: flow.status,
        bot: bot?.name || "NENHUM",
        bot_id: flow.bot_id,
        downsell_on: downsell?.enabled || false,
        sequencias: seqs.length,
        detalhe_sequencias: seqs,
        problemas,
        ok: problemas.length === 0
      })
    }

    // Separar
    const funcionando = analise.filter(a => a.ok)
    const comProblema = analise.filter(a => !a.ok)

    return NextResponse.json({
      hora: agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      
      resumo: {
        bots: bots?.length || 0,
        fluxos: flows?.length || 0,
        funcionando: funcionando.length,
        com_problema: comProblema.length,
        msgs_pendentes: pendentes?.length || 0
      },

      bots: bots?.map(b => ({ 
        id: b.id, 
        nome: b.name, 
        token: b.token ? "OK" : "FALTA" 
      })),

      funcionando,
      com_problema: comProblema,

      msgs_pendentes: pendentes?.map(p => ({
        id: p.id,
        user: p.telegram_user_id,
        enviar_em: new Date(p.scheduled_for).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        passou: new Date(p.scheduled_for) < agora
      }))
    })

  } catch (err) {
    return NextResponse.json({ 
      erro: err instanceof Error ? err.message : "Erro" 
    }, { status: 500 })
  }
}
