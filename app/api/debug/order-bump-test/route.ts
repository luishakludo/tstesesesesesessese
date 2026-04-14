import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// API simples - so acessar o link e ver o JSON
// GET /api/debug/order-bump-test
export async function GET() {
  const supabase = await createClient()
  const flowId = "bd37e11c-705a-4bf5-81a0-ccefdd2fcad0"
  
  // Buscar flow e bot
  const { data: flow } = await supabase
    .from("flows")
    .select("id, name, bot_id, config, bots(id, name, user_id)")
    .eq("id", flowId)
    .single()
  
  const botId = flow?.bot_id
  
  // Pagamentos desse bot
  const { data: botPayments } = await supabase
    .from("payments")
    .select("*")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .limit(15)
  
  // TODOS os pagamentos recentes (para comparar)
  const { data: allPayments } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30)
  
  // Filtrar order bumps
  const obFromBot = botPayments?.filter(p => p.product_type?.includes("order_bump")) || []
  const obFromAll = allPayments?.filter(p => p.product_type?.includes("order_bump")) || []
  
  return NextResponse.json({
    flow: { id: flow?.id, name: flow?.name },
    bot: { id: botId, name: (flow?.bots as { name?: string })?.name },
    order_bump_config: flow?.config?.orderBump?.inicial,
    
    pagamentos_deste_bot: {
      total: botPayments?.length || 0,
      com_order_bump: obFromBot.length,
      ultimos_10: botPayments?.slice(0, 10).map(p => ({
        id: p.id,
        valor: p.amount,
        status: p.status,
        tipo: p.product_type,
        produto: p.product_name,
        data: p.created_at
      }))
    },
    
    todos_order_bumps_sistema: {
      total: obFromAll.length,
      lista: obFromAll.map(p => ({
        id: p.id,
        bot_id: p.bot_id,
        valor: p.amount,
        status: p.status,
        tipo: p.product_type,
        data: p.created_at
      }))
    },
    
    diagnostico: obFromBot.length === 0 
      ? "PROBLEMA: Nenhum pagamento com order_bump encontrado para este bot"
      : "OK: Pagamentos com order bump encontrados"
  })
}

// POST /api/debug/order-bump-test - Simula criacao de pagamento com order bump
export async function POST(request: Request) {
  const body = await request.json()
  const { bot_id, user_id, flow_id, amount, with_order_bump } = body
  
  if (!bot_id || !user_id) {
    return NextResponse.json({ error: "bot_id e user_id sao obrigatorios" }, { status: 400 })
  }
  
  const supabase = await createClient()
  
  const testAmount = amount || 23.00
  const productType = with_order_bump ? "plan_order_bump" : "plan"
  const description = with_order_bump ? "Plano Teste + Order Bump" : "Plano Teste"
  
  // Simular criacao de pagamento igual ao order bump faz
  const paymentData = {
    bot_id,
    user_id,
    flow_id: flow_id || null,
    amount: testAmount,
    status: "pending",
    payment_method: "pix",
    gateway: "mercadopago",
    external_payment_id: `test_${Date.now()}`,
    copy_paste: "00020126360014br.gov.bcb.pix0114+5579991399006520400005303986540523.005802BR5925TESTE6009Sao Paulo",
    pix_code: "00020126360014br.gov.bcb.pix0114+5579991399006520400005303986540523.005802BR5925TESTE6009Sao Paulo",
    qr_code: null,
    qr_code_url: null,
    telegram_user_id: "123456789",
    telegram_chat_id: "123456789",
    telegram_username: "test_user",
    telegram_first_name: "Test",
    telegram_last_name: "User",
    description: `Pagamento - ${description}`,
    product_name: description,
    product_type: productType,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  
  console.log("[v0] DEBUG - Inserting test payment:", JSON.stringify(paymentData))
  
  const { data: savedPayment, error: saveError } = await supabase
    .from("payments")
    .insert(paymentData)
    .select()
    .single()
  
  if (saveError) {
    console.error("[v0] DEBUG - Error saving test payment:", saveError)
    return NextResponse.json({ 
      success: false, 
      error: saveError.message,
      error_details: saveError,
      attempted_data: paymentData
    }, { status: 500 })
  }
  
  console.log("[v0] DEBUG - Test payment saved:", savedPayment?.id)
  
  // Verificar se aparece na query do painel de vendas
  const { data: verifyPayment, error: verifyError } = await supabase
    .from("payments")
    .select("*")
    .eq("id", savedPayment.id)
    .single()
  
  return NextResponse.json({
    success: true,
    message: "Pagamento de teste criado",
    payment: savedPayment,
    verification: verifyPayment,
    verify_error: verifyError?.message || null,
    product_type_used: productType,
    with_order_bump
  })
}
