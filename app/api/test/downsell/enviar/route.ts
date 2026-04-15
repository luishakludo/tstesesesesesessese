import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// SUPABASE DIRETO - SEM DEPENDER DE NADA EXTERNO
// ---------------------------------------------------------------------------
const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI1OTQ1MywiZXhwIjoyMDg4ODM1NDUzfQ.piDbcvfzUQd8orOFUn7vE1cZ5RXMBFXTd8vKqJRA-Hg"

function getDb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// ---------------------------------------------------------------------------
// TELEGRAM HELPERS
// ---------------------------------------------------------------------------
async function telegramSend(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

// ---------------------------------------------------------------------------
// GET /api/test/downsell/enviar
// 
// DISPARA TESTE DE DOWNSELL AUTOMATICO
// 
// Pega o primeiro bot disponivel, pega o primeiro fluxo com downsell,
// e envia a primeira sequencia pra um chat de teste (o proprio bot ou um chat especifico)
// ---------------------------------------------------------------------------
export async function GET() {
  const db = getDb()
  const agora = new Date()
  const agoraBR = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })

  try {
    // =========================================================================
    // PASSO 1: BUSCAR DADOS
    // =========================================================================
    const [botsRes, flowsRes, flowBotsRes] = await Promise.all([
      db.from("bots").select("*"),
      db.from("flows").select("*"),
      db.from("flow_bots").select("*")
    ])

    const bots = botsRes.data || []
    const flows = flowsRes.data || []
    const flowBots = flowBotsRes.data || []

    // =========================================================================
    // PASSO 2: ENCONTRAR FLUXO COM DOWNSELL ATIVO
    // =========================================================================
    let fluxoAlvo = null
    let botAlvo = null
    let sequencias: Array<{
      id: string
      message: string
      medias?: string[]
      sendDelayValue?: number
      sendDelayUnit?: string
      plans?: Array<{ id: string; buttonText: string; price: number }>
    }> = []

    for (const flow of flows) {
      const config = (flow.config || {}) as Record<string, unknown>
      const downsell = config.downsell as { enabled?: boolean; sequences?: typeof sequencias }

      if (!downsell?.enabled || !downsell?.sequences?.length) continue

      // Encontrar bot
      let botId = flow.bot_id
      if (!botId) {
        const fb = flowBots.find((fb: { flow_id: string; bot_id: string }) => fb.flow_id === flow.id)
        if (fb) botId = fb.bot_id
      }

      const bot = bots.find((b: { id: string }) => b.id === botId)
      if (!bot?.token) continue

      // Encontrou!
      fluxoAlvo = flow
      botAlvo = bot
      sequencias = downsell.sequences
      break
    }

    if (!fluxoAlvo || !botAlvo) {
      return NextResponse.json({
        erro: "NENHUM FLUXO PRONTO",
        detalhes: "Nao encontrei nenhum fluxo com downsell ativo e bot com token configurado",
        dica: "Acesse /api/test/downsell para ver os problemas de cada fluxo"
      }, { status: 400 })
    }

    // =========================================================================
    // PASSO 3: PEGAR INFO DO BOT (pra ter um chat_id de teste)
    // =========================================================================
    const botInfoRes = await telegramSend(botAlvo.token, "getMe", {})
    if (!botInfoRes.ok) {
      return NextResponse.json({
        erro: "TOKEN INVALIDO",
        bot: botAlvo.name,
        telegram_response: botInfoRes
      }, { status: 400 })
    }

    // =========================================================================
    // BUSCAR CHAT_ID DE MULTIPLAS FONTES (pra nao depender de uma so)
    // =========================================================================
    let chatIdTeste: string | number | null = null
    let fonteChat = ""

    // Fonte 1: user_flows (usuarios que deram /start)
    const { data: userFlow } = await db
      .from("user_flows")
      .select("telegram_user_id, telegram_chat_id")
      .eq("bot_id", botAlvo.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (userFlow?.telegram_chat_id || userFlow?.telegram_user_id) {
      chatIdTeste = userFlow.telegram_chat_id || userFlow.telegram_user_id
      fonteChat = "user_flows"
    }

    // Fonte 2: scheduled_messages (mensagens agendadas)
    if (!chatIdTeste) {
      const { data: scheduled } = await db
        .from("scheduled_messages")
        .select("telegram_chat_id")
        .eq("bot_id", botAlvo.id)
        .not("telegram_chat_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (scheduled?.telegram_chat_id) {
        chatIdTeste = scheduled.telegram_chat_id
        fonteChat = "scheduled_messages"
      }
    }

    // Fonte 3: downsell_pending (usuarios com downsell pendente)
    if (!chatIdTeste) {
      const { data: pending } = await db
        .from("downsell_pending")
        .select("telegram_chat_id, telegram_user_id")
        .eq("flow_id", fluxoAlvo.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (pending?.telegram_chat_id || pending?.telegram_user_id) {
        chatIdTeste = pending.telegram_chat_id || pending.telegram_user_id
        fonteChat = "downsell_pending"
      }
    }

    // Fonte 4: funnel_users (usuarios no funil)
    if (!chatIdTeste) {
      const { data: funnelUser } = await db
        .from("funnel_users")
        .select("telegram_user_id, chat_id")
        .eq("bot_id", botAlvo.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (funnelUser?.chat_id || funnelUser?.telegram_user_id) {
        chatIdTeste = funnelUser.chat_id || funnelUser.telegram_user_id
        fonteChat = "funnel_users"
      }
    }

    // Fonte 5: purchases
    if (!chatIdTeste) {
      const { data: purchase } = await db
        .from("purchases")
        .select("telegram_user_id")
        .not("telegram_user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (purchase?.telegram_user_id) {
        chatIdTeste = purchase.telegram_user_id
        fonteChat = "purchases"
      }
    }

    // Fonte 6: TELEGRAM getUpdates - pega direto da API do Telegram
    // Isso funciona mesmo sem nada no banco!
    if (!chatIdTeste) {
      const updatesRes = await telegramSend(botAlvo.token, "getUpdates", { limit: 10 })
      
      if (updatesRes.ok && updatesRes.result?.length > 0) {
        // Pegar o chat mais recente de qualquer update
        for (const update of updatesRes.result.reverse()) {
          const chat = update.message?.chat || update.callback_query?.message?.chat
          if (chat?.id) {
            chatIdTeste = chat.id
            fonteChat = "telegram_getUpdates"
            break
          }
        }
      }
    }

    // Fonte 7: Usar o proprio ID do bot (self-test)
    // O bot pode enviar mensagem pra si mesmo em alguns casos
    if (!chatIdTeste && botInfoRes.result?.id) {
      // Tenta enviar uma mensagem de teste primeiro pra ver se funciona
      const selfTest = await telegramSend(botAlvo.token, "sendMessage", {
        chat_id: botInfoRes.result.id,
        text: "[TESTE] Verificando se o bot consegue enviar mensagem..."
      })
      
      // Se funcionou, usa o ID do bot
      if (selfTest.ok) {
        chatIdTeste = botInfoRes.result.id
        fonteChat = "bot_self_id"
      }
    }

    if (!chatIdTeste) {
      return NextResponse.json({
        erro: "SEM CHAT DE TESTE",
        detalhes: "Nao encontrei nenhum chat em lugar nenhum. Preciso que voce mande pelo menos UMA mensagem pro bot.",
        tabelas_verificadas: ["user_flows", "scheduled_messages", "downsell_pending", "funnel_users", "purchases"],
        fontes_telegram: ["getUpdates (ultimas mensagens)", "bot self ID"],
        instrucao: `Abra o Telegram, busque @${botInfoRes.result?.username} e envie /start. Depois tente novamente.`,
        bot: botAlvo.name,
        bot_username: botInfoRes.result?.username
      }, { status: 400 })
    }

    // =========================================================================
    // PASSO 4: ENVIAR TODAS AS SEQUENCIAS (simulando passagem de tempo)
    // =========================================================================
    const resultados: Array<{
      sequencia_index: number
      sequencia_id: string
      delay_original: string
      mensagem: string
      midias_enviadas: number
      planos_enviados: number
      telegram_response: unknown
      sucesso: boolean
      erro?: string
    }> = []

    for (let i = 0; i < sequencias.length; i++) {
      const seq = sequencias[i]
      const delayOriginal = `${seq.sendDelayValue || 1} ${seq.sendDelayUnit || "min"}`

      try {
        let telegramRes: unknown = null

        // Enviar midia se tiver
        if (seq.medias && seq.medias.length > 0) {
          const primeiraMedia = seq.medias[0]
          const isVideo = primeiraMedia.includes("video") || primeiraMedia.includes("mp4")
          
          telegramRes = await telegramSend(
            botAlvo.token,
            isVideo ? "sendVideo" : "sendPhoto",
            {
              chat_id: chatIdTeste,
              [isVideo ? "video" : "photo"]: primeiraMedia,
              caption: seq.message || "",
              parse_mode: "HTML"
            }
          )

          // Enviar demais midias
          for (let m = 1; m < seq.medias.length; m++) {
            const media = seq.medias[m]
            const isVid = media.includes("video") || media.includes("mp4")
            await telegramSend(
              botAlvo.token,
              isVid ? "sendVideo" : "sendPhoto",
              {
                chat_id: chatIdTeste,
                [isVid ? "video" : "photo"]: media,
                parse_mode: "HTML"
              }
            )
          }
        } else {
          // Apenas texto
          telegramRes = await telegramSend(botAlvo.token, "sendMessage", {
            chat_id: chatIdTeste,
            text: seq.message || "(mensagem vazia)",
            parse_mode: "HTML"
          })
        }

        // Enviar botoes dos planos
        if (seq.plans && seq.plans.length > 0) {
          const keyboard = {
            inline_keyboard: [
              ...seq.plans.map(plan => [{
                text: `${plan.buttonText} - R$ ${plan.price.toFixed(2).replace(".", ",")}`,
                callback_data: `test_ds_${seq.id}_${plan.id}`
              }]),
              [{ text: "Nao tenho interesse", callback_data: `test_ds_decline_${seq.id}` }]
            ]
          }
          await telegramSend(botAlvo.token, "sendMessage", {
            chat_id: chatIdTeste,
            text: "Escolha uma opcao:",
            reply_markup: keyboard
          })
        }

        resultados.push({
          sequencia_index: i,
          sequencia_id: seq.id,
          delay_original: delayOriginal,
          mensagem: seq.message?.substring(0, 50) + "..." || "(vazio)",
          midias_enviadas: seq.medias?.length || 0,
          planos_enviados: seq.plans?.length || 0,
          telegram_response: telegramRes,
          sucesso: true
        })

      } catch (err) {
        resultados.push({
          sequencia_index: i,
          sequencia_id: seq.id,
          delay_original: delayOriginal,
          mensagem: seq.message?.substring(0, 50) + "..." || "(vazio)",
          midias_enviadas: 0,
          planos_enviados: 0,
          telegram_response: null,
          sucesso: false,
          erro: err instanceof Error ? err.message : "Erro desconhecido"
        })
      }

      // Pequeno delay entre sequencias pra nao dar rate limit
      await new Promise(r => setTimeout(r, 500))
    }

    // =========================================================================
    // RESPOSTA
    // =========================================================================
    const sucessos = resultados.filter(r => r.sucesso).length
    const falhas = resultados.filter(r => !r.sucesso).length

    return NextResponse.json({
      teste: "DOWNSELL_ENVIO_REAL",
      hora: agoraBR,
      
      fluxo: {
        nome: fluxoAlvo.name,
        id: fluxoAlvo.id
      },
      
      bot: {
        nome: botAlvo.name,
        username: botInfoRes.result?.username
      },
      
      destino: {
        chat_id: chatIdTeste,
        fonte: fonteChat,
        nota: `Encontrado na tabela ${fonteChat}`
      },

      resumo: {
        total_sequencias: sequencias.length,
        enviadas_com_sucesso: sucessos,
        falhas: falhas,
        nota: "Delays foram IGNORADOS - todas as sequencias enviadas instantaneamente"
      },

      resultados
    })

  } catch (err) {
    return NextResponse.json({
      erro: err instanceof Error ? err.message : "Erro desconhecido",
      stack: err instanceof Error ? err.stack : null
    }, { status: 500 })
  }
}
