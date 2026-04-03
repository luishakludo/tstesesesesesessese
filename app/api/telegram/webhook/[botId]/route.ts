import { NextRequest } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { createPixPayment } from "@/lib/payments/gateways/mercadopago"

// ---------------------------------------------------------------------------
// Helper: Busca flow ativo para um bot via flow_bots (relacao many-to-many)
// ---------------------------------------------------------------------------
async function getActiveFlowForBot(supabase: ReturnType<typeof getSupabase>, botUuid: string) {
  // Primeiro tenta via flow_bots (correta)
  const { data: flowBot, error: flowBotError } = await supabase
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
    .eq("bot_id", botUuid)
    .limit(1)
    .single()
  
  console.log("[v0] getActiveFlowForBot - botUuid:", botUuid)
  console.log("[v0] getActiveFlowForBot - flowBot result:", JSON.stringify(flowBot))
  console.log("[v0] getActiveFlowForBot - flowBot error:", flowBotError?.message)
  
  if (flowBot?.flows) {
    const flow = flowBot.flows as { id: string; name: string; config: Record<string, unknown>; status: string }
    console.log("[v0] getActiveFlowForBot - flow status:", flow.status)
    // Aceitar tanto "ativo" quanto "active"
    if (flow.status === "ativo" || flow.status === "active") {
      return flow
    }
  }
  
  // Fallback: busca direto na tabela flows (compatibilidade)
  const { data: directFlow, error: directError } = await supabase
    .from("flows")
    .select("id, name, config, status")
    .eq("bot_id", botUuid)
    .limit(1)
    .single()
  
  console.log("[v0] getActiveFlowForBot - directFlow result:", JSON.stringify(directFlow))
  console.log("[v0] getActiveFlowForBot - directFlow error:", directError?.message)
  
  // Aceitar qualquer status para fallback (para debug)
  if (directFlow && (directFlow.status === "ativo" || directFlow.status === "active")) {
    return directFlow
  }
  
  return directFlow
}

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

