import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// ---------------------------------------------------------------------------
// Telegram helpers
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
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function sendTelegramPhoto(botToken: string, chatId: number, photoUrl: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, parse_mode: "HTML" }),
  })
}

async function sendTelegramVideo(botToken: string, chatId: number, videoUrl: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, video: videoUrl, parse_mode: "HTML" }),
  })
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createVipInviteLink(botToken: string, chatId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, member_limit: 1, name: `VIP - ${Date.now()}` }),
    })
    const data = await res.json()
    return data.ok ? data.result?.invite_link : null
  } catch {
    return null
  }
}

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

async function sendDeliverable(botToken: string, chatId: number, deliverable: Deliverable) {
  console.log(`[CRON] Enviando entregavel: ${deliverable.name} (${deliverable.type})`)
  
  switch (deliverable.type) {
    case "media":
      if (deliverable.medias?.length) {
        for (const url of deliverable.medias) {
          url.includes(".mp4") || url.includes("video")
            ? await sendTelegramVideo(botToken, chatId, url)
            : await sendTelegramPhoto(botToken, chatId, url)
          await sleep(500)
        }
        await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu conteudo foi liberado acima.")
      }
      break
    case "link":
      if (deliverable.link) {
        await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Clique no botao abaixo para acessar:", {
          inline_keyboard: [[{ text: deliverable.linkText || "Acessar conteudo", url: deliverable.link }]]
        })
      }
      break
    case "vip_group":
      if (deliverable.vipGroupChatId) {
        const invite = await createVipInviteLink(botToken, deliverable.vipGroupChatId)
        if (invite) {
          await sendTelegramMessage(
            botToken, chatId,
            `Obrigado pela compra! Seu acesso ao <b>${deliverable.vipGroupName || "Grupo VIP"}</b> foi liberado.`,
            { inline_keyboard: [[{ text: `Entrar no ${deliverable.vipGroupName || "Grupo VIP"}`, url: invite }]] }
          )
        }
      }
      break
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendDelivery(botToken: string, chatId: number, flowConfig: Record<string, any> | null, deliverableId?: string) {
  // Entregavel especifico
  if (deliverableId && flowConfig?.deliverables) {
    const d = flowConfig.deliverables.find((x: Deliverable) => x.id === deliverableId)
    if (d) return sendDeliverable(botToken, chatId, d)
  }
  
  // Entregavel principal
  if (flowConfig?.mainDeliverableId && flowConfig?.deliverables) {
    const d = flowConfig.deliverables.find((x: Deliverable) => x.id === flowConfig.mainDeliverableId)
    if (d) return sendDeliverable(botToken, chatId, d)
  }
  
  // Primeiro entregavel disponivel
  if (flowConfig?.deliverables?.length) {
    return sendDeliverable(botToken, chatId, flowConfig.deliverables[0])
  }
  
  // Sistema antigo
  if (flowConfig?.delivery) {
    const d = flowConfig.delivery
    if (d.type === "vip_group" && d.vipGroupId) {
      const invite = await createVipInviteLink(botToken, d.vipGroupId)
      if (invite) {
        await sendTelegramMessage(botToken, chatId, `Seu acesso ao <b>${d.vipGroupName || "Grupo VIP"}</b> foi liberado.`, {
          inline_keyboard: [[{ text: `Entrar`, url: invite }]]
        })
      }
      return
    }
    if (d.medias?.length) {
      for (const url of d.medias) {
        url.includes(".mp4") ? await sendTelegramVideo(botToken, chatId, url) : await sendTelegramPhoto(botToken, chatId, url)
        await sleep(500)
      }
    }
    if (d.link) {
      await sendTelegramMessage(botToken, chatId, "Seu acesso foi liberado!", {
        inline_keyboard: [[{ text: d.linkText || "Acessar", url: d.link }]]
      })
    }
    return
  }
  
  // Fallback
  await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu acesso foi liberado.")
}

