import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    // Buscar todos os usuarios (profiles)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (profilesError) {
      console.error("Erro ao buscar profiles:", profilesError)
      return NextResponse.json({ error: "Erro ao buscar usuarios" }, { status: 500 })
    }

    // Buscar todos os bots
    const { data: allBots } = await supabase
      .from("bots")
      .select("id, name, username, is_active, created_at, user_id")

    // Buscar todas as gateways
    const { data: allGateways } = await supabase
      .from("payment_gateways")
      .select("id, gateway_name, is_active, created_at, user_id")

    // Buscar todos os referrals
    const { data: allReferrals } = await supabase
      .from("referrals")
      .select(`
        id,
        referrer_id,
        referred_id,
        created_at,
        referred:referred_id (
          id,
          email,
          name,
          created_at
        )
      `)

    // Buscar pagamentos por usuario (para stats)
    const { data: allPayments } = await supabase
      .from("payments")
      .select("user_id, amount, status")
      .eq("status", "approved")

    // Buscar starts por bot
    const { data: allStarts } = await supabase
      .from("telegram_users")
      .select("bot_id")

    // Mapear bots por user_id para contar starts
    const botsByUser: Record<string, string[]> = {}
    allBots?.forEach(bot => {
      if (!botsByUser[bot.user_id]) {
        botsByUser[bot.user_id] = []
      }
      botsByUser[bot.user_id].push(bot.id)
    })

    // Contar starts por user
    const startsByBot: Record<string, number> = {}
    allStarts?.forEach(start => {
      if (!startsByBot[start.bot_id]) {
        startsByBot[start.bot_id] = 0
      }
      startsByBot[start.bot_id]++
    })

    // Montar resposta com dados agregados
    const users = profiles?.map(profile => {
      const userBots = allBots?.filter(b => b.user_id === profile.id) || []
      const userGateways = allGateways?.filter(g => g.user_id === profile.id) || []
      const userReferrals = allReferrals?.filter(r => r.referrer_id === profile.id) || []
      const userPayments = allPayments?.filter(p => p.user_id === profile.id) || []

      // Calcular total de starts dos bots do usuario
      const userBotIds = userBots.map(b => b.id)
      const totalStarts = userBotIds.reduce((acc, botId) => acc + (startsByBot[botId] || 0), 0)

      return {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        banned: profile.banned || false,
        created_at: profile.created_at,
        bots: userBots.map(b => ({
          id: b.id,
          name: b.name,
          username: b.username,
          is_active: b.is_active,
          created_at: b.created_at,
        })),
        gateways: userGateways.map(g => ({
          id: g.id,
          gateway_name: g.gateway_name,
          is_active: g.is_active,
          created_at: g.created_at,
        })),
        referrals: userReferrals.map(r => ({
          id: r.id,
          email: (r.referred as any)?.email || "",
          name: (r.referred as any)?.name || "",
          created_at: (r.referred as any)?.created_at || r.created_at,
        })),
        stats: {
          totalStarts,
          totalPayments: userPayments.length,
          totalRevenue: userPayments.reduce((acc, p) => acc + (p.amount || 0), 0),
        },
      }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Erro ao buscar usuarios:", error)
    return NextResponse.json({ error: "Erro ao buscar usuarios" }, { status: 500 })
  }
}
