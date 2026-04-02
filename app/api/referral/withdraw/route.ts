import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { userId, amount, name, cpf, pixKey } = await request.json()

    if (!userId || !amount || !name || !cpf || !pixKey) {
      return NextResponse.json(
        { error: "Todos os campos sao obrigatorios" },
        { status: 400 }
      )
    }

    if (amount < 10) {
      return NextResponse.json(
        { error: "Valor minimo de R$ 10,00" },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // Verificar saldo disponivel
    const { data: stats } = await supabase.rpc("get_referral_stats", { p_referrer_id: userId })
    const totalEarnings = stats?.[0]?.total_earnings || 0

    // Verificar saques pendentes
    const { data: pendingWithdraws } = await supabase
      .from("referral_withdraws")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "pending")

    const pendingAmount = pendingWithdraws?.reduce((acc, w) => acc + Number(w.amount), 0) || 0
    const availableBalance = totalEarnings - pendingAmount

    if (amount > availableBalance) {
      return NextResponse.json(
        { error: "Saldo insuficiente" },
        { status: 400 }
      )
    }

    // Criar solicitacao de saque
    const { data, error } = await supabase
      .from("referral_withdraws")
      .insert({
        user_id: userId,
        amount,
        name,
        cpf,
        pix_key: pixKey,
        status: "pending",
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating withdraw:", error)
      return NextResponse.json(
        { error: "Erro ao criar solicitacao de saque" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, withdraw: data })
  } catch (error) {
    console.error("Withdraw error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

// GET - List user's withdraws
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "userId obrigatorio" }, { status: 400 })
  }

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from("referral_withdraws")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar saques" }, { status: 500 })
  }

  return NextResponse.json({ withdraws: data })
}
