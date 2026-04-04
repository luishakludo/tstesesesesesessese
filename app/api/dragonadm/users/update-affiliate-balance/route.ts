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

    // Buscar usuario atual
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, affiliate_balance")
      .eq("id", userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 })
    }

    const currentBalance = Number(user.affiliate_balance) || 0
    let newBalance = currentBalance

    if (type === "set") {
      newBalance = numAmount
    } else if (type === "add") {
      newBalance = currentBalance + numAmount
    } else if (type === "subtract") {
      newBalance = currentBalance - numAmount
    } else {
      return NextResponse.json({ error: "Tipo de operacao invalido" }, { status: 400 })
    }

    // Atualizar o campo affiliate_balance diretamente na tabela users
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ affiliate_balance: newBalance })
      .eq("id", userId)

    if (updateError) {
      return NextResponse.json({ error: "Erro ao atualizar saldo" }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      previousBalance: currentBalance,
      newBalance: newBalance,
      adjustment: newBalance - currentBalance
    })
  } catch (error) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