async function sendTelegramPhoto(
  botToken: string,
  chatId: number,
  photoUrl: string,
  caption?: string,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
    parse_mode: "HTML",
  }
  if (caption) body.caption = caption
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function sendTelegramVideo(
  botToken: string,
  chatId: number,
  videoUrl: string,
  caption?: string,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendVideo`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    video: videoUrl,
    parse_mode: "HTML",
  }
  if (caption) body.caption = caption
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function answerCallback(
  botToken: string,
  callbackQueryId: string,
  text?: string,
) {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`
  const body: Record<string, unknown> = {
    callback_query_id: callbackQueryId,
  }
  if (text) body.text = text
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

// Send multiple medias as album (grouped)
async function sendMediaGroup(
  botToken: string,
  chatId: number,
  mediaUrls: string[],
  caption?: string,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendMediaGroup`
  
  const media = mediaUrls.map((mediaUrl, index) => {
    const isVideo = mediaUrl.includes(".mp4") || mediaUrl.includes("video")
    const item: Record<string, unknown> = {
      type: isVideo ? "video" : "photo",
      media: mediaUrl,
    }
    // Caption only on first item
    if (index === 0 && caption) {
      item.caption = caption
      item.parse_mode = "HTML"
    }
    return item
  })
  
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, media }),
  })
}

// ---------------------------------------------------------------------------
// Process message in background (non-blocking)
// ---------------------------------------------------------------------------

async function processUpdate(botId: string, update: Record<string, unknown>) {
  const supabase = getSupabase()

  try {
    // 1. Get bot from database
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("*")
      .like("token", `${botId}:%`)
      .single()

    if (botError || !bot) {
      console.error("[webhook] Bot not found:", botId)
      return
    }

    const botUuid = bot.id
    const botToken = bot.token
    if (!botToken) return

    // 2. Extract message data
    const message = update.message || (update.callback_query as Record<string, unknown>)?.message
    if (!message || typeof message !== "object") return

    const msg = message as Record<string, unknown>
    const chat = msg.chat as Record<string, unknown>
    // Para callback_query, o from do USUARIO que clicou vem de callback_query.from, nao de message.from
    const callbackFrom = (update.callback_query as Record<string, unknown>)?.from as Record<string, unknown> | undefined
    const from = callbackFrom || (msg.from as Record<string, unknown>)
    
    const chatId = chat?.id as number
    const text = (msg.text as string) || ""
    const telegramUserId = from?.id
    const userFirstName = from?.first_name as string
    const userLastName = from?.last_name as string
    const userUsername = from?.username as string

    if (!chatId) return

    // Salvar mensagem recebida no historico (exceto callbacks que nao sao mensagens reais)
    if (text && !update.callback_query) {
      await supabase.from("bot_messages").insert({
        bot_id: botUuid,
        telegram_user_id: String(telegramUserId),
        telegram_chat_id: String(chatId),
        direction: "incoming",
        message_type: "text",
        content: text,
        user_first_name: userFirstName,
        user_last_name: userLastName,
        user_username: userUsername,
        telegram_message_id: msg.message_id as number,
      }).then(() => {}).catch(e => console.error("Erro ao salvar mensagem:", e))
    }

    // 3. Check if callback query (button click)
    const callbackQuery = update.callback_query as Record<string, unknown> | null
    const callbackData = callbackQuery?.data as string | null
    const callbackQueryId = callbackQuery?.id as string | null
    
    // 3.1 Handle callback queries
    if (callbackQuery && callbackData && callbackQueryId) {
      console.log("[v0] Callback recebido:", callbackData, "- isOrderBump:", callbackData.startsWith("ob_"))
      
      // Handle "ver_planos" - show plans as buttons
      if (callbackData === "ver_planos") {
        // Answer callback
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQueryId })
        })
        // Find flow for this bot
        const { data: directFlow } = await supabase
          .from("flows")
          .select("*")
          .eq("bot_id", botUuid)
          .eq("status", "ativo")
          .limit(1)
          .single()
        
        let flowId = directFlow?.id
        let flowForConfig = directFlow
        
        if (!flowId) {
          const { data: flowBot } = await supabase
            .from("flow_bots")
            .select("flow_id")
            .eq("bot_id", botUuid)
            .limit(1)
            .single()
          flowId = flowBot?.flow_id
          
          // Fetch full flow to get config
          if (flowId) {
            const { data: fullFlow } = await supabase
              .from("flows")
              .select("*")
              .eq("id", flowId)
              .single()
            flowForConfig = fullFlow
          }
        }
        
        if (flowId && flowForConfig) {
          // Get plans from flow_plans table first
          const { data: plans } = await supabase
            .from("flow_plans")
            .select("*")
            .eq("flow_id", flowId)
            .eq("is_active", true)
            .order("position", { ascending: true })
          
          // Verificar se Packs esta habilitado
          const flowConfig = (flowForConfig.config as Record<string, unknown>) || {}
          const packsConfig = flowConfig.packs as { enabled?: boolean; buttonText?: string; list?: Array<{ id: string; name: string; price: number; active?: boolean }> } | undefined
          const packsEnabled = packsConfig?.enabled && packsConfig?.list && packsConfig.list.filter(p => p.active !== false).length > 0
          const packsButtonText = packsConfig?.buttonText || "Packs Disponiveis"
          
          if (plans && plans.length > 0) {
            // Build buttons for each plan (only name, no price)
            const planButtons: Array<Array<{ text: string; callback_data: string }>> = plans.map(plan => [{
              text: plan.name,
              callback_data: `plan_${plan.id}`
            }])
            
            await sendTelegramMessage(
              botToken, 
              chatId, 
              "Escolha seu plano:",
              { inline_keyboard: planButtons }
            )
          } else {
            // Fallback: get plans from flow config JSON
            const configPlans = (flowConfig.plans as Array<{ id: string; name: string; price: number }>) || []
            
            if (configPlans.length > 0) {
              const planButtons: Array<Array<{ text: string; callback_data: string }>> = configPlans.map(plan => [{
                text: plan.name,
                callback_data: `plan_${plan.id}`
              }])
              
              await sendTelegramMessage(
                botToken, 
                chatId, 
                "Escolha seu plano:",
                { inline_keyboard: planButtons }
              )
            } else if (packsEnabled) {
              // Apenas packs, sem planos
              await sendTelegramMessage(
                botToken, 
                chatId, 
                "Confira nossas opcoes:",
                { inline_keyboard: [[{ text: packsButtonText, callback_data: "show_packs" }]] }
              )
            } else {
              await sendTelegramMessage(botToken, chatId, "Nenhum plano disponivel no momento.")
            }
          }
        } else {
          await sendTelegramMessage(botToken, chatId, "Fluxo nao encontrado.")
        }
        return
      }
      
      // ========== SHOW PACKS CALLBACK ==========
      if (callbackData === "show_packs") {
        console.log("[v0] Show Packs Callback recebido - botUuid:", botUuid)
        
        // Confirmar recebimento
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQueryId })
        })
        
        // Buscar flow config com packs via flow_bots
        const flowForPacks = await getActiveFlowForBot(supabase, botUuid)
        
        console.log("[v0] flowForPacks encontrado:", !!flowForPacks)
        
        if (flowForPacks) {
          const flowConfig = (flowForPacks.config as Record<string, unknown>) || {}
          console.log("[v0] flowConfig.packs:", JSON.stringify(flowConfig.packs).substring(0, 500))
          
          const packsConfig = flowConfig.packs as { enabled?: boolean; list?: Array<{ id: string; name: string; emoji?: string; price: number; description?: string; previewMedias?: string[]; buttonText?: string; active?: boolean }> } | undefined
          const packsList = packsConfig?.list?.filter(p => p.active !== false) || []
          
          console.log("[v0] packsList.length:", packsList.length)
          
          if (packsList.length > 0) {
            // Enviar cada pack diretamente com foto, descricao e botao de compra
            for (const pack of packsList) {
              const packMessage = `${pack.emoji || "📦"} *${pack.name}*\n\n${pack.description || ""}\n\n💰 *R$ ${pack.price.toFixed(2).replace(".", ",")}*`
              const packButton = [[{
                text: pack.buttonText || `Comprar ${pack.name}`,
                callback_data: `buy_pack_${pack.id}_${pack.price}`
              }]]
              
              // Se tiver imagem de preview, enviar com foto
              if (pack.previewMedias && pack.previewMedias.length > 0) {
                try {
                  await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      photo: pack.previewMedias[0],
                      caption: packMessage,
                      parse_mode: "Markdown",
                      reply_markup: { inline_keyboard: packButton }
                    })
                  })
                } catch {
                  // Se falhar enviar foto, envia so texto
                  await sendTelegramMessage(botToken, chatId, packMessage, { inline_keyboard: packButton })
                }
              } else {
                await sendTelegramMessage(botToken, chatId, packMessage, { inline_keyboard: packButton })
              }
            }
            
            // Botao de voltar aos planos
            await sendTelegramMessage(
              botToken,
              chatId,
              "👆 Escolha um pack acima ou volte aos planos:",
              { inline_keyboard: [[{ text: "⬅️ Voltar aos Planos", callback_data: "back_to_plans" }]] }
            )
          } else {
            console.log("[v0] Nenhum pack ativo encontrado")
            await sendTelegramMessage(botToken, chatId, "Nenhum pack disponivel no momento.")
          }
        } else {
          console.log("[v0] Flow nao encontrado para mostrar packs")
          await sendTelegramMessage(botToken, chatId, "Erro ao carregar packs. Tente novamente.")
        }
        
        return
      }
      
      // ========== BACK TO PLANS CALLBACK ==========
      if (callbackData === "back_to_plans") {
        // Confirmar recebimento
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQueryId })
        })
        
        // Reenviar os planos via flow_bots
        const flowForPlans = await getActiveFlowForBot(supabase, botUuid)
        
        if (flowForPlans) {
          const { data: plans } = await supabase
            .from("flow_plans")
            .select("*")
            .eq("flow_id", flowForPlans.id)
            .eq("is_active", true)
            .order("position", { ascending: true })
          
          if (plans && plans.length > 0) {
            const planButtons: Array<Array<{ text: string; callback_data: string }>> = plans.map(plan => [{
              text: plan.name,
              callback_data: `plan_${plan.id}`
            }])
            
            await sendTelegramMessage(botToken, chatId, "Escolha seu plano:", { inline_keyboard: planButtons })
          }
        }
        
        return
      }
      
      // ========== PACK SELECTION CALLBACK ==========
      if (callbackData.startsWith("pack_")) {
        const packId = callbackData.replace("pack_", "")
        console.log("[v0] Pack Selection Callback:", packId)
        
        // Confirmar recebimento
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQueryId, text: "Carregando pack..." })
        })
        
        // Buscar flow config com packs via flow_bots
        const flowForPack = await getActiveFlowForBot(supabase, botUuid)
        
        if (flowForPack) {
          const flowConfig = (flowForPack.config as Record<string, unknown>) || {}
          const packsConfig = flowConfig.packs as { list?: Array<{ id: string; name: string; emoji?: string; price: number; description?: string; previewMedias?: string[]; buttonText?: string }> } | undefined
          const pack = packsConfig?.list?.find(p => p.id === packId)
          
          if (pack) {
            // Enviar midias de preview se existirem
            if (pack.previewMedias && pack.previewMedias.length > 0) {
              const validMedias = pack.previewMedias.filter(m => m && m.startsWith("http"))
              if (validMedias.length > 0) {
                await sendMediaGroup(botToken, chatId, validMedias, "")
              }
            }
            
            // Enviar descricao com botao de compra
            const description = pack.description || `Pack ${pack.name}`
            const priceText = `R$ ${pack.price.toFixed(2).replace(".", ",")}`
            const buttonText = pack.buttonText || "Comprar Pack"
            
            await sendTelegramMessage(
              botToken,
              chatId,
              `${pack.emoji || "📦"} <b>${pack.name}</b>\n\n${description}\n\n<b>Valor:</b> ${priceText}`,
              { 
                inline_keyboard: [
                  [{ text: buttonText, callback_data: `buy_pack_${pack.id}_${pack.price}` }],
                  [{ text: "Voltar aos Packs", callback_data: "show_packs" }]
                ] 
              }
            )
          }
        }
        
        return
      }
      
      // ========== BUY PACK CALLBACK ==========
      if (callbackData.startsWith("buy_pack_")) {
        const parts = callbackData.replace("buy_pack_", "").split("_")
        const packId = parts[0]
        const packPrice = parseFloat(parts[1]) || 0
        
        console.log("[v0] Buy Pack Callback:", packId, packPrice)
        
        // Confirmar recebimento
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQueryId, text: "Processando..." })
        })
        
        // Buscar flow para ver order bump de packs
        const flowForPack = await getActiveFlowForBot(supabase, botUuid)
        const flowConfig = (flowForPack?.config as Record<string, unknown>) || {}
        const orderBumpConfig = flowConfig.orderBump as { enabled?: boolean; packs?: { enabled?: boolean; name?: string; price?: number; description?: string; acceptText?: string; rejectText?: string; medias?: string[] } } | undefined
        const orderBumpPacks = orderBumpConfig?.packs
        
        console.log("[v0] Pack Order Bump Check - flowId:", flowForPack?.id)
        console.log("[v0] Pack Order Bump Config:", JSON.stringify(orderBumpConfig))
        console.log("[v0] Pack Order Bump Packs:", JSON.stringify(orderBumpPacks))
        console.log("[v0] Conditions - enabled:", orderBumpConfig?.enabled, "packs.enabled:", orderBumpPacks?.enabled, "price:", orderBumpPacks?.price)
        
        // Se order bump de packs estiver habilitado, enviar oferta
        if (orderBumpConfig?.enabled && orderBumpPacks?.enabled && orderBumpPacks.price && orderBumpPacks.price > 0) {
          console.log("[v0] Enviando Order Bump para Pack")
          
          // Salvar estado
          await supabase.from("user_flow_state").upsert({
            bot_id: botUuid,
            telegram_user_id: String(telegramUserId),
            flow_id: flowForPack?.id,
            status: "waiting_order_bump",
            metadata: {
              type: "pack",
              pack_id: packId,
              main_amount: packPrice,
              order_bump_name: orderBumpPacks.name || "Oferta Especial",
              order_bump_price: orderBumpPacks.price,
              main_description: `Pack`
            },
            updated_at: new Date().toISOString()
          }, { onConflict: "bot_id,telegram_user_id" })
          
          // Enviar midias do order bump se houver
          if (orderBumpPacks.medias && orderBumpPacks.medias.length > 0) {
            await sendMediaGroup(botToken, chatId, orderBumpPacks.medias, "")
          }
          
          // Enviar mensagem do order bump
          const obMessage = `*${orderBumpPacks.name || "Oferta Especial"}*\n\n${orderBumpPacks.description || ""}\n\n💰 Por apenas *R$ ${orderBumpPacks.price.toFixed(2).replace(".", ",")}*`
          
          await sendTelegramMessage(botToken, chatId, obMessage, {
            inline_keyboard: [
[{ text: orderBumpPacks.acceptText || "ADICIONAR", callback_data: `ob_accept_${Math.round(packPrice * 100)}_${Math.round(orderBumpPacks.price * 100)}` }],
                [{ text: orderBumpPacks.rejectText || "NAO QUERO", callback_data: `ob_decline_${Math.round(packPrice * 100)}_0` }]
            ]
          })
          
          return
        }
        
        // Sem order bump - gerar PIX direto
        // Buscar dados do bot para pegar user_id
        const { data: botDataPack } = await supabase
          .from("bots")
          .select("user_id")
          .eq("id", botUuid)
          .single()
        
        if (!botDataPack?.user_id) {
          await sendTelegramMessage(botToken, chatId, "Erro: Bot nao configurado.")
          return
        }
        
        // Buscar gateway de pagamento do usuario
        const { data: gatewayPack } = await supabase
          .from("user_gateways")
          .select("*")
          .eq("user_id", botDataPack.user_id)
          .eq("is_active", true)
          .limit(1)
          .single()
        
        if (!gatewayPack?.access_token) {
          await sendTelegramMessage(botToken, chatId, "Erro: Gateway de pagamento nao configurado.")
          return
        }
        
        if (packPrice > 0) {
          try {
            const packsConfig = flowConfig.packs as { list?: Array<{ id: string; name: string }> } | undefined
            const pack = packsConfig?.list?.find(p => p.id === packId)
            const packName = pack?.name || "Pack"
            
            // Gerar PIX chamando a API do Mercado Pago diretamente (igual ao fluxo inicial)
            const pixResponse = await fetch("https://api.mercadopago.com/v1/payments", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${gatewayPack.access_token}`,
                "X-Idempotency-Key": `pack_${packId}_${telegramUserId}_${Date.now()}`,
              },
              body: JSON.stringify({
                transaction_amount: packPrice,
                description: `Pack - ${packName}`,
                payment_method_id: "pix",
                payer: {
                  email: `user${telegramUserId}@telegram.bot`,
                  first_name: (from?.first_name as string) || "Cliente",
                },
                notification_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://dragonteste.onrender.com"}/api/payments/webhook/mercadopago`,
              }),
            })
            
            const pixData = await pixResponse.json()
            
            if (pixData.id && pixData.point_of_interaction?.transaction_data) {
              const txData = pixData.point_of_interaction.transaction_data
              const qrCodeUrl = txData.ticket_url
              const copyPaste = txData.qr_code
              
              // Enviar QR Code
              await sendTelegramPhoto(
                botToken,
                chatId,
                qrCodeUrl,
                `Escaneie o QR Code para pagar\n\nValor: R$ ${packPrice.toFixed(2).replace(".", ",")}\nProduto: ${packName}`
              )
              
              // Enviar codigo PIX
              await sendTelegramMessage(botToken, chatId, `Clique no codigo abaixo para copiar:\n\n<code>${copyPaste}</code>`)
              
              // Salvar pagamento
              console.log("[v0] Saving pack payment - user_id:", botDataPack.user_id, "bot_id:", botUuid, "amount:", packPrice)
              const { data: savedPayment, error: saveError } = await supabase.from("payments").insert({
                user_id: botDataPack.user_id,
                bot_id: botUuid,
                telegram_user_id: String(telegramUserId),
                telegram_username: from?.username || null,
                telegram_first_name: from?.first_name || null,
                amount: packPrice,
                status: "pending",
                payment_method: "pix",
                gateway: "mercadopago",
                external_payment_id: String(pixData.id),
                product_name: packName,
                product_type: "pack",
                qr_code_url: qrCodeUrl,
                copy_paste: copyPaste,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }).select().single()
              
              if (saveError) {
                console.error("[v0] Error saving pack payment:", saveError)
              } else {
                console.log("[v0] Pack payment saved:", savedPayment?.id)
              }
            } else {
              console.error("[v0] Erro PIX Pack:", pixData)
              await sendTelegramMessage(botToken, chatId, "Erro ao gerar pagamento. Tente novamente.")
            }
          } catch (err) {
            console.error("[v0] Erro ao gerar PIX do pack:", err)
            await sendTelegramMessage(botToken, chatId, "Erro ao processar pagamento.")
          }
        } else {
          await sendTelegramMessage(botToken, chatId, "Preco invalido.")
        }
        
        return
      }
      
      // ========== ORDER BUMP CALLBACKS ==========
      if (callbackData.startsWith("ob_accept_") || callbackData.startsWith("ob_decline_")) {
        console.log("[v0] Order Bump Callback recebido:", callbackData, "botUuid:", botUuid, "telegramUserId:", telegramUserId)
        
        // Answer callback query imediatamente
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQueryId })
        })
        
        const isAccept = callbackData.startsWith("ob_accept_")
        const parts = callbackData.replace("ob_accept_", "").replace("ob_decline_", "").split("_")
        console.log("[v0] Order Bump parts:", parts, "isAccept:", isAccept)
        
        // Buscar metadata do order bump salvo no estado
        const { data: userState, error: stateError } = await supabase
          .from("user_flow_state")
          .select("metadata, flow_id")
          .eq("bot_id", botUuid)
          .eq("telegram_user_id", String(telegramUserId))
          .eq("status", "waiting_order_bump")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single()
        
        console.log("[v0] Order Bump userState:", userState, "error:", stateError)
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metadata = userState?.metadata as Record<string, any> | null
        const orderBumpName = metadata?.order_bump_name || "Order Bump"
        const mainDescription = metadata?.main_description || "Produto Principal"
        
        let totalAmount = 0
        let description = mainDescription
        
        if (isAccept) {
          // Valores vem em centavos, converter para reais
          const mainAmountCents = parseInt(parts[0]) || 0
          const bumpAmountCents = parseInt(parts[1]) || 0
          const mainAmount = mainAmountCents / 100
          const bumpAmount = bumpAmountCents / 100
          totalAmount = mainAmount + bumpAmount
          description = `${mainDescription} + ${orderBumpName}`
          console.log("[v0] Order Bump ACEITO - main:", mainAmount, "bump:", bumpAmount, "TOTAL:", totalAmount)
        } else {
          // Valor vem em centavos
          const mainAmountCents = parseInt(parts[0]) || 0
          totalAmount = mainAmountCents / 100
          description = mainDescription
          console.log("[v0] Order Bump RECUSADO - Total:", totalAmount)
        }
        
        console.log("[v0] Order Bump - totalAmount calculado:", totalAmount)
        if (totalAmount <= 0) {
          console.log("[v0] Order Bump ERRO - totalAmount <= 0, retornando")
          await sendTelegramMessage(botToken, chatId, "Erro ao processar. Tente novamente.")
          return
        }
        
        // Atualizar estado
        await supabase
          .from("user_flow_state")
          .update({ status: "payment_pending", updated_at: new Date().toISOString() })
          .eq("bot_id", botUuid)
          .eq("telegram_user_id", String(telegramUserId))
        
        // Enviar mensagem de processamento
        await sendTelegramMessage(
          botToken,
          chatId,
          `${isAccept ? "Otimo! " : ""}Gerando pagamento PIX...\n\nValor: R$ ${totalAmount.toFixed(2).replace(".", ",")}`,
          undefined
        )
        
        // Get user_id from bot to find gateway
        const { data: botDataOB } = await supabase
          .from("bots")
          .select("user_id")
          .eq("id", botUuid)
          .single()
        
        if (!botDataOB?.user_id) {
          await sendTelegramMessage(botToken, chatId, "Erro: Bot nao encontrado.", undefined)
          return
        }
        
        // Get gateway
        const { data: gatewayOB } = await supabase
          .from("user_gateways")
          .select("*")
          .eq("user_id", botDataOB.user_id)
          .eq("is_active", true)
          .limit(1)
          .single()
        
        if (!gatewayOB || !gatewayOB.access_token) {
          await sendTelegramMessage(botToken, chatId, "Gateway de pagamento nao configurado.", undefined)
          return
        }
        
        // Generate PIX
        try {
          const pixResultOB = await createPixPayment({
            accessToken: gatewayOB.access_token,
            amount: totalAmount,
            description: `Pagamento - ${description}`,
            payerEmail: "cliente@email.com",
          })
          
          if (!pixResultOB.success) {
            await sendTelegramMessage(botToken, chatId, `Erro ao gerar PIX: ${pixResultOB.error || "Tente novamente"}`, undefined)
            return
          }
          
          // Send QR Code
          if (pixResultOB.qrCodeUrl) {
            await sendTelegramPhoto(
              botToken,
              chatId,
              pixResultOB.qrCodeUrl,
              `Escaneie o QR Code para pagar\n\nValor: R$ ${totalAmount.toFixed(2).replace(".", ",")}\nProduto: ${description}`
            )
          }
          
          // Send PIX code - usando <code> HTML para ser clicavel
          if (pixResultOB.copyPaste) {
            await sendTelegramMessage(
              botToken,
              chatId,
              `Clique no codigo abaixo para copiar:\n\n<code>${pixResultOB.copyPaste}</code>`,
              undefined
            )
          }
          
          // Determinar product_type baseado no tipo de compra (pack ou plan)
          const sourceType = metadata?.type === "pack" ? "pack" : "plan"
          const productType = isAccept ? `${sourceType}_order_bump` : sourceType
          
          // Save payment
          console.log("[v0] Saving OB payment - user_id:", botDataOB.user_id, "bot_id:", botUuid, "amount:", totalAmount)
          const { error: obPaymentError } = await supabase.from("payments").insert({
            bot_id: botUuid,
            user_id: botDataOB.user_id,
            flow_id: userState?.flow_id,
            amount: totalAmount,
            status: "pending",
            payment_method: "pix",
            gateway: "mercadopago",
            external_payment_id: pixResultOB.paymentId,
            pix_code: pixResultOB.copyPaste,
            qr_code: pixResultOB.qrCodeBase64,
            telegram_user_id: String(telegramUserId),
            telegram_chat_id: String(chatId),
            product_name: description,
            product_type: productType,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          if (obPaymentError) {
            console.error("[v0] Error saving OB payment:", obPaymentError)
          } else {
            console.log("[v0] OB payment saved successfully")
          }
          
        } catch (pixError) {
          console.error("[v0] Erro ao gerar PIX para Order Bump:", pixError)
          await sendTelegramMessage(botToken, chatId, "Erro ao gerar pagamento. Tente novamente.", undefined)
        }
        
        return
      }
      // ========== FIM ORDER BUMP CALLBACKS ==========

      // ========== UPSELL CALLBACKS ==========
      if (callbackData.startsWith("up_accept_") || callbackData.startsWith("up_decline_")) {
        console.log("[v0] Upsell Callback recebido:", callbackData)
        
        const isAccept = callbackData.startsWith("up_accept_")
        
        // Buscar estado atual do usuario
        const { data: userState } = await supabase
          .from("user_flow_state")
          .select("metadata, flow_id")
          .eq("bot_id", botUuid)
          .eq("telegram_user_id", String(telegramUserId))
          .eq("status", "waiting_upsell")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single()
        
        if (!userState) {
          console.log("[v0] Estado de upsell nao encontrado")
          await answerCallback(botToken, callbackQueryId, "Sessao expirada")
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metadata = userState.metadata as Record<string, any> | null
        const currentUpsellIndex = metadata?.upsell_index || 0
        const upsellPrice = metadata?.upsell_price || 0
        const upsellName = metadata?.upsell_name || "Upsell"

        // Buscar config do fluxo
        const { data: flowData } = await supabase
          .from("flows")
          .select("config")
          .eq("id", userState.flow_id)
          .single()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const flowConfig = flowData?.config as Record<string, any> | null
        const upsellSequences = flowConfig?.upsell?.sequences || []

        if (isAccept) {
          // Usuario aceitou o upsell - gerar pagamento
          console.log(`[v0] Usuario ${telegramUserId} aceitou upsell ${currentUpsellIndex} - R$ ${upsellPrice}`)
          
          await answerCallback(botToken, callbackQueryId, "Gerando pagamento...")

          // Buscar gateway de pagamento e user_id
          const { data: gateway } = await supabase
            .from("user_gateways")
            .select("*")
            .eq("bot_id", botUuid)
            .eq("is_active", true)
            .limit(1)
            .single()

          if (!gateway?.access_token) {
            await sendTelegramMessage(botToken, chatId, "Erro: Gateway de pagamento nao configurado. Entre em contato com o suporte.")
            return
          }

          // Buscar user_id do bot owner
          const { data: botOwner } = await supabase
            .from("bots")
            .select("user_id")
            .eq("id", botUuid)
            .single()

          // Gerar PIX para o upsell
          try {
            const pixResponse = await fetch("https://api.mercadopago.com/v1/payments", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${gateway.access_token}`,
                "X-Idempotency-Key": `upsell_${botUuid}_${telegramUserId}_${currentUpsellIndex}_${Date.now()}`,
              },
              body: JSON.stringify({
                transaction_amount: upsellPrice,
                description: upsellName,
                payment_method_id: "pix",
                payer: {
                  email: `user${telegramUserId}@telegram.bot`,
                  first_name: (from?.first_name as string) || "Cliente",
                },
                notification_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://dragonteste.onrender.com"}/api/payments/webhook/mercadopago`,
              }),
            })

            const pixData = await pixResponse.json()
            console.log("[v0] Upsell PIX Response:", JSON.stringify(pixData))

            if (pixData.id && pixData.point_of_interaction?.transaction_data?.qr_code) {
              // Salvar pagamento do upsell
              console.log("[v0] Saving upsell payment - user_id:", botOwner?.user_id, "bot_id:", botUuid, "amount:", upsellPrice)
              const { error: upsellPaymentError } = await supabase.from("payments").insert({
                user_id: botOwner?.user_id,
                bot_id: botUuid,
                telegram_user_id: String(telegramUserId),
                amount: upsellPrice,
                status: "pending",
                payment_method: "pix",
                external_payment_id: String(pixData.id),
                product_type: "upsell",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              if (upsellPaymentError) {
                console.error("[v0] Error saving upsell payment:", upsellPaymentError)
              } else {
                console.log("[v0] Upsell payment saved successfully")
              }

              // Atualizar estado
              await supabase
                .from("user_flow_state")
                .update({
                  status: "waiting_upsell_payment",
                  metadata: {
                    ...metadata,
                    upsell_payment_id: pixData.id,
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq("bot_id", botUuid)
                .eq("telegram_user_id", String(telegramUserId))

              // Enviar QR Code
              const qrCodeBase64 = pixData.point_of_interaction.transaction_data.qr_code_base64
              const pixCopiaECola = pixData.point_of_interaction.transaction_data.qr_code

              if (qrCodeBase64) {
                await sendTelegramPhoto(
                  botToken, 
                  chatId, 
                  `data:image/png;base64,${qrCodeBase64}`,
                  `<b>${upsellName}</b>\n\nValor: R$ ${upsellPrice.toFixed(2).replace(".", ",")}\n\nEscaneie o QR Code ou copie o codigo abaixo:`
                )
              }

              // Enviar codigo PIX
              await sendTelegramMessage(
                botToken,
                chatId,
                `<code>${pixCopiaECola}</code>\n\nApos o pagamento, voce recebera a confirmacao automaticamente.`
              )
            } else {
              console.error("[v0] Erro ao gerar PIX do upsell:", pixData)
              await sendTelegramMessage(botToken, chatId, "Erro ao gerar pagamento. Tente novamente.")
            }
          } catch (error) {
            console.error("[v0] Erro ao processar upsell:", error)
            await sendTelegramMessage(botToken, chatId, "Erro ao processar. Tente novamente.")
          }
        } else {
          // Usuario recusou o upsell
          console.log(`[v0] Usuario ${telegramUserId} recusou upsell ${currentUpsellIndex}`)
          
          await answerCallback(botToken, callbackQueryId, "Entendido!")

          const nextIndex = currentUpsellIndex + 1

          if (nextIndex < upsellSequences.length) {
            // Tem mais upsell - verificar timing e enviar proximo
            const nextUpsell = upsellSequences[nextIndex]
            
            // Atualizar estado com proximo upsell
            await supabase
              .from("user_flow_state")
              .update({
                status: "waiting_upsell",
                metadata: {
                  upsell_index: nextIndex,
                  upsell_name: nextUpsell.name,
                  upsell_price: nextUpsell.price,
                },
                updated_at: new Date().toISOString(),
              })
              .eq("bot_id", botUuid)
              .eq("telegram_user_id", String(telegramUserId))

            // Enviar proximo upsell
            if (nextUpsell.sendTiming === "immediate") {
              // Enviar midias
              if (nextUpsell.medias && nextUpsell.medias.length > 0) {
                for (const mediaUrl of nextUpsell.medias) {
                  if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
                    await sendTelegramVideo(botToken, chatId, mediaUrl, "")
                  } else {
                    await sendTelegramPhoto(botToken, chatId, mediaUrl, "")
                  }
                  await new Promise(r => setTimeout(r, 500))
                }
              }

              // Montar botoes
              const inlineKeyboard: { inline_keyboard: { text: string; callback_data: string }[][] } = {
                inline_keyboard: [
                  [{ text: nextUpsell.acceptButtonText || "Quero essa oferta!", callback_data: `up_accept_${nextUpsell.price}_${nextIndex}` }]
                ]
              }

              if (!nextUpsell.hideRejectButton) {
                inlineKeyboard.inline_keyboard.push([
                  { text: nextUpsell.rejectButtonText || "Nao tenho interesse", callback_data: `up_decline_${nextIndex}` }
                ])
              }

              const message = nextUpsell.message || `Oferta especial: ${nextUpsell.name}\n\nValor: R$ ${(nextUpsell.price || 0).toFixed(2).replace(".", ",")}`
              await sendTelegramMessage(botToken, chatId, message, inlineKeyboard)
            }
          } else {
            // Acabou os upsells - enviar entrega
            console.log(`[v0] Todos os upsells processados, enviando entrega`)
            
            // Atualizar estado
            await supabase
              .from("user_flow_state")
              .update({
                status: "completed",
                updated_at: new Date().toISOString(),
              })
              .eq("bot_id", botUuid)
              .eq("telegram_user_id", String(telegramUserId))

            // Enviar entrega
            const delivery = flowConfig?.delivery
            if (delivery) {
              if (delivery.medias && delivery.medias.length > 0) {
                for (const mediaUrl of delivery.medias) {
                  if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
                    await sendTelegramVideo(botToken, chatId, mediaUrl, "")
                  } else {
                    await sendTelegramPhoto(botToken, chatId, mediaUrl, "")
                  }
                  await new Promise(r => setTimeout(r, 500))
                }
              }

              if (delivery.link) {
                const buttonText = delivery.linkText || "Acessar conteudo"
                const keyboard = {
                  inline_keyboard: [
                    [{ text: buttonText, url: delivery.link }]
                  ]
                }
                await sendTelegramMessage(botToken, chatId, "Seu acesso foi liberado! Clique no botao abaixo:", keyboard)
              } else {
                await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu acesso foi liberado.")
              }
            } else {
              await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu acesso foi liberado.")
            }
          }
        }

        return
      }
      // ========== FIM UPSELL CALLBACKS ==========
      
      // ========== DOWNSELL CALLBACKS ==========
      if (callbackData.startsWith("ds_accept_") || callbackData.startsWith("ds_decline_")) {
        console.log("[v0] Downsell Callback recebido:", callbackData)
        
        const isAccept = callbackData.startsWith("ds_accept_")
        
        // Confirmar recebimento do callback
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: isAccept ? "Gerando pagamento..." : "Oferta recusada"
          })
        })
        
        if (isAccept) {
          // ds_accept_sequenceId_price
          const parts = callbackData.replace("ds_accept_", "").split("_")
          const sequenceId = parts[0]
          const price = parseFloat(parts[1]) || 0
          
          if (price > 0) {
            // Buscar gateway de pagamento
            const { data: gateway } = await supabase
              .from("payment_gateways")
              .select("*")
              .eq("bot_id", botUuid)
              .eq("is_active", true)
              .single()
            
            if (gateway) {
              try {
                // Gerar PIX para o downsell
                const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://dragonteste.onrender.com"}/api/mercadopago/pix`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    accessToken: gateway.credentials?.access_token,
                    amount: price,
                    description: `Downsell - Oferta Especial`,
                    email: `${telegramUserId}@telegram.user`,
                    externalReference: `downsell_${sequenceId}_${telegramUserId}_${Date.now()}`
                  })
                })
                
                const pixResult = await response.json()
                
                if (pixResult.success && pixResult.qrCode) {
                  // Enviar QR Code
                  await sendTelegramPhoto(botToken, chatId, pixResult.qrCode, 
                    `Pague R$ ${price.toFixed(2).replace(".", ",")} via PIX\n\nCopie o codigo abaixo:`
                  )
                  await sendTelegramMessage(botToken, chatId, `<code>${pixResult.copyPaste}</code>`)
                  
                  // Salvar pagamento
                  console.log("[v0] Saving downsell payment - user_id:", botData?.user_id, "bot_id:", botUuid, "amount:", price)
                  const { error: downsellPaymentError } = await supabase.from("payments").insert({
                    user_id: botData?.user_id,
                    bot_id: botUuid,
                    telegram_user_id: String(telegramUserId),
                    telegram_username: from?.username || null,
                    telegram_first_name: from?.first_name || null,
                    gateway: gateway.gateway_name || "mercadopago",
                    external_payment_id: pixResult.paymentId,
                    amount: price,
                    description: `Downsell - Oferta Especial`,
                    qr_code: pixResult.qrCode,
                    qr_code_url: pixResult.qrCodeUrl,
                    copy_paste: pixResult.copyPaste,
                    status: "pending",
                    product_type: "downsell"
                  })
                  if (downsellPaymentError) {
                    console.error("[v0] Error saving downsell payment:", downsellPaymentError)
                  } else {
                    console.log("[v0] Downsell payment saved successfully")
                  }
                  
                  // Cancelar outros downsells pendentes
                  await supabase
                    .from("scheduled_messages")
                    .update({ status: "cancelled" })
                    .eq("bot_id", botUuid)
                    .eq("telegram_user_id", String(telegramUserId))
                    .eq("message_type", "downsell")
                    .eq("status", "pending")
                    
                } else {
                  await sendTelegramMessage(botToken, chatId, "Erro ao gerar pagamento. Tente novamente mais tarde.")
                }
              } catch (err) {
                console.error("Erro ao gerar PIX do downsell:", err)
                await sendTelegramMessage(botToken, chatId, "Erro ao processar pagamento.")
              }
            } else {
              await sendTelegramMessage(botToken, chatId, "Pagamento nao disponivel no momento.")
            }
          }
        } else {
          // Usuario recusou o downsell
          await sendTelegramMessage(botToken, chatId, "Tudo bem! Se mudar de ideia, estamos aqui.")
        }
        
        return
      }
      // ========== FIM DOWNSELL CALLBACKS ==========
      
      // Handle plan selection - generate PIX
      if (callbackData.startsWith("plan_")) {
        const planId = callbackData.replace("plan_", "")
        
        // First try to get plan from flow_plans table
        let planName = ""
        let planPrice = 0
        let flowIdForGateway = ""
        
        const { data: dbPlan } = await supabase
          .from("flow_plans")
          .select("*, flows!inner(id, config, bot_id)")
          .eq("id", planId)
          .single()
        
        if (dbPlan) {
          planName = dbPlan.name
          planPrice = Number(dbPlan.price)
          flowIdForGateway = dbPlan.flows?.id || ""
        } else {
          // Try to find plan in flow config - check direct flow first
          let flowWithPlan = null
          
          const directFlow = await getActiveFlowForBot(supabase, botUuid)
          
          if (directFlow) {
            flowWithPlan = directFlow
          } else {
            // Check via flow_bots table
            const { data: flowBot } = await supabase
              .from("flow_bots")
              .select("flow_id")
              .eq("bot_id", botUuid)
              .limit(1)
              .single()
            
            if (flowBot?.flow_id) {
              const { data: linkedFlow } = await supabase
                .from("flows")
                .select("id, config, bot_id")
                .eq("id", flowBot.flow_id)
                .single()
              flowWithPlan = linkedFlow
            }
          }
          
          if (flowWithPlan) {
            const flowConfig = (flowWithPlan.config as Record<string, unknown>) || {}
            const configPlans = (flowConfig.plans as Array<{ id: string; name: string; price: number }>) || []
            const foundPlan = configPlans.find(p => p.id === planId)
            
            if (foundPlan) {
              planName = foundPlan.name
              planPrice = Number(foundPlan.price)
              flowIdForGateway = flowWithPlan.id
            }
          }
        }
        
        if (!planName || planPrice <= 0) {
          await sendTelegramMessage(botToken, chatId, "Plano nao encontrado.")
          return
        }
        
        // ========== VERIFICAR ORDER BUMP ANTES DE GERAR PAGAMENTO ==========
        // Buscar o fluxo vinculado ao bot para verificar Order Bump
        let flowForOrderBump: { id: string; config: unknown } | null = null
        
        // Primeiro tenta pelo bot_id direto
        const { data: directFlowOB } = await supabase
          .from("flows")
          .select("id, config")
          .eq("bot_id", botUuid)
          .limit(1)
          .single()
        
        if (directFlowOB) {
          flowForOrderBump = directFlowOB
        } else {
          // Se nao encontrou, busca via flow_bots
          const { data: flowBotLink } = await supabase
            .from("flow_bots")
            .select("flow_id")
            .eq("bot_id", botUuid)
            .limit(1)
            .single()
          
          if (flowBotLink) {
            const { data: linkedFlow } = await supabase
              .from("flows")
              .select("id, config")
              .eq("id", flowBotLink.flow_id)
              .single()
            
            if (linkedFlow) {
              flowForOrderBump = linkedFlow
            }
          }
        }
        
        console.log("[v0] Order Bump - flowForOrderBump encontrado:", !!flowForOrderBump)
        
        if (flowForOrderBump) {
          const flowConfig = (flowForOrderBump.config as Record<string, unknown>) || {}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const orderBumpConfig = flowConfig.orderBump as Record<string, any> | undefined
          const orderBumpInicial = orderBumpConfig?.inicial
          
          console.log("[v0] Order Bump Check - config:", !!orderBumpConfig, "inicial:", !!orderBumpInicial, "enabled:", orderBumpInicial?.enabled, "price:", orderBumpInicial?.price)
          
          if (orderBumpInicial?.enabled && orderBumpInicial?.price > 0) {
            console.log("[v0] Order Bump ATIVADO! Enviando oferta ao usuario...")
            
            const orderBumpDesc = orderBumpInicial.description || `Deseja adicionar ${orderBumpInicial.name || "este bonus"} por apenas R$ ${orderBumpInicial.price}?`
            const orderBumpAcceptText = orderBumpInicial.acceptText || "ADICIONAR"
            const orderBumpDeclineText = orderBumpInicial.rejectText || "NAO QUERO"
            
            // Formato: ob_accept_{mainAmount}_{bumpAmount} ou ob_decline_{mainAmount}
            // Arredondar precos para evitar problemas com decimais no callback
            const mainPriceRounded = Math.round(planPrice * 100)
            const bumpPriceRounded = Math.round(orderBumpInicial.price * 100)
            const acceptCallback = `ob_accept_${mainPriceRounded}_${bumpPriceRounded}`
            const declineCallback = `ob_decline_${mainPriceRounded}`
            console.log("[v0] Order Bump callbacks:", acceptCallback, declineCallback)
            
            const orderBumpKeyboard = {
              inline_keyboard: [
                [{ text: orderBumpAcceptText, callback_data: acceptCallback }],
                [{ text: orderBumpDeclineText, callback_data: declineCallback }]
              ]
            }
            
            // Enviar mensagem do plano selecionado
            await sendTelegramMessage(
              botToken,
              chatId,
              `Voce selecionou: *${planName}*\n\nValor: R$ ${planPrice.toFixed(2).replace(".", ",")}`,
              undefined
            )
            
            // Enviar midias do order bump se houver
            if (orderBumpInicial.medias && orderBumpInicial.medias.length > 0) {
              console.log("[v0] Enviando midias do Order Bump:", orderBumpInicial.medias.length)
              await sendMediaGroup(botToken, chatId, orderBumpInicial.medias, "")
            }
            
            // Enviar oferta do Order Bump
            await sendTelegramMessage(botToken, chatId, orderBumpDesc, orderBumpKeyboard)
            
            // Salvar estado para quando usuario responder
            console.log("[v0] Salvando estado Order Bump - bot_id:", botUuid, "telegram_user_id:", String(telegramUserId))
            const { error: stateUpsertError } = await supabase.from("user_flow_state").upsert({
              bot_id: botUuid,
              telegram_user_id: String(telegramUserId),
              flow_id: flowForOrderBump.id,
              status: "waiting_order_bump",
              current_node_position: 0,
              metadata: {
                order_bump_name: orderBumpInicial.name || "Order Bump",
                order_bump_price: orderBumpInicial.price,
                main_amount: planPrice,
                main_description: planName
              },
              updated_at: new Date().toISOString()
            }, {
              onConflict: "bot_id,telegram_user_id"
            })
            if (stateUpsertError) {
              console.error("[v0] Erro ao salvar estado Order Bump:", stateUpsertError)
            } else {
              console.log("[v0] Estado Order Bump salvo com sucesso")
            }
            
            return // STOP - aguardar decisao do Order Bump
          }
        }
        // ========== FIM ORDER BUMP ==========
        
        // Send processing message
        await sendTelegramMessage(
          botToken,
          chatId,
          `Voce selecionou: *${planName}*\n\nValor: R$ ${planPrice.toFixed(2).replace(".", ",")}\n\nGerando pagamento PIX...`,
          undefined
        )
        
        // Get user_id from bot to find gateway (gateway is per user, not per bot)
        const { data: botData } = await supabase
          .from("bots")
          .select("user_id")
          .eq("id", botUuid)
          .single()
        
        if (!botData?.user_id) {
          await sendTelegramMessage(botToken, chatId, "Erro: Bot nao encontrado.", undefined)
          return
        }
        
        // Get gateway for this user (all bots use the same gateway)
        const { data: gateway, error: gwError } = await supabase
          .from("user_gateways")
          .select("*")
          .eq("user_id", botData.user_id)
          .eq("is_active", true)
          .limit(1)
          .single()
        
        console.log("[v0] Gateway lookup - user_id:", botData.user_id, "found:", !!gateway, "has_token:", !!gateway?.access_token, "error:", gwError?.message)
        
        if (!gateway || !gateway.access_token) {
          await sendTelegramMessage(
            botToken,
            chatId,
            "Gateway de pagamento nao configurado. Entre em contato com o suporte.",
            undefined
          )
          return
        }
        
        // Generate PIX using existing payment gateway
        try {
          const pixResult = await createPixPayment({
            accessToken: gateway.access_token,
            amount: planPrice,
            description: `Pagamento - ${planName}`,
            payerEmail: "luismarquesdevp@gmail.com",
          })
          
          if (!pixResult.success) {
            await sendTelegramMessage(
              botToken,
              chatId,
              `Erro ao gerar PIX: ${pixResult.error || "Tente novamente"}`,
              undefined
            )
            return
          }
          
          // Send QR Code image
          if (pixResult.qrCodeUrl) {
            await sendTelegramPhoto(
              botToken,
              chatId,
              pixResult.qrCodeUrl,
              `Escaneie o QR Code para pagar\n\nValor: R$ ${planPrice.toFixed(2).replace(".", ",")}\nPlano: ${planName}`
            )
          }
          
          // Send PIX copy-paste code - usando <code> HTML para ser clicavel
          if (pixResult.copyPaste) {
            await sendTelegramMessage(
              botToken,
              chatId,
              `Clique no codigo abaixo para copiar:\n\n<code>${pixResult.copyPaste}</code>`,
              undefined
            )
          }
          
          // Get user_id from bot
          const { data: botData } = await supabase
            .from("bots")
            .select("user_id")
            .eq("id", botUuid)
            .single()
          
          // Save payment record with correct fields including Telegram user info
          console.log("[v0] Saving plan payment - user_id:", botData?.user_id, "bot_id:", botUuid, "amount:", planPrice)
          const { data: savedPlanPayment, error: savePlanError } = await supabase.from("payments").insert({
            user_id: botData?.user_id,
            bot_id: botUuid,
            telegram_user_id: String(telegramUserId),
            telegram_username: from?.username || null,
            telegram_first_name: from?.first_name || null,
            telegram_last_name: from?.last_name || null,
            gateway: gateway.gateway_name || "mercadopago",
            external_payment_id: pixResult.paymentId,
            amount: planPrice,
            description: `Pagamento - ${planName}`,
            qr_code: pixResult.qrCode,
            qr_code_url: pixResult.qrCodeUrl,
            copy_paste: pixResult.copyPaste,
            status: "pending",
          }).select().single()
          
          if (savePlanError) {
            console.error("[v0] Error saving plan payment:", savePlanError)
          } else {
            console.log("[v0] Plan payment saved:", savedPlanPayment?.id)
          }
          
          // DOWNSELLS DO TIPO "PIX" (para quem gerou pix mas nao pagou)
          // Buscar flow para pegar config de downsell
          const { data: flowForDownsell } = await supabase
            .from("flows")
            .select("id, config")
            .eq("bot_id", botUuid)
            .eq("status", "ativo")
            .limit(1)
            .single()
          
          if (flowForDownsell) {
            const flowConfig = (flowForDownsell.config as Record<string, unknown>) || {}
            const downsellConfig = flowConfig.downsell as { enabled?: boolean; sequences?: Array<{ 
              id: string; message: string; medias?: string[]; sendTiming?: string; sendDelayValue?: number; sendDelayUnit?: string; 
              price: number; targetType?: string; deliveryType?: string 
            }> } | undefined
            
            if (downsellConfig?.enabled && downsellConfig.sequences && downsellConfig.sequences.length > 0) {
              const now = new Date()
              
              // Apenas sequencias do tipo "pix"
              const pixSequences = downsellConfig.sequences.filter(s => s.targetType === "pix")
              
              for (const seq of pixSequences) {
                const isImmediate = !seq.sendTiming || seq.sendTiming === "immediate"
                
                if (isImmediate) {
                  // ENVIAR IMEDIATAMENTE
                  try {
                    if (seq.medias && seq.medias.length > 0) {
                      const validMedias = seq.medias.filter(m => m && !m.startsWith("data:") && m.startsWith("http"))
                      if (validMedias.length > 0) {
                        await sendMediaGroup(botToken, chatId, validMedias, seq.message || "")
                      } else if (seq.message) {
                        await sendTelegramMessage(botToken, chatId, seq.message)
                      }
                    } else if (seq.message) {
                      await sendTelegramMessage(botToken, chatId, seq.message)
                    }
                    
                    if (seq.price > 0) {
                      const inlineKeyboard = {
                        inline_keyboard: [
                          [{ text: `Quero por R$ ${seq.price.toFixed(2).replace(".", ",")}!`, callback_data: `ds_accept_${seq.id}_${seq.price}` }],
                          [{ text: "Nao tenho interesse", callback_data: `ds_decline_${seq.id}` }]
                        ]
                      }
                      await sendTelegramMessage(botToken, chatId, "Aproveite esta oferta especial:", inlineKeyboard)
                    }
                  } catch (err) {
                    console.error("[DOWNSELL PIX] Erro ao enviar imediato:", err)
                  }
                } else {
                  // AGENDAR PARA DEPOIS
                  let delayMinutes = seq.sendDelayValue || 30
                  if (seq.sendDelayUnit === "hours") delayMinutes = (seq.sendDelayValue || 1) * 60
                  else if (seq.sendDelayUnit === "days") delayMinutes = (seq.sendDelayValue || 1) * 60 * 24
                  
                  const scheduledFor = new Date(now.getTime() + delayMinutes * 60 * 1000)
                  
                  await supabase.from("scheduled_messages").insert({
                    bot_id: botUuid,
                    flow_id: flowForDownsell.id,
                    telegram_user_id: String(telegramUserId),
                    telegram_chat_id: String(chatId),
                    message_type: "downsell",
                    sequence_id: seq.id,
                    sequence_index: pixSequences.indexOf(seq),
                    scheduled_for: scheduledFor.toISOString(),
                    status: "pending",
                    metadata: {
                      message: seq.message,
                      medias: seq.medias || [],
                      price: seq.price,
                      deliveryType: seq.deliveryType,
                      botToken: botToken,
                      targetType: "pix",
                      pixPaymentId: pixResult.paymentId,
                    }
                  })
                }
              }
              
              console.log(`[DOWNSELL PIX] Processed ${pixSequences.length} pix downsells for user ${telegramUserId}`)
            }
          }
          
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          console.error("PIX generation error:", errorMsg)
          await sendTelegramMessage(
            botToken,
            chatId,
            `Erro ao processar pagamento: ${errorMsg}`,
            undefined
          )
        }
        
        return
      }
    }
    
    // 4. Check if /start command
    const isStart = text.toLowerCase().startsWith("/start")

    // 5. Get or create lead AND bot_user
    if (telegramUserId && isStart) {
      // 5.1 Insert/Update bot_users (for Clientes page)
      const { data: existingBotUser } = await supabase
        .from("bot_users")
        .select("id")
        .eq("bot_id", botUuid)
        .eq("telegram_user_id", telegramUserId)
        .limit(1)
        .single()

      if (existingBotUser) {
        // Update existing user
        await supabase
          .from("bot_users")
          .update({
            first_name: (from.first_name as string) || null,
            last_name: (from.last_name as string) || null,
            username: (from.username as string) || null,
            last_activity: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("bot_id", botUuid)
          .eq("telegram_user_id", telegramUserId)
      } else {
        // Insert new user
        const { error: botUserError } = await supabase.from("bot_users").insert({
          bot_id: botUuid,
          telegram_user_id: telegramUserId,
          chat_id: chatId,
          first_name: (from.first_name as string) || null,
          last_name: (from.last_name as string) || null,
          username: (from.username as string) || null,
          funnel_step: 1,
          is_subscriber: false,
          last_activity: new Date().toISOString(),
        })
        
        if (botUserError) {
          console.error("[webhook] Erro ao inserir bot_user:", botUserError.message, botUserError.code)
        }
      }

      // 5.2 Insert lead (legacy support)
      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .eq("bot_id", botUuid)
        .eq("telegram_id", String(telegramUserId))
        .single()

      if (!existingLead) {
        const { error: leadError } = await supabase.from("leads").insert({
          bot_id: botUuid,
          telegram_id: String(telegramUserId),
          chat_id: String(chatId),
          first_name: (from.first_name as string) || "",
          last_name: (from.last_name as string) || "",
          username: (from.username as string) || "",
          status: "active",
          source: "telegram"
        })
        
        if (leadError) {
          console.error("[webhook] Erro ao inserir lead:", leadError.message, leadError.code)
        }
      }
    }

    // 6. Process /start - execute welcome flow
    if (isStart) {
      // Find flow for this bot
      let startFlow = null

      // Strategy 1: Check flows.bot_id (direct link)
      const { data: directFlow } = await supabase
        .from("flows")
        .select("*")
        .eq("bot_id", botUuid)
        .eq("status", "ativo")
        .order("is_primary", { ascending: false })
        .limit(1)
        .single()

      if (directFlow) {
        startFlow = directFlow
      } else {
        // Strategy 2: Check flow_bots table (many-to-many link from /fluxos page)
        const { data: flowBotLink } = await supabase
          .from("flow_bots")
          .select("flow_id")
          .eq("bot_id", botUuid)
          .limit(1)
          .single()

        if (flowBotLink) {
          const { data: linkedFlow } = await supabase
            .from("flows")
            .select("*")
            .eq("id", flowBotLink.flow_id)
            .single()

          if (linkedFlow) {
            startFlow = linkedFlow
          }
        }
      }

      // Strategy 3: Any flow from user (last resort)
      if (!startFlow) {
        const { data: anyUserFlow } = await supabase
          .from("flows")
          .select("*")
          .eq("user_id", bot.user_id)
          .eq("status", "ativo")
          .order("created_at", { ascending: false })
          .limit(1)
          .single()

        startFlow = anyUserFlow
      }

      if (startFlow) {
        // Get flow config (contains all settings from /fluxos/[id] page)
        const flowConfig = (startFlow.config as Record<string, unknown>) || {}
        
        // Helper to replace variables
        const replaceVars = (text: string) => {
          if (!text) return ""
          return text
            .replace(/\{nome\}/gi, (from?.first_name as string) || "")
            .replace(/\{username\}/gi, (from?.username as string) ? `@${from.username}` : "")
            .replace(/\{bot\.username\}/gi, bot.username ? `@${bot.username}` : bot.name || "")
        }
        
        // Get welcome message - try config first, then table field
        const welcomeMsg = (flowConfig.welcomeMessage as string) || (startFlow.welcome_message as string) || ""
        
        // Get medias - filter out base64 (Telegram only accepts URLs)
        const allMedias = (flowConfig.welcomeMedias as string[]) || []
        const welcomeMedias = allMedias.filter(m => m && !m.startsWith("data:") && (m.startsWith("http") || m.startsWith("/")))
        
        const ctaButtonText = (flowConfig.ctaButtonText as string) || "Ver Planos"
        const redirectButton = flowConfig.redirectButton as { enabled?: boolean; text?: string; url?: string } || {}
        const secondaryMsg = flowConfig.secondaryMessage as { enabled?: boolean; message?: string } || {}
        
        // Verificar se Packs esta habilitado
        const packsConfig = flowConfig.packs as { enabled?: boolean; buttonText?: string; list?: Array<{ id: string; active?: boolean }> } | undefined
        const packsEnabled = packsConfig?.enabled && packsConfig?.list && packsConfig.list.filter(p => p.active !== false).length > 0
        const packsButtonText = packsConfig?.buttonText || "Packs Disponiveis"
        
        // Always send welcome flow (we have at least a default message)
        const finalMsg = replaceVars(welcomeMsg) || `Ola! Bem-vindo ao ${bot.name || "bot"}.`
        
        // Build inline keyboard with buttons
        const inlineKeyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = []
        
        // CTA Button (Ver Planos) - callback button
        inlineKeyboard.push([{ text: ctaButtonText, callback_data: "ver_planos" }])
        
        // Packs Button - se habilitado, adiciona na mensagem de boas-vindas
        if (packsEnabled) {
          inlineKeyboard.push([{ text: packsButtonText, callback_data: "show_packs" }])
        }
        
        // Redirect Button - URL button (if enabled)
        if (redirectButton.enabled && redirectButton.text && redirectButton.url) {
          inlineKeyboard.push([{ text: redirectButton.text, url: redirectButton.url }])
        }
        
        const replyMarkup = { inline_keyboard: inlineKeyboard }
        
        // STEP 1: Send medias (if any valid URLs) - grouped as album
        if (welcomeMedias.length > 0) {
          try {
            // Send all medias together as album with welcome message as caption
            await sendMediaGroup(botToken, chatId, welcomeMedias, finalMsg)
            // Send buttons separately after the album
            await sendTelegramMessage(botToken, chatId, "Escolha uma opcao:", replyMarkup)
          } catch {
            // If media group fails, send message with buttons normally
            await sendTelegramMessage(botToken, chatId, finalMsg, replyMarkup)
          }
        } else {
          // STEP 2: No medias - send welcome message with buttons
          await sendTelegramMessage(botToken, chatId, finalMsg, replyMarkup)
        }
        
        // STEP 3: Send secondary message (if enabled)
        if (secondaryMsg.enabled && secondaryMsg.message) {
          await new Promise(resolve => setTimeout(resolve, 500))
          await sendTelegramMessage(botToken, chatId, replaceVars(secondaryMsg.message))
        }
        
        // STEP 4: Send/Schedule downsell sequences (enviadas para quem NAO pagou)
        const downsellConfig = flowConfig.downsell as { enabled?: boolean; sequences?: Array<{ 
          id: string; message: string; medias?: string[]; sendTiming?: string; sendDelayValue?: number; sendDelayUnit?: string; 
          price: number; targetType?: string; deliveryType?: string 
        }> } | undefined
        
        if (downsellConfig?.enabled && downsellConfig.sequences && downsellConfig.sequences.length > 0) {
          const now = new Date()
          
          // Cancelar agendamentos anteriores deste usuario
          await supabase
            .from("scheduled_messages")
            .update({ status: "cancelled" })
            .eq("bot_id", botUuid)
            .eq("telegram_user_id", String(telegramUserId))
            .eq("status", "pending")
          
          // Sequencias do tipo "geral" (para todos que derem start)
          const geralSequences = downsellConfig.sequences.filter(s => s.targetType === "geral" || !s.targetType)
          
          for (const seq of geralSequences) {
            const isImmediate = !seq.sendTiming || seq.sendTiming === "immediate"
            
            if (isImmediate) {
              // ENVIAR IMEDIATAMENTE - nao depende de cron
              try {
                // Enviar midias se tiver
                if (seq.medias && seq.medias.length > 0) {
                  const validMedias = seq.medias.filter(m => m && !m.startsWith("data:") && m.startsWith("http"))
                  if (validMedias.length > 0) {
                    await sendMediaGroup(botToken, chatId, validMedias, seq.message || "")
                  } else if (seq.message) {
                    await sendTelegramMessage(botToken, chatId, seq.message)
                  }
                } else if (seq.message) {
                  await sendTelegramMessage(botToken, chatId, seq.message)
                }
                
                // Enviar botoes de Aceitar/Recusar
                if (seq.price > 0) {
                  const inlineKeyboard = {
                    inline_keyboard: [
                      [{ text: `Quero por R$ ${seq.price.toFixed(2).replace(".", ",")}!`, callback_data: `ds_accept_${seq.id}_${seq.price}` }],
                      [{ text: "Nao tenho interesse", callback_data: `ds_decline_${seq.id}` }]
                    ]
                  }
                  await sendTelegramMessage(botToken, chatId, "Aproveite esta oferta especial:", inlineKeyboard)
                }
              } catch (err) {
                console.error("[DOWNSELL] Erro ao enviar downsell imediato:", err)
              }
            } else {
              // AGENDAR PARA DEPOIS - salva no banco para cron externo processar
              let delayMinutes = seq.sendDelayValue || 30
              if (seq.sendDelayUnit === "hours") delayMinutes = (seq.sendDelayValue || 1) * 60
              else if (seq.sendDelayUnit === "days") delayMinutes = (seq.sendDelayValue || 1) * 60 * 24
              
              const scheduledFor = new Date(now.getTime() + delayMinutes * 60 * 1000)
              
              await supabase.from("scheduled_messages").insert({
                bot_id: botUuid,
                flow_id: startFlow.id,
                telegram_user_id: String(telegramUserId),
                telegram_chat_id: String(chatId),
                message_type: "downsell",
                sequence_id: seq.id,
                sequence_index: geralSequences.indexOf(seq),
                scheduled_for: scheduledFor.toISOString(),
                status: "pending",
                metadata: {
                  message: seq.message,
                  medias: seq.medias || [],
                  price: seq.price,
                  deliveryType: seq.deliveryType,
                  botToken: botToken,
                }
              })
            }
          }
        }
        
        return

        // Fallback: Get flow nodes
        const { data: nodes } = await supabase
          .from("flow_nodes")
          .select("*")
          .eq("flow_id", startFlow.id)
          .order("position", { ascending: true })

        if (nodes && nodes.length > 0) {
          for (const node of nodes) {
            await executeNode(botToken, chatId, node, from as Record<string, unknown>)
            await new Promise(resolve => setTimeout(resolve, 300))
          }
        } else {
          await sendTelegramMessage(botToken, chatId, `Ola! Bem-vindo ao ${bot.name || "bot"}.`)
        }
      } else {
        await sendTelegramMessage(botToken, chatId, `Ola! Bem-vindo ao ${bot.name || "bot"}.`)
      }
    }
  } catch (error) {
    console.error("[webhook] Error processing:", error)
  }
}

