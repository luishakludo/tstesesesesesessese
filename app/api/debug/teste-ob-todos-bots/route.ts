import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

// GET = mostra todos os bots e seus dados
// POST = cria um pagamento REAL de Order Bump para cada bot (aparece no painel)
export async function GET() {
  const supabase = getSupabaseAdmin()
  
  // Buscar TODOS os bots
  const { data: bots, error: botsError } = await supabase
    .from("bots")
    .select("id, name, user_id, token")
    .order("created_at", { ascending: false })
  
  if (botsError) {
    return NextResponse.json({ error: "Erro ao buscar bots", details: botsError.message }, { status: 500 })
  }
  
  // Para cada bot, buscar o flow ativo
  const resultado = []
  
  for (const bot of bots || []) {
    // Buscar flow do bot
    const { data: flow } = await supabase
      .from("flows")
      .select("id, name, user_id, config")
      .eq("bot_id", bot.id)
      .eq("is_active", true)
      .limit(1)
      .single()
    
    // Determinar user_id (do bot ou do flow)
    let userId = bot.user_id
    if (!userId && flow?.user_id) {
      userId = flow.user_id
    }
    
    // Buscar gateway do usuario
    let temGateway = false
    if (userId) {
      const { data: gateway } = await supabase
        .from("user_gateways")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .single()
      temGateway = !!gateway
    }
    
    // Contar pagamentos de order_bump deste bot
    const { count: obCount } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("bot_id", bot.id)
      .eq("product_type", "order_bump")
    
    resultado.push({
      bot_id: bot.id,
      bot_nome: bot.name,
      bot_user_id: bot.user_id,
      flow_id: flow?.id || null,
      flow_nome: flow?.name || null,
      flow_user_id: flow?.user_id || null,
      user_id_final: userId,
      tem_gateway: temGateway,
      pagamentos_ob_existentes: obCount || 0,
      pode_criar_pagamento: !!userId && temGateway,
      problema: !userId 
        ? "SEM USER_ID (bot e flow sem dono)" 
        : !temGateway 
          ? "SEM GATEWAY CONFIGURADO"
          : "OK"
    })
  }
  
  return NextResponse.json({
    instrucao: "Faca POST nesta mesma URL para criar um pagamento de Order Bump REAL para cada bot que estiver OK",
    total_bots: resultado.length,
    bots_ok: resultado.filter(b => b.problema === "OK").length,
    bots_com_problema: resultado.filter(b => b.problema !== "OK").length,
    bots: resultado
  })
}

export async function POST() {
  const supabase = getSupabaseAdmin()
  
  // Buscar TODOS os bots
  const { data: bots, error: botsError } = await supabase
    .from("bots")
    .select("id, name, user_id")
    .order("created_at", { ascending: false })
  
  if (botsError) {
    return NextResponse.json({ error: "Erro ao buscar bots", details: botsError.message }, { status: 500 })
  }
  
  const resultados = []
  
  for (const bot of bots || []) {
    // Buscar flow do bot
    const { data: flow } = await supabase
      .from("flows")
      .select("id, name, user_id")
      .eq("bot_id", bot.id)
      .eq("is_active", true)
      .limit(1)
      .single()
    
    // Determinar user_id (do bot ou do flow)
    let userId = bot.user_id
    if (!userId && flow?.user_id) {
      userId = flow.user_id
    }
    
    // Se nao tem user_id, pular
    if (!userId) {
      resultados.push({
        bot_nome: bot.name,
        bot_id: bot.id,
        status: "PULADO",
        motivo: "Sem user_id"
      })
      continue
    }
    
    // Verificar se tem gateway
    const { data: gateway } = await supabase
      .from("user_gateways")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .single()
    
    if (!gateway) {
      resultados.push({
        bot_nome: bot.name,
        bot_id: bot.id,
        status: "PULADO",
        motivo: "Sem gateway"
      })
      continue
    }
    
    // CRIAR PAGAMENTO REAL DE ORDER BUMP
    const paymentData = {
      bot_id: bot.id,
      user_id: userId,
      flow_id: flow?.id || null,
      telegram_user_id: "teste_automatico_" + Date.now(),
      telegram_username: "teste_ob",
      telegram_first_name: "Teste",
      amount: 19.90, // Valor de teste
      status: "approved", // Ja aprovado para aparecer no painel
      product_type: "order_bump",
      product_name: "Order Bump Teste Automatico",
      external_reference: "teste_ob_" + bot.id + "_" + Date.now(),
      payment_method: "pix",
      metadata: {
        teste_automatico: true,
        criado_em: new Date().toISOString(),
        bot_nome: bot.name,
        flow_nome: flow?.name
      }
    }
    
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert(paymentData)
      .select()
      .single()
    
    if (paymentError) {
      resultados.push({
        bot_nome: bot.name,
        bot_id: bot.id,
        user_id: userId,
        status: "ERRO",
        motivo: paymentError.message
      })
    } else {
      resultados.push({
        bot_nome: bot.name,
        bot_id: bot.id,
        user_id: userId,
        status: "CRIADO",
        payment_id: payment.id,
        valor: 19.90,
        vai_aparecer_no_painel: true
      })
    }
  }
  
  return NextResponse.json({
    mensagem: "Pagamentos de Order Bump criados!",
    total_processados: resultados.length,
    criados: resultados.filter(r => r.status === "CRIADO").length,
    pulados: resultados.filter(r => r.status === "PULADO").length,
    erros: resultados.filter(r => r.status === "ERRO").length,
    resultados
  })
}
