import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// API de teste para debugar order bump e pagamentos
// GET /api/debug/order-bump-test?bot_id=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const botId = searchParams.get("bot_id")
  
  const supabase = await createClient()
  
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    test: "order_bump_debug",
  }
  
  // 1. Buscar bot
  if (botId) {
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, name, user_id, token")
      .eq("id", botId)
      .single()
    
    results.bot = bot ? { id: bot.id, name: bot.name, user_id: bot.user_id, has_token: !!bot.token } : null
    results.bot_error = botError?.message || null
    
    if (bot?.user_id) {
      // 2. Buscar gateway
      const { data: gateway, error: gwError } = await supabase
        .from("user_gateways")
        .select("id, gateway, is_active")
        .eq("user_id", bot.user_id)
        .eq("is_active", true)
        .limit(1)
        .single()
      
      results.gateway = gateway
      results.gateway_error = gwError?.message || null
      
      // 3. Buscar ultimos pagamentos desse bot
      const { data: payments, error: payError } = await supabase
        .from("payments")
        .select("id, amount, status, product_type, description, telegram_user_id, created_at, flow_id")
        .eq("bot_id", botId)
        .order("created_at", { ascending: false })
        .limit(10)
      
      results.recent_payments = payments
      results.payments_error = payError?.message || null
      results.payments_count = payments?.length || 0
      
      // 4. Buscar pagamentos com order bump especificamente
      const { data: obPayments, error: obError } = await supabase
        .from("payments")
        .select("id, amount, status, product_type, description, created_at")
        .eq("bot_id", botId)
        .like("product_type", "%order_bump%")
        .order("created_at", { ascending: false })
        .limit(10)
      
      results.order_bump_payments = obPayments
      results.order_bump_error = obError?.message || null
      
      // 5. Buscar estados do user_flow_state
      const { data: states, error: stateError } = await supabase
        .from("user_flow_state")
        .select("telegram_user_id, status, metadata, updated_at")
        .eq("bot_id", botId)
        .order("updated_at", { ascending: false })
        .limit(5)
      
      results.user_states = states
      results.states_error = stateError?.message || null
    }
  } else {
    // Sem bot_id - listar todos os pagamentos recentes com order bump
    const { data: allObPayments, error } = await supabase
      .from("payments")
      .select("id, bot_id, amount, status, product_type, description, telegram_user_id, created_at")
      .like("product_type", "%order_bump%")
      .order("created_at", { ascending: false })
      .limit(20)
    
    results.all_order_bump_payments = allObPayments
    results.error = error?.message || null
    
    // Buscar todos os pagamentos recentes
    const { data: allPayments, error: allError } = await supabase
      .from("payments")
      .select("id, bot_id, amount, status, product_type, description, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
    
    results.all_recent_payments = allPayments
    results.all_payments_error = allError?.message || null
  }
  
  return NextResponse.json(results, { status: 200 })
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
