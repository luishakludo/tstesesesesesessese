import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    // Buscar total de usuarios
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })

    // Buscar usuarios ativos (nao banidos)
    const { count: activeUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("banned", false)

    // Buscar usuarios banidos
    const { count: bannedUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("banned", true)

    // Buscar total de bots
    const { count: totalBots } = await supabase
      .from("bots")
      .select("*", { count: "exact", head: true })

    // Buscar bots ativos
    const { count: activeBots } = await supabase
      .from("bots")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

    // Buscar total de pagamentos
    const { count: totalPayments } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })

    // Buscar pagamentos pendentes
    const { count: pendingPayments } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")

    // Buscar receita total (pagamentos aprovados)
    const { data: revenueData } = await supabase
      .from("payments")
      .select("amount")
      .eq("status", "approved")

    const totalRevenue = revenueData?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      bannedUsers: bannedUsers || 0,
      totalBots: totalBots || 0,
      activeBots: activeBots || 0,
      totalPayments: totalPayments || 0,
      pendingPayments: pendingPayments || 0,
      totalRevenue,
    })
  } catch (error) {
    console.error("Erro ao buscar stats:", error)
    return NextResponse.json({ error: "Erro ao buscar estatisticas" }, { status: 500 })
  }
}