// ---------------------------------------------------------------------------
// Execute a flow node
// ---------------------------------------------------------------------------

async function executeNode(botToken: string, chatId: number, node: Record<string, unknown>, from?: Record<string, unknown>) {
  const nodeType = node.type as string
  const config = (node.config as Record<string, unknown>) || {}
  const subVariant = (config.subVariant as string) || ""

  // Helper to replace variables
  const replaceVars = (text: string) => {
    return text
      .replace(/\{nome\}/gi, (from?.first_name as string) || "")
      .replace(/\{username\}/gi, (from?.username as string) ? `@${from.username}` : "")
  }

  switch (nodeType) {
    case "trigger":
      break

    case "text":
    case "message": {
      let text = (config.text as string) || (config.content as string) || ""
      text = replaceVars(text)
      const mediaUrl = (config.media_url as string) || ""
      const mediaType = (config.media_type as string) || ""
      
      let buttons: Array<{ text: string; url: string }> = []
      const buttonsRaw = config.buttons
      if (buttonsRaw) {
        try {
          buttons = typeof buttonsRaw === "string" ? JSON.parse(buttonsRaw) : (Array.isArray(buttonsRaw) ? buttonsRaw : [])
        } catch { buttons = [] }
      }

      let replyMarkup = undefined
      if (buttons.length > 0) {
        const validButtons = buttons.filter(b => b.text && b.url)
        if (validButtons.length > 0) {
          replyMarkup = { inline_keyboard: validButtons.map(b => [{ text: b.text, url: b.url }]) }
        }
      }

      if (mediaUrl && mediaType && mediaType !== "none") {
        if (mediaType === "photo") {
          await sendTelegramPhoto(botToken, chatId, mediaUrl, text || undefined)
          return
        } else if (mediaType === "video") {
          await sendTelegramVideo(botToken, chatId, mediaUrl, text || undefined)
          return
        }
      }

      if (text) {
        await sendTelegramMessage(botToken, chatId, text, replyMarkup)
      }
      break
    }

    case "image": {
      const imageUrl = (config.url as string) || (config.media_url as string) || ""
      const caption = (config.caption as string) || (config.text as string) || ""
      if (imageUrl) await sendTelegramPhoto(botToken, chatId, imageUrl, caption || undefined)
      break
    }

    case "video": {
      const videoUrl = (config.url as string) || (config.media_url as string) || ""
      const videoCaption = (config.caption as string) || (config.text as string) || ""
      if (videoUrl) await sendTelegramVideo(botToken, chatId, videoUrl, videoCaption || undefined)
      break
    }

    case "delay": {
      const seconds = parseInt(String(config.seconds)) || 1
      await new Promise(resolve => setTimeout(resolve, seconds * 1000))
      break
    }

    case "action": {
      if (subVariant === "add_group") {
        const groupLink = config.action_name as string
        if (groupLink) {
          await sendTelegramMessage(botToken, chatId, `Entre no grupo:`, {
            inline_keyboard: [[{ text: "Entrar no Grupo", url: groupLink }]]
          })
        }
      }
      break
    }

    case "payment": {
      const paymentButtonsRaw = config.payment_buttons as string
      if (paymentButtonsRaw) {
        try {
          const paymentButtons = JSON.parse(paymentButtonsRaw)
          if (paymentButtons.length > 0) {
            const firstBtn = paymentButtons[0]
            await sendTelegramMessage(botToken, chatId, `${firstBtn.text}\nValor: R$ ${firstBtn.amount}`, {
              inline_keyboard: [[{ text: `Pagar R$ ${firstBtn.amount}`, callback_data: `pay_${firstBtn.id}` }]]
            })
          }
        } catch { /* ignore */ }
      }
      break
    }
  }
}

// ---------------------------------------------------------------------------
// POST /api/telegram/webhook/[botId]
// RESPONDE IMEDIATAMENTE - Processa em background
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  // Parse body ANTES de responder
  let update: Record<string, unknown> = {}
  try {
    update = await req.json()
  } catch {
    return new Response("ok")
  }

  // Log para debug - ver todas as requisicoes
  const callbackData = (update.callback_query as Record<string, unknown>)?.data as string | null
  console.log("[v0] WEBHOOK RECEBIDO - botId:", botId, "callback:", callbackData || "nenhum", "hasMessage:", !!update.message)

  // Processar em background (NAO bloqueia resposta)
  processUpdate(botId, update).catch(console.error)

  // RESPONDER IMEDIATAMENTE
  return new Response("ok")
}

// ---------------------------------------------------------------------------
// GET - For webhook verification
// ---------------------------------------------------------------------------

export async function GET() {
  return new Response("Webhook active")
}