// ---------------------------------------------------------------------------
// CRON - Roda automaticamente a cada 1 minuto
// ---------------------------------------------------------------------------

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const startTime = Date.now()
  
  try {
    // Buscar pagamentos pendentes criados nos ultimos 30 minutos
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    
    const { data: payments, error } = await supabase
      .from("payments")
      .select("*")
      .eq("status", "pending")
      .not("external_payment_id", "is", null)
      .gte("created_at", thirtyMinutesAgo)
      .order("created_at", { ascending: true })
      .limit(20)
    
    if (error || !payments?.length) {
      return NextResponse.json({ 
        ok: true, 
        message: "Nenhum pagamento pendente",
        duration: Date.now() - startTime
      })
    }
    
    console.log(`[CRON] Verificando ${payments.length} pagamentos pendentes`)
    
    let aprovados = 0
    let entregas = 0
    
    for (const payment of payments) {
      // Buscar gateway
      let userId = payment.user_id
      if (!userId && payment.bot_id) {
        const { data: bot } = await supabase.from("bots").select("user_id").eq("id", payment.bot_id).single()
        userId = bot?.user_id
      }
      if (!userId) continue
      
      const { data: gateway } = await supabase
        .from("user_gateways")
        .select("access_token")
        .eq("user_id", userId)
        .eq("is_active", true)
        .single()
      
      if (!gateway?.access_token) continue
      
      // Verificar status no MP
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${payment.external_payment_id}`, {
        headers: { Authorization: `Bearer ${gateway.access_token}` }
      })
      
      if (!res.ok) continue
      
      const mpData = await res.json()
      const mpStatus = mpData.status
      
      // Atualizar se diferente
      if (mpStatus !== payment.status) {
        await supabase
          .from("payments")
          .update({ status: mpStatus, updated_at: new Date().toISOString() })
          .eq("id", payment.id)
        
        console.log(`[CRON] Payment ${payment.external_payment_id}: ${payment.status} -> ${mpStatus}`)
      }
      
      // Se aprovado, disparar entrega
      if (mpStatus === "approved") {
        aprovados++
        
        const { data: bot } = await supabase.from("bots").select("id, token").eq("id", payment.bot_id).single()
        if (!bot?.token || !payment.telegram_user_id) continue
        
        const chatId = parseInt(payment.telegram_user_id)
        
        // Cancelar downsells
        await supabase
          .from("scheduled_messages")
          .update({ status: "cancelled" })
          .eq("bot_id", payment.bot_id)
          .eq("telegram_user_id", payment.telegram_user_id)
          .eq("message_type", "downsell")
          .eq("status", "pending")
        
        // Mensagem de confirmacao
        await sendTelegramMessage(
          bot.token, chatId,
          `<b>Pagamento Aprovado!</b>\n\nSeu pagamento de R$ ${payment.amount.toFixed(2).replace(".", ",")} foi confirmado.\nObrigado pela sua compra!`
        )
        
        // Buscar flow
        let flowConfig = null
        const { data: flow } = await supabase.from("flows").select("config").eq("bot_id", bot.id).limit(1).single()
        
        if (flow) {
          flowConfig = flow.config
        } else {
          const { data: link } = await supabase.from("flow_bots").select("flow_id").eq("bot_id", bot.id).limit(1).single()
          if (link) {
            const { data: f } = await supabase.from("flows").select("config").eq("id", link.flow_id).single()
            flowConfig = f?.config
          }
        }
        
        // Entregar
        await sendDelivery(bot.token, chatId, flowConfig)
        entregas++
        
        console.log(`[CRON] Entrega enviada para ${chatId}`)
      }
    }
    
    return NextResponse.json({
      ok: true,
      verificados: payments.length,
      aprovados,
      entregas,
      duration: Date.now() - startTime
    })
    
  } catch (err) {
    console.error("[CRON] Erro:", err)
    return NextResponse.json({ ok: false, error: String(err) })
  }
}
