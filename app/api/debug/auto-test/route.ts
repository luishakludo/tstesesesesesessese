import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// ---------------------------------------------------------------------------
// Telegram helpers (mesmas do webhook do MP)
// ---------------------------------------------------------------------------

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: object,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" }
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
  chatId: number,
  photoUrl: string,
  caption: string,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: "HTML",
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function sendTelegramVideo(
  botToken: string,
  chatId: number,
  videoUrl: string,
  caption: string,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendVideo`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    video: videoUrl,
    caption,
    parse_mode: "HTML",
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Criar link de convite unico para grupo VIP (limite de 1 uso)
async function createVipInviteLink(botToken: string, chatId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        member_limit: 1,
        name: `VIP Access - ${Date.now()}`,
      }),
    })
    const data = await res.json()
    if (data.ok && data.result?.invite_link) {
      return data.result.invite_link
    }
    return null
  } catch {
    return null
  }
}

// Interface para entregavel
interface Deliverable {
  id: string
  name: string
  type: "media" | "vip_group" | "link"
  medias?: string[]
  link?: string
  linkText?: string
  vipGroupChatId?: string
  vipGroupName?: string
}

// Funcao para enviar um entregavel especifico
async function sendDeliverable(
  botToken: string,
  chatId: number,
  deliverable: Deliverable,
  logs: string[]
) {
  logs.push(`[DELIVERY] Enviando entregavel "${deliverable.name}" (type: ${deliverable.type})`)

  switch (deliverable.type) {
    case "media":
      if (deliverable.medias && deliverable.medias.length > 0) {
        for (const mediaUrl of deliverable.medias) {
          if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
            const result = await sendTelegramVideo(botToken, chatId, mediaUrl, "")
            logs.push(`[DELIVERY] Enviou video: ${result.ok ? "OK" : "ERRO - " + result.description}`)
          } else {
            const result = await sendTelegramPhoto(botToken, chatId, mediaUrl, "")
            logs.push(`[DELIVERY] Enviou foto: ${result.ok ? "OK" : "ERRO - " + result.description}`)
          }
          await sleep(500)
        }
        await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu conteudo foi liberado acima.")
      }
      break

    case "link":
      if (deliverable.link) {
        const buttonText = deliverable.linkText || "Acessar conteudo"
        const keyboard = {
          inline_keyboard: [
            [{ text: buttonText, url: deliverable.link }]
          ]
        }
        const result = await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Clique no botao abaixo para acessar:", keyboard)
        logs.push(`[DELIVERY] Enviou link: ${result.ok ? "OK" : "ERRO - " + result.description}`)
      }
      break

    case "vip_group":
      if (deliverable.vipGroupChatId) {
        const inviteLink = await createVipInviteLink(botToken, deliverable.vipGroupChatId)
        if (inviteLink) {
          const groupName = deliverable.vipGroupName || "Grupo VIP"
          const keyboard = {
            inline_keyboard: [
              [{ text: `Entrar no ${groupName}`, url: inviteLink }]
            ]
          }
          const result = await sendTelegramMessage(
            botToken,
            chatId,
            `Obrigado pela compra! Seu acesso ao <b>${groupName}</b> foi liberado.\n\n<i>Este link e unico e pode ser usado apenas uma vez.</i>`,
            keyboard
          )
          logs.push(`[DELIVERY] Enviou convite VIP: ${result.ok ? "OK" : "ERRO - " + result.description}`)
        } else {
          await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Houve um problema ao gerar seu link de acesso. Entre em contato com o suporte.")
          logs.push(`[DELIVERY] ERRO ao criar link de convite VIP`)
        }
      }
      break
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendDelivery(
  botToken: string,
  chatId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flowConfig: Record<string, any> | null,
  logs: string[],
  deliverableId?: string
) {
  logs.push(`[DELIVERY] ========== INICIANDO ENTREGA ==========`)
  logs.push(`[DELIVERY] chatId=${chatId}, deliverableId=${deliverableId || "main"}`)
  logs.push(`[DELIVERY] flowConfig existe? ${!!flowConfig}`)
  logs.push(`[DELIVERY] deliverables: ${flowConfig?.deliverables?.length || 0}`)
  logs.push(`[DELIVERY] mainDeliverableId: ${flowConfig?.mainDeliverableId || "NAO DEFINIDO"}`)

  // Se tiver um deliverableId especifico, buscar e usar esse entregavel
  if (deliverableId && flowConfig?.deliverables) {
    const deliverable = flowConfig.deliverables.find((d: Deliverable) => d.id === deliverableId)
    if (deliverable) {
      logs.push(`[DELIVERY] Usando entregavel especifico: ${deliverable.name}`)
      await sendDeliverable(botToken, chatId, deliverable, logs)
      return
    }
  }

  // Se tiver mainDeliverableId configurado, usar o entregavel principal
  if (flowConfig?.mainDeliverableId && flowConfig?.deliverables) {
    const mainDeliverable = flowConfig.deliverables.find((d: Deliverable) => d.id === flowConfig.mainDeliverableId)
    if (mainDeliverable) {
      logs.push(`[DELIVERY] Usando entregavel principal: ${mainDeliverable.name}`)
      await sendDeliverable(botToken, chatId, mainDeliverable, logs)
      return
    } else {
      logs.push(`[DELIVERY] AVISO: mainDeliverableId definido mas entregavel nao encontrado!`)
    }
  }

  // Tentar usar o primeiro entregavel se existir
  if (flowConfig?.deliverables && flowConfig.deliverables.length > 0) {
    const firstDeliverable = flowConfig.deliverables[0]
    logs.push(`[DELIVERY] Usando primeiro entregavel disponivel: ${firstDeliverable.name}`)
    await sendDeliverable(botToken, chatId, firstDeliverable, logs)
    return
  }

  // Fallback: usar o sistema antigo de delivery
  if (flowConfig?.delivery) {
    const delivery = flowConfig.delivery
    logs.push(`[DELIVERY] Usando sistema antigo de delivery`)

    if (delivery.type === "vip_group" && delivery.vipGroupId) {
      const inviteLink = await createVipInviteLink(botToken, delivery.vipGroupId)
      if (inviteLink) {
        const groupName = delivery.vipGroupName || "Grupo VIP"
        const keyboard = {
          inline_keyboard: [
            [{ text: `Entrar no ${groupName}`, url: inviteLink }]
          ]
        }
        await sendTelegramMessage(
          botToken,
          chatId,
          `Obrigado pela compra! Seu acesso ao <b>${groupName}</b> foi liberado.\n\n<i>Este link e unico e pode ser usado apenas uma vez.</i>`,
          keyboard
        )
        logs.push(`[DELIVERY] Enviou convite VIP (sistema antigo)`)
      }
      return
    }

    if (delivery.medias && delivery.medias.length > 0) {
      for (const mediaUrl of delivery.medias) {
        if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
          await sendTelegramVideo(botToken, chatId, mediaUrl, "")
        } else {
          await sendTelegramPhoto(botToken, chatId, mediaUrl, "")
        }
        await sleep(500)
      }
      logs.push(`[DELIVERY] Enviou ${delivery.medias.length} midias (sistema antigo)`)
    }

    if (delivery.link) {
      const buttonText = delivery.linkText || "Acessar conteudo"
      const keyboard = {
        inline_keyboard: [
          [{ text: buttonText, url: delivery.link }]
        ]
      }
      await sendTelegramMessage(botToken, chatId, "Seu acesso foi liberado! Clique no botao abaixo:", keyboard)
      logs.push(`[DELIVERY] Enviou link (sistema antigo)`)
    }
    return
  }

  // Nenhuma entrega configurada
  logs.push(`[DELIVERY] AVISO: Nenhum entregavel configurado! Enviando mensagem generica.`)
  await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu acesso foi liberado.")
}

// ---------------------------------------------------------------------------
// API - Sincroniza pagamentos e dispara entregas
// ---------------------------------------------------------------------------

export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const logs: string[] = []
  
  try {
    logs.push("========== INICIO DA SINCRONIZACAO ==========")
    logs.push(`Horario: ${new Date().toISOString()}`)
    
    // 1. Buscar pagamentos pendentes com external_payment_id
    const { data: pendingPayments, error: pendingError } = await supabase
      .from("payments")
      .select("*")
      .eq("status", "pending")
      .not("external_payment_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(10)
    
    if (pendingError) {
      return NextResponse.json({ error: "Erro ao buscar pagamentos: " + pendingError.message, logs })
    }
    
    if (!pendingPayments || pendingPayments.length === 0) {
      logs.push("Nenhum pagamento pendente encontrado")
      return NextResponse.json({ 
        message: "Nenhum pagamento pendente encontrado",
        pagamentosVerificados: 0,
        pagamentosAprovados: 0,
        entregasDisparadas: 0,
        logs
      })
    }
    
    logs.push(`Encontrados ${pendingPayments.length} pagamentos pendentes`)
    
    const results = {
      verificados: 0,
      aprovados: 0,
      entregasDisparadas: 0,
      erros: 0,
      detalhes: [] as { paymentId: string; status: string; entregue: boolean; erro?: string }[]
    }
    
    // 2. Processar cada pagamento
    for (const payment of pendingPayments) {
      results.verificados++
      logs.push(`\n--- Pagamento ${payment.external_payment_id} (R$ ${payment.amount}) ---`)
      
      // Buscar user_id do bot
      let gatewayUserId = payment.user_id
      if (!gatewayUserId && payment.bot_id) {
        const { data: bot } = await supabase
          .from("bots")
          .select("user_id")
          .eq("id", payment.bot_id)
          .single()
        gatewayUserId = bot?.user_id
      }
      
      if (!gatewayUserId) {
        logs.push(`ERRO: user_id nao encontrado`)
        results.erros++
        results.detalhes.push({ paymentId: payment.external_payment_id, status: "erro", entregue: false, erro: "user_id nao encontrado" })
        continue
      }
      
      // Buscar gateway
      const { data: gateway } = await supabase
        .from("user_gateways")
        .select("access_token")
        .eq("user_id", gatewayUserId)
        .eq("is_active", true)
        .single()
      
      if (!gateway?.access_token) {
        logs.push(`ERRO: Gateway nao encontrado`)
        results.erros++
        results.detalhes.push({ paymentId: payment.external_payment_id, status: "erro", entregue: false, erro: "gateway nao encontrado" })
        continue
      }
      
      // Consultar API do Mercado Pago
      const mpResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${payment.external_payment_id}`,
        {
          headers: { Authorization: `Bearer ${gateway.access_token}` },
        }
      )
      
      if (!mpResponse.ok) {
        logs.push(`ERRO: MP API retornou ${mpResponse.status}`)
        results.erros++
        results.detalhes.push({ paymentId: payment.external_payment_id, status: "erro", entregue: false, erro: `MP API ${mpResponse.status}` })
        continue
      }
      
      const mpData = await mpResponse.json()
      const mpStatus = mpData.status
      logs.push(`Status MP: ${mpStatus} | Status banco: ${payment.status}`)
      
      // Atualizar status no banco se diferente
      if (mpStatus !== payment.status) {
        await supabase
          .from("payments")
          .update({
            status: mpStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id)
        
        logs.push(`Status atualizado: ${payment.status} -> ${mpStatus}`)
      }
      
      // 3. SE APROVADO -> DISPARAR ENTREGA
      if (mpStatus === "approved") {
        results.aprovados++
        logs.push(`PAGAMENTO APROVADO! Iniciando entrega...`)
        
        // Buscar bot
        const { data: bot } = await supabase
          .from("bots")
          .select("id, token")
          .eq("id", payment.bot_id)
          .single()
        
        if (!bot?.token || !payment.telegram_user_id) {
          logs.push(`ERRO: Bot ou telegram_user_id nao encontrado`)
          results.detalhes.push({ paymentId: payment.external_payment_id, status: "approved", entregue: false, erro: "bot/user nao encontrado" })
          continue
        }
        
        const chatId = parseInt(payment.telegram_user_id)
        
        // Cancelar downsells pendentes
        await supabase
          .from("scheduled_messages")
          .update({ status: "cancelled" })
          .eq("bot_id", payment.bot_id)
          .eq("telegram_user_id", payment.telegram_user_id)
          .eq("message_type", "downsell")
          .eq("status", "pending")
        
        // Enviar confirmacao
        await sendTelegramMessage(
          bot.token,
          chatId,
          `<b>Pagamento Aprovado!</b>\n\nSeu pagamento de R$ ${payment.amount.toFixed(2).replace(".", ",")} foi confirmado.\nObrigado pela sua compra!`
        )
        logs.push(`Mensagem de confirmacao enviada`)
        
        // Buscar fluxo
        let flowConfig = null
        
        // Primeiro pelo bot_id direto
        const { data: directFlow } = await supabase
          .from("flows")
          .select("id, config")
          .eq("bot_id", bot.id)
          .limit(1)
          .single()
        
        if (directFlow) {
          flowConfig = directFlow.config
          logs.push(`Flow encontrado direto: ${directFlow.id}`)
        } else {
          // Via flow_bots
          const { data: flowBotLink } = await supabase
            .from("flow_bots")
            .select("flow_id")
            .eq("bot_id", bot.id)
            .limit(1)
            .single()
          
          if (flowBotLink) {
            const { data: flowData } = await supabase
              .from("flows")
              .select("config")
              .eq("id", flowBotLink.flow_id)
              .single()
            flowConfig = flowData?.config
            logs.push(`Flow encontrado via flow_bots: ${flowBotLink.flow_id}`)
          }
        }
        
        if (!flowConfig) {
          logs.push(`AVISO: Nenhum flow encontrado para bot ${bot.id}`)
        }
        
        // Enviar entrega
        await sendDelivery(bot.token, chatId, flowConfig, logs)
        
        results.entregasDisparadas++
        results.detalhes.push({ paymentId: payment.external_payment_id, status: "approved", entregue: true })
        logs.push(`ENTREGA CONCLUIDA!`)
        
      } else {
        results.detalhes.push({ paymentId: payment.external_payment_id, status: mpStatus, entregue: false })
      }
    }
    
    logs.push(`\n========== FIM DA SINCRONIZACAO ==========`)
    logs.push(`Verificados: ${results.verificados}`)
    logs.push(`Aprovados: ${results.aprovados}`)
    logs.push(`Entregas disparadas: ${results.entregasDisparadas}`)
    logs.push(`Erros: ${results.erros}`)
    
    return NextResponse.json({
      message: "Sincronizacao concluida",
      pagamentosVerificados: results.verificados,
      pagamentosAprovados: results.aprovados,
      entregasDisparadas: results.entregasDisparadas,
      erros: results.erros,
      detalhes: results.detalhes,
      logs
    })
    
  } catch (error) {
    logs.push(`ERRO FATAL: ${String(error)}`)
    return NextResponse.json({ 
      error: "Erro: " + String(error),
      logs
    })
  }
}
