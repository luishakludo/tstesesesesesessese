import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// GET: Return referral stats for a user
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  try {
    // Buscar contagem de referrals
    const { count, error } = await supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const totalReferrals = count || 0

    // Buscar o saldo de afiliado do usuario (affiliate_balance_adjustment)
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("affiliate_balance_adjustment")
      .eq("id", userId)
      .single()

    if (userError) {
      console.error("[v0] Error fetching user balance:", userError.message)
    }

    // O saldo ajustado pelo admin
    const affiliateBalanceAdjustment = Number(userData?.affiliate_balance_adjustment) || 0
    console.log("[v0] Stats - userData:", userData)
    console.log("[v0] Stats - affiliateBalanceAdjustment:", affiliateBalanceAdjustment)

    // Buscar total de saques para calcular saldo disponivel
    const { data: withdrawsData } = await supabase
      .from("referral_withdraws")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "approved")

    const totalWithdrawn = withdrawsData?.reduce((acc, w) => acc + (Number(w.amount) || 0), 0) || 0
    console.log("[v0] Stats - withdrawsData:", withdrawsData)
    console.log("[v0] Stats - totalWithdrawn:", totalWithdrawn)

    // Saldo disponivel = ajuste do admin - saques
    const totalEarnings = affiliateBalanceAdjustment - totalWithdrawn
    console.log("[v0] Stats - totalEarnings (final):", totalEarnings)

    return NextResponse.json({
      total_referrals: totalReferrals,
      total_sales: 0, // Por enquanto nao tem vendas
      total_earnings: totalEarnings,
      affiliate_balance_adjustment: affiliateBalanceAdjustment,
      total_withdrawn: totalWithdrawn,
    })
  } catch (err) {
    console.error("[v0] Stats GET error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
