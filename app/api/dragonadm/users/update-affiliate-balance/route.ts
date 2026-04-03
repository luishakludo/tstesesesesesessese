import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

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

    if (type === "set") {
      // Para definir um saldo especifico, precisamos calcular a diferenca
      // e inserir um registro de ajuste na tabela referral_sales
      
      // Buscar saldo atual
      const { data: currentSales } = await supabase
        .from("referral_sales")
        .select("amount")
        .eq("referrer_id", userId)
      
      const { data: currentWithdraws } = await supabase
        .from("referral_withdraws")
        .select("amount, status")
        .eq("user_id", userId)
        .in("status", ["approved", "paid"])
      
      const totalEarnings = currentSales?.reduce((acc, s) => acc + (Number(s.amount) || 0), 0) || 0
      const totalWithdrawn = currentWithdraws?.reduce((acc, w) => acc + (Number(w.amount) || 0), 0) || 0
      const currentBalance = totalEarnings - totalWithdrawn
      
      // Calcular diferenca necessaria
      const difference = numAmount - currentBalance
      
      if (difference !== 0) {
        // Inserir ajuste na tabela referral_sales
        const { error: insertError } = await supabase
          .from("referral_sales")
          .insert({
            referrer_id: userId,
            referred_id: userId, // auto-referencia para ajustes manuais
            amount: difference,
            source: "admin_adjustment",
            description: reason || `Ajuste administrativo: ${difference > 0 ? "+" : ""}R$ ${difference.toFixed(2)}`,
            created_at: new Date().toISOString(),
          })
        
        if (insertError) {
          console.error("Error inserting adjustment:", insertError)
          return NextResponse.json({ error: "Erro ao ajustar saldo" }, { status: 500 })
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        previousBalance: currentBalance,
        newBalance: numAmount,
        adjustment: difference
      })
    } else if (type === "add") {
      // Adicionar valor ao saldo
      const { error: insertError } = await supabase
        .from("referral_sales")
        .insert({
          referrer_id: userId,
          referred_id: userId,
          amount: numAmount,
          source: "admin_credit",
          description: reason || `Credito administrativo: +R$ ${numAmount.toFixed(2)}`,
          created_at: new Date().toISOString(),
        })
      
      if (insertError) {
        console.error("Error inserting credit:", insertError)
        return NextResponse.json({ error: "Erro ao adicionar credito" }, { status: 500 })
      }
      
      return NextResponse.json({ success: true, added: numAmount })
    } else if (type === "subtract") {
      // Subtrair valor do saldo (inserir valor negativo)
      const { error: insertError } = await supabase
        .from("referral_sales")
        .insert({
          referrer_id: userId,
          referred_id: userId,
          amount: -numAmount,
          source: "admin_debit",
          description: reason || `Debito administrativo: -R$ ${numAmount.toFixed(2)}`,
          created_at: new Date().toISOString(),
        })
      
      if (insertError) {
        console.error("Error inserting debit:", insertError)
        return NextResponse.json({ error: "Erro ao subtrair valor" }, { status: 500 })
      }
      
      return NextResponse.json({ success: true, subtracted: numAmount })
    }

    return NextResponse.json({ error: "Tipo de operacao invalido" }, { status: 400 })
  } catch (error) {
    console.error("Error updating affiliate balance:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
