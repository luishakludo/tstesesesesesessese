import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    // Buscar todos os usuarios de todos os bots
    const { data: botUsers, error } = await supabaseAdmin
      .from("bot_users")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching bot users:", error)
      return NextResponse.json({ error: "Erro ao buscar usuarios" }, { status: 500 })
    }

    // Buscar todos os pagamentos aprovados
    const { data: approvedPayments, error: paymentsError } = await supabaseAdmin
      .from("payments")
      .select("telegram_user_id, bot_id, status")
      .eq("status", "approved")

    if (paymentsError) {
      console.error("Error fetching payments:", paymentsError)
    }

    // Criar um mapa de usuarios que pagaram (por bot_id + telegram_user_id)
    const paidUsersMap = new Set<string>()
    for (const payment of approvedPayments || []) {
      if (payment.telegram_user_id && payment.bot_id) {
        paidUsersMap.add(`${payment.bot_id}:${payment.telegram_user_id}`)
      }
    }

    // Enriquecer usuarios com status de pagamento calculado
    const enrichedUsers = (botUsers || []).map(user => {
      const key = `${user.bot_id}:${user.telegram_user_id}`
      const hasPaid = paidUsersMap.has(key)
      
      // Calcular payment_status baseado em regras de negocio:
      // - paid: tem pagamento aprovado
      // - subscriber: e assinante ativo
      // - abandoned: funnel_step == 1 (so deu start, nao avancou)
      // - pending: avancou no funil mas nao pagou
      let calculatedPaymentStatus = "pending"
      
      if (user.is_subscriber) {
        calculatedPaymentStatus = "subscriber"
      } else if (hasPaid) {
        calculatedPaymentStatus = "paid"
      } else if (user.funnel_step === 1) {
        calculatedPaymentStatus = "abandoned"
      } else {
        calculatedPaymentStatus = "not_paid"
      }

      return {
        ...user,
        payment_status: calculatedPaymentStatus,
        has_approved_payment: hasPaid
      }
    })

    // Agrupar usuarios por bot_id
    const usersByBot: Record<string, typeof enrichedUsers> = {}
    
    for (const user of enrichedUsers) {
      if (!usersByBot[user.bot_id]) {
        usersByBot[user.bot_id] = []
      }
      usersByBot[user.bot_id].push(user)
    }

    return NextResponse.json({ 
      usersByBot,
      total: enrichedUsers.length
    })
  } catch (error) {
    console.error("Error in remarketing users API:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
