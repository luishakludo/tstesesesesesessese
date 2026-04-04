import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { userId, amount, type, reason } = await request.json()

    if (!userId || amount === undefined || !type) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount < 0) {
      return NextResponse.json({ error: "Valor invalido" }, { status: 400 })
    }

    // Verificar se usuario existe
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 })
    }

    // Calcular saldo atual baseado em referrals e withdraws
    const { data: referrals } = await supabaseAdmin
      .from("referrals")
      .select("commission_amount")
      .eq("referrer_id", userId)
    
    const { data: withdraws } = await supabaseAdmin
      .from("referral_withdraws")
      .select("amount, status")
      .eq("user_id", userId)
      .in("status", ["approved", "paid"])
    
    const totalEarnings = referrals?.reduce((acc, r) => acc + (Number(r.commission_amount) || 0), 0) || 0
    const totalWithdrawn = withdraws?.reduce((acc, w) => acc + (Number(w.amount) || 0), 0) || 0
    const currentBalance = totalEarnings - totalWithdrawn

    let adjustmentAmount = 0

    if (type === "set") {
      // Para definir um valor especifico, calcular a diferenca
      adjustmentAmount = numAmount - currentBalance
    } else if (type === "add") {
      adjustmentAmount = numAmount
    } else if (type === "subtract") {
      adjustmentAmount = -numAmount
    } else {
      return NextResponse.json({ error: "Tipo de operacao invalido" }, { status: 400 })
    }

    // Inserir ajuste na tabela referrals como uma comissao de ajuste manual
    if (adjustmentAmount !== 0) {
      const { error: insertError } = await supabaseAdmin
        .from("referrals")
        .insert({
          referrer_id: userId,
          referred_id: userId, // auto-referencia para ajuste manual
          commission_amount: adjustmentAmount,
          status: "admin_adjustment",
          created_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error("[v0] Error inserting adjustment:", insertError)
        return NextResponse.json({ error: "Erro ao ajustar saldo: " + insertError.message }, { status: 500 })
      }
    }

    const newBalance = currentBalance + adjustmentAmount

    return NextResponse.json({ 
      success: true, 
      previousBalance: currentBalance,
      newBalance: newBalance,
      adjustment: adjustmentAmount
    })
  } catch (error) {
    console.error("[v0] Error updating affiliate balance:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
