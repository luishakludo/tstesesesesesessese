import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { userId, amount, type, reason } = await request.json()

    console.log("[v0] Update affiliate balance - userId:", userId, "amount:", amount, "type:", type)

    if (!userId || amount === undefined || !type) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount < 0) {
      return NextResponse.json({ error: "Valor invalido" }, { status: 400 })
    }

    // Buscar usuario atual para pegar o ajuste existente
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("affiliate_balance_adjustment")
      .eq("id", userId)
      .single()

    if (userError) {
      console.error("[v0] Error fetching user:", userError)
      return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 })
    }

    const currentAdjustment = Number(user?.affiliate_balance_adjustment) || 0

    // Buscar saldo atual baseado em referrals e withdraws
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
    const currentBalance = totalEarnings - totalWithdrawn + currentAdjustment

    let newAdjustment = currentAdjustment

    if (type === "set") {
      // Para definir um saldo especifico, calcular o ajuste necessario
      // novoSaldo = totalEarnings - totalWithdrawn + novoAjuste
      // novoAjuste = novoSaldo - totalEarnings + totalWithdrawn
      newAdjustment = numAmount - totalEarnings + totalWithdrawn
    } else if (type === "add") {
      // Adicionar ao ajuste atual
      newAdjustment = currentAdjustment + numAmount
    } else if (type === "subtract") {
      // Subtrair do ajuste atual
      newAdjustment = currentAdjustment - numAmount
    } else {
      return NextResponse.json({ error: "Tipo de operacao invalido" }, { status: 400 })
    }

    // Atualizar o campo affiliate_balance_adjustment na tabela users
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ 
        affiliate_balance_adjustment: newAdjustment,
        affiliate_balance_reason: reason || null
      })
      .eq("id", userId)

    if (updateError) {
      console.error("[v0] Error updating user:", updateError)
      return NextResponse.json({ error: "Erro ao atualizar saldo" }, { status: 500 })
    }

    const newBalance = totalEarnings - totalWithdrawn + newAdjustment

    console.log("[v0] Balance updated - previous:", currentBalance, "new:", newBalance, "adjustment:", newAdjustment)

    return NextResponse.json({ 
      success: true, 
      previousBalance: currentBalance,
      newBalance: newBalance,
      adjustment: newAdjustment - currentAdjustment
    })
  } catch (error) {
    console.error("[v0] Error updating affiliate balance:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
