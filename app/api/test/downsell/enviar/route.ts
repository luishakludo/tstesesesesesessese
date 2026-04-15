import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import MercadoPagoConfig, { Payment } from "mercadopago"

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
// PIX PAYMENT - MESMA FUNCAO DOS PLANOS NORMAIS
// ---------------------------------------------------------------------------
async function createPixPayment(params: {
  accessToken: string
  amount: number
  description: string
  payerEmail: string
}): Promise<{
  success: boolean
  paymentId?: number
  qrCode?: string
  qrCodeUrl?: string
  copyPaste?: string
  error?: string
}> {
  try {
    const client = new MercadoPagoConfig({ accessToken: params.accessToken })
    const payment = new Payment(client)
    
    const result = await payment.create({
      body: {
        transaction_amount: params.amount,
        description: params.description,
        payment_method_id: "pix",
        payer: {
          email: params.payerEmail
        }
      }
    })
    
    return {
      success: true,
      paymentId: result.id,
      qrCode: result.point_of_interaction?.transaction_data?.qr_code_base64,
      qrCodeUrl: result.point_of_interaction?.transaction_data?.qr_code,
      copyPaste: result.point_of_interaction?.transaction_data?.qr_code
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao criar PIX"
    }
  }
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
// POST /api/test/downsell/enviar
// 
// SIMULA O CLIQUE NO BOTAO DE DOWNSELL
// Faz tudo que o webhook faria quando clica no botao: busca gateway, gera PIX, envia
// 
// Acesse: /api/test/downsell/enviar?chat=SEU_CHAT_ID&simular=1
// Ou POST com body: { "chat": "SEU_CHAT_ID" }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const db = getDb()
  const logs: string[] = []
  const log = (msg: string) => { logs.push(msg); console.log("[v0]", msg) }

  try {
    const body = await request.json().catch(() => ({}))
    const chatId = body.chat || body.chatId || body.telegram_chat_id

    if (!chatId) {
      return NextResponse.json({
        erro: "Passe o chat_id no body: { chat: 'SEU_CHAT_ID' }",
        exemplo: "POST /api/test/downsell/enviar com body { chat: '5099610171' }"
      }, { status: 400 })
    }

    log(`Iniciando simulacao de clique para chat: ${chatId}`)

    // PASSO 1: Buscar bot e fluxo com downsell
    log("Buscando bots e fluxos...")
    const [botsRes, flowsRes, flowBotsRes] = await Promise.all([
      db.from("bots").select("*"),
      db.from("flows").select("*"),
      db.from("flow_bots").select("*")
    ])

    const bots = botsRes.data || []
    const flows = flowsRes.data || []
    const flowBots = flowBotsRes.data || []

    log(`Encontrados: ${bots.length} bots, ${flows.length} fluxos`)

    // Encontrar fluxo com downsell
    let fluxoAlvo = null
    let botAlvo = null
    let primeiroPlano: { id: string; buttonText: string; price: number } | null = null
    let sequenciaId = ""

    for (const flow of flows) {
      const config = (flow.config || {}) as Record<string, unknown>
      const downsell = config.downsell as { 
        enabled?: boolean
        sequences?: Array<{
          id: string
          plans?: Array<{ id: string; buttonText: string; price: number }>
        }> 
      }

      if (!downsell?.enabled || !downsell?.sequences?.length) continue

      // Encontrar bot
      let botId = flow.bot_id
      if (!botId) {
        const fb = flowBots.find((fb: { flow_id: string; bot_id: string }) => fb.flow_id === flow.id)
        if (fb) botId = fb.bot_id
      }

      const bot = bots.find((b: { id: string }) => b.id === botId)
      if (!bot?.token) continue

      // Pegar primeiro plano da primeira sequencia
      const seq = downsell.sequences[0]
      if (seq.plans && seq.plans.length > 0) {
        fluxoAlvo = flow
        botAlvo = bot
        primeiroPlano = seq.plans[0]
        sequenciaId = seq.id
        break
      }
    }

    if (!fluxoAlvo || !botAlvo || !primeiroPlano) {
      return NextResponse.json({
        erro: "Nenhum fluxo com downsell e planos encontrado",
        logs
      }, { status: 400 })
    }

    log(`Fluxo: ${fluxoAlvo.name}, Bot: ${botAlvo.name}`)
    log(`Plano: ${primeiroPlano.buttonText}, Preco: R$ ${primeiroPlano.price}`)

    // PASSO 2: Buscar user_id do bot (IGUAL AOS PLANOS NORMAIS)
    log("Buscando user_id do bot...")
    const { data: botData, error: botError } = await db
      .from("bots")
      .select("user_id")
      .eq("id", botAlvo.id)
      .single()

    if (botError || !botData?.user_id) {
      return NextResponse.json({
        erro: "Bot sem user_id",
        botError,
        logs
      }, { status: 400 })
    }

    log(`user_id do bot: ${botData.user_id}`)

    // PASSO 3: Buscar gateway de pagamento (IGUAL AOS PLANOS NORMAIS)
    log("Buscando gateway em user_gateways...")
    const { data: gateway, error: gatewayError } = await db
      .from("user_gateways")
      .select("*")
      .eq("user_id", botData.user_id)
      .eq("is_active", true)
      .limit(1)
      .single()

    log(`Gateway encontrado: ${gateway ? "SIM" : "NAO"}`)
    
    if (gatewayError) {
      log(`Erro gateway: ${JSON.stringify(gatewayError)}`)
    }

    if (!gateway) {
      // Tentar buscar de payment_gateways como fallback
      log("Tentando buscar em payment_gateways...")
      const { data: gatewayAlt, error: gatewayAltError } = await db
        .from("payment_gateways")
        .select("*")
        .eq("bot_id", botAlvo.id)
        .eq("is_active", true)
        .limit(1)
        .single()

      log(`Gateway alt encontrado: ${gatewayAlt ? "SIM" : "NAO"}`)
      
      if (gatewayAltError) {
        log(`Erro gateway alt: ${JSON.stringify(gatewayAltError)}`)
      }

      if (!gatewayAlt) {
        return NextResponse.json({
          erro: "GATEWAY NAO ENCONTRADO",
          detalhes: "Nenhum gateway de pagamento configurado para este bot",
          user_id: botData.user_id,
          bot_id: botAlvo.id,
          tabelas_verificadas: ["user_gateways", "payment_gateways"],
          logs
        }, { status: 400 })
      }

      // Usar gateway alternativo
      const accessToken = gatewayAlt.credentials?.access_token || gatewayAlt.access_token
      if (!accessToken) {
        return NextResponse.json({
          erro: "Gateway sem access_token",
          gateway: gatewayAlt,
          logs
        }, { status: 400 })
      }

      log(`Usando gateway de payment_gateways: ${gatewayAlt.gateway_name}`)
      log("Gerando PIX...")

      const pixResult = await createPixPayment({
        accessToken,
        amount: primeiroPlano.price,
        description: `Downsell - ${primeiroPlano.buttonText}`,
        payerEmail: "teste@teste.com"
      })

      if (!pixResult.success) {
        return NextResponse.json({
          erro: "Erro ao gerar PIX",
          pixResult,
          logs
        }, { status: 400 })
      }

      log(`PIX gerado! ID: ${pixResult.paymentId}`)

      // Enviar no Telegram
      log("Enviando PIX no Telegram...")
      
      if (pixResult.qrCode) {
        const qrCodeBase64 = pixResult.qrCode.startsWith("data:") 
          ? pixResult.qrCode 
          : `data:image/png;base64,${pixResult.qrCode}`
        
        await telegramSend(botAlvo.token, "sendPhoto", {
          chat_id: chatId,
          photo: qrCodeBase64,
          caption: `Pague R$ ${primeiroPlano.price.toFixed(2).replace(".", ",")} via PIX\n\nCopie o codigo abaixo:`
        })
      }

      if (pixResult.copyPaste) {
        await telegramSend(botAlvo.token, "sendMessage", {
          chat_id: chatId,
          text: `<code>${pixResult.copyPaste}</code>`,
          parse_mode: "HTML"
        })
      }

      return NextResponse.json({
        sucesso: true,
        teste: "SIMULACAO_CLIQUE_DOWNSELL",
        fluxo: fluxoAlvo.name,
        bot: botAlvo.name,
        plano: primeiroPlano,
        gateway_usado: "payment_gateways",
        pix: {
          payment_id: pixResult.paymentId,
          tem_qrcode: !!pixResult.qrCode,
          tem_copypaste: !!pixResult.copyPaste
        },
        logs
      })
    }

    // Gateway encontrado em user_gateways
    const accessToken = gateway.access_token
    if (!accessToken) {
      return NextResponse.json({
        erro: "Gateway sem access_token",
        gateway,
        logs
      }, { status: 400 })
    }

    log(`Usando gateway de user_gateways: ${gateway.gateway_name}`)
    log("Gerando PIX...")

    const pixResult = await createPixPayment({
      accessToken,
      amount: primeiroPlano.price,
      description: `Downsell - ${primeiroPlano.buttonText}`,
      payerEmail: "teste@teste.com"
    })

    if (!pixResult.success) {
      return NextResponse.json({
        erro: "Erro ao gerar PIX",
        pixResult,
        logs
      }, { status: 400 })
    }

    log(`PIX gerado! ID: ${pixResult.paymentId}`)

    // Enviar no Telegram
    log("Enviando PIX no Telegram...")
    
    if (pixResult.qrCode) {
      await telegramSend(botAlvo.token, "sendPhoto", {
        chat_id: chatId,
        photo: pixResult.qrCode,
        caption: `Pague R$ ${primeiroPlano.price.toFixed(2).replace(".", ",")} via PIX\n\nCopie o codigo abaixo:`
      })
    }

    if (pixResult.copyPaste) {
      await telegramSend(botAlvo.token, "sendMessage", {
        chat_id: chatId,
        text: `<code>${pixResult.copyPaste}</code>`,
        parse_mode: "HTML"
      })
    }

    return NextResponse.json({
      sucesso: true,
      teste: "SIMULACAO_CLIQUE_DOWNSELL",
      fluxo: fluxoAlvo.name,
      bot: botAlvo.name,
      plano: primeiroPlano,
      gateway_usado: "user_gateways",
      pix: {
        payment_id: pixResult.paymentId,
        tem_qrcode: !!pixResult.qrCode,
        tem_copypaste: !!pixResult.copyPaste
      },
      logs
    })

  } catch (err) {
    return NextResponse.json({
      erro: err instanceof Error ? err.message : "Erro",
      stack: err instanceof Error ? err.stack : null,
      logs
    }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// GET /api/test/downsell/enviar
// 
// DISPARA TESTE DE DOWNSELL AUTOMATICO
// 
// Aceita query params opcionais:
//   ?chat=123456789  - Seu chat_id do Telegram (se nao passar, tenta buscar automatico)
//   ?bot=BOT_ID      - ID especifico do bot (se nao passar, pega o primeiro)
//   ?flow=FLOW_ID    - ID especifico do fluxo (se nao passar, pega o primeiro com downsell)
//
// Como descobrir seu chat_id:
//   1. Mande qualquer mensagem pro @userinfobot no Telegram
//   2. Ele vai responder com seu ID
//   3. Use: /api/test/downsell/enviar?chat=SEU_ID
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const db = getDb()
  const agora = new Date()
  const agoraBR = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })

  // Pegar query params
  const searchParams = request.nextUrl.searchParams
  const chatIdParam = searchParams.get("chat")
  const botIdParam = searchParams.get("bot")
  const flowIdParam = searchParams.get("flow")

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
    // BUSCAR CHAT_ID - PRIORIDADE: URL > BANCO > TELEGRAM
    // =========================================================================
    let chatIdTeste: string | number | null = null
    let fonteChat = ""

    // FONTE 0: Query param ?chat=XXXX (prioridade maxima)
    if (chatIdParam) {
      chatIdTeste = chatIdParam
      fonteChat = "query_param_url"
    }

    // Fonte 1: user_flows (usuarios que deram /start)
    if (!chatIdTeste) {
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
        detalhes: "Nao encontrei nenhum chat automaticamente. Use uma das opcoes abaixo:",
        
        opcao_1_url: {
          descricao: "Passe seu chat_id na URL (mais facil)",
          como_descobrir_chat_id: "Mande qualquer mensagem pro @userinfobot no Telegram - ele responde com seu ID",
          exemplo: `/api/test/downsell/enviar?chat=SEU_CHAT_ID`
        },
        
        opcao_2_start: {
          descricao: "Mande /start no bot e tente novamente",
          instrucao: `Abra o Telegram, busque @${botInfoRes.result?.username} e envie /start`
        },

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
        // IMPORTANTE: Usar o MESMO callback dos planos normais (plan_) pra garantir que funcione
        if (seq.plans && seq.plans.length > 0) {
          // Criar planos temporarios no flow config pra funcionar com o handler plan_
          // Cada plano do downsell gera um callback plan_ds_{planId}_{price}
          const keyboard = {
            inline_keyboard: seq.plans.map(plan => [{
              text: plan.buttonText,
              // Usar callback simples que o webhook ja sabe processar
              callback_data: `ds_${seq.id}_${plan.id}_${plan.price}`
            }])
          }
          
          // Enviar mensagem com botoes
          if (!seq.medias || seq.medias.length === 0) {
            telegramRes = await telegramSend(botAlvo.token, "sendMessage", {
              chat_id: chatIdTeste,
              text: seq.message || "Aproveite esta oferta especial:",
              parse_mode: "HTML",
              reply_markup: keyboard
            })
          } else {
            // Midia ja foi enviada, envia so os botoes
            await telegramSend(botAlvo.token, "sendMessage", {
              chat_id: chatIdTeste,
              text: "Clique abaixo para aproveitar:",
              reply_markup: keyboard
            })
          }
        }

        // Verificar se o Telegram realmente aceitou a mensagem
        const telegramOk = (telegramRes as { ok?: boolean })?.ok === true

        resultados.push({
          sequencia_index: i,
          sequencia_id: seq.id,
          delay_original: delayOriginal,
          mensagem: seq.message?.substring(0, 50) + "..." || "(vazio)",
          midias_enviadas: seq.medias?.length || 0,
          planos_enviados: seq.plans?.length || 0,
          telegram_response: telegramRes,
          sucesso: telegramOk,
          erro: telegramOk ? undefined : (telegramRes as { description?: string })?.description || "Telegram rejeitou a mensagem"
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
