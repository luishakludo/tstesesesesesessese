import { getSupabase } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get("campaign_id")

  try {
    // Get all campaigns or specific one
    let campaignsQuery = supabase
      .from("campaigns")
      .select("id, name, status, audience_type, audience, bot_id, created_at")
      .order("created_at", { ascending: false })

    if (campaignId) {
      campaignsQuery = campaignsQuery.eq("id", campaignId)
    }

    const { data: campaigns, error: campaignsError } = await campaignsQuery.limit(10)

    if (campaignsError) {
      return NextResponse.json({ error: "Erro ao buscar campanhas", details: campaignsError }, { status: 500 })
    }

    const results = []

    for (const campaign of campaigns || []) {
      // Get campaign nodes
      const { data: nodes } = await supabase
        .from("campaign_nodes")
        .select("id, position, content, media_url, media_type, delay_minutes")
        .eq("campaign_id", campaign.id)
        .order("position", { ascending: true })

      // Get bot info
      const { data: bot } = await supabase
        .from("bots")
        .select("id, name, token")
        .eq("id", campaign.bot_id)
        .single()

      // Count users based on audience
      let usersQuery
      let userCount = 0
      let usersSample: { telegram_user_id: string; chat_id: number | null; funnel_step?: number; is_subscriber?: boolean }[] = []

      if (campaign.audience_type === "imported") {
        // Get imported users
        const { data: importedUsers, count } = await supabase
          .from("bot_users")
          .select("telegram_user_id, chat_id", { count: "exact" })
          .eq("bot_id", campaign.bot_id)
          .eq("source", "imported")
          .limit(5)

        userCount = count || 0
        usersSample = importedUsers || []
      } else {
        // Get all bot users
        const { data: allUsers } = await supabase
          .from("bot_users")
          .select("telegram_user_id, chat_id, funnel_step, is_subscriber")
          .eq("bot_id", campaign.bot_id)

        // Get payments for filtering
        const { data: payments } = await supabase
          .from("payments")
          .select("telegram_user_id, status")
          .eq("bot_id", campaign.bot_id)

        const pendingPaymentUsers = new Set<string>()
        const paidUsers = new Set<string>()

        if (payments) {
          for (const payment of payments) {
            const tgId = payment.telegram_user_id?.toString()
            if (!tgId) continue
            const status = (payment.status || "").toLowerCase()
            if (status === "pending" || status === "aguardando" || status === "pix_gerado") {
              pendingPaymentUsers.add(tgId)
            }
            if (status === "approved" || status === "paid" || status === "pago") {
              paidUsers.add(tgId)
            }
          }
        }

        let filteredUsers = allUsers || []

        if (campaign.audience === "started_not_continued") {
          filteredUsers = (allUsers || []).filter(u => {
            const step = typeof u.funnel_step === "number" ? u.funnel_step : parseInt(String(u.funnel_step || "0"))
            return step >= 1 && step < 3 && !u.is_subscriber
          })
        } else if (campaign.audience === "not_paid") {
          filteredUsers = (allUsers || []).filter(u => {
            const tgId = u.telegram_user_id?.toString()
            const hasPending = pendingPaymentUsers.has(tgId)
            const alreadyPaid = paidUsers.has(tgId) || u.is_subscriber === true
            return hasPending && !alreadyPaid
          })
        } else if (campaign.audience === "paid") {
          filteredUsers = (allUsers || []).filter(u => {
            const tgId = u.telegram_user_id?.toString()
            return u.is_subscriber === true || paidUsers.has(tgId)
          })
        }

        userCount = filteredUsers.length
        usersSample = filteredUsers.slice(0, 5)
      }

      // Check campaign_user_progress
      const { data: progress, count: progressCount } = await supabase
        .from("campaign_user_progress")
        .select("*", { count: "exact" })
        .eq("campaign_id", campaign.id)
        .limit(5)

      // Check if bot token is valid
      let botTokenValid = false
      let botTokenPreview = ""
      if (bot?.token) {
        botTokenPreview = bot.token.substring(0, 10) + "..." + bot.token.substring(bot.token.length - 5)
        botTokenValid = bot.token.length > 20 && bot.token.includes(":")
      }

      results.push({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          audience_type: campaign.audience_type,
          audience: campaign.audience,
          created_at: campaign.created_at,
        },
        bot: {
          id: bot?.id,
          name: bot?.name,
          token_preview: botTokenPreview,
          token_valid: botTokenValid,
        },
        nodes: {
          count: nodes?.length || 0,
          details: nodes?.map(n => ({
            position: n.position,
            has_content: !!n.content,
            content_preview: n.content?.substring(0, 50) + (n.content?.length > 50 ? "..." : ""),
            has_media: !!n.media_url,
            media_type: n.media_type,
            delay_minutes: n.delay_minutes,
          })),
        },
        target_users: {
          total_count: userCount,
          sample: usersSample.map(u => ({
            telegram_user_id: u.telegram_user_id,
            chat_id: u.chat_id,
            has_chat_id: !!u.chat_id,
          })),
        },
        progress: {
          users_with_progress: progressCount || 0,
          sample: progress?.map(p => ({
            user_id: p.user_id,
            current_node_index: p.current_node_index,
            status: p.status,
            last_sent_at: p.last_sent_at,
          })),
        },
        diagnosis: {
          can_send: campaign.status === "ativa" && botTokenValid && userCount > 0 && (nodes?.length || 0) > 0,
          issues: [
            campaign.status !== "ativa" ? `Status da campanha: "${campaign.status}" (precisa ser "ativa")` : null,
            !botTokenValid ? "Token do bot invalido ou ausente" : null,
            userCount === 0 ? `Nenhum usuario encontrado para audience_type="${campaign.audience_type}" audience="${campaign.audience}"` : null,
            (nodes?.length || 0) === 0 ? "Campanha sem mensagens/nodes configurados" : null,
            usersSample.some(u => !u.chat_id) ? "Alguns usuarios nao tem chat_id (necessario para enviar mensagem)" : null,
          ].filter(Boolean),
        },
      })
    }

    return NextResponse.json({
      total_campaigns: results.length,
      campaigns: results,
    })
  } catch (error) {
    return NextResponse.json({ error: "Erro interno", details: String(error) }, { status: 500 })
  }
}
