import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

export async function POST(request: NextRequest) {
  try {
    const { accessToken, amount, description, payer, siteId, userId } = await request.json()

    console.log("[v0] PIX API called - amount:", amount, "siteId:", siteId, "hasPayer:", !!payer)

    if (!accessToken || !amount) {
      return NextResponse.json(
        { error: "accessToken e amount sao obrigatorios" },
        { status: 400 }
      )
    }

    // Salvar lead no banco se tiver dados do formulario
    const payerName = payer?.name || "Cliente"
    let leadId: string | null = null
    
    if (payer && (payer.email || payer.name || payer.cpf)) {
      try {
        // Usar service role para bypass RLS
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        const { data: leadData, error: leadError } = await supabase.from("checkout_leads").insert({
          site_id: siteId || null,
          user_id: userId || null,
          email: payer.email || null,
          name: payer.name || null,
          cpf: payer.cpf || null,
          phone: payer.phone || null,
          amount: amount,
          status: "pending",
          created_at: new Date().toISOString(),
        }).select("id").single()
        
        if (leadError) {
          console.error("[v0] Error saving lead:", leadError)
        } else {
          leadId = leadData?.id
          console.log("[v0] Lead saved:", leadId)
        }
      } catch (err) {
        console.error("[v0] Error saving lead:", err)
      }
    }

    // Criar pagamento PIX via Mercado Pago (sem enviar dados do payer - igual ao bot)
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "X-Idempotency-Key": `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: description || "Pagamento PIX",
        payment_method_id: "pix",
        payer: {
          email: "cliente@checkout.com",
        },
      }),
    })

    console.log("[v0] Mercado Pago response status:", response.status)

    if (!response.ok) {
      const errorData = await response.json()
      console.error("[v0] Mercado Pago error:", JSON.stringify(errorData))
      return NextResponse.json(
        { error: errorData.message || errorData.cause?.[0]?.description || "Erro ao criar pagamento" },
        { status: response.status }
      )
    }

    const paymentData = await response.json()
    console.log("[v0] Payment created:", paymentData.id, paymentData.status)

    // Extrair dados do PIX
    const pixData = paymentData.point_of_interaction?.transaction_data

    if (!pixData) {
      return NextResponse.json(
        { error: "Dados do PIX nao encontrados" },
        { status: 500 }
      )
    }

    // Salvar pagamento na tabela payments se tiver userId (para aparecer em Vendas)
    if (userId) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        await supabase.from("payments").insert({
          user_id: userId,
          amount: amount,
          status: "pending",
          payment_method: "pix",
          gateway: "mercadopago",
          external_payment_id: String(paymentData.id),
          description: description || "Checkout PIX",
          product_name: description || "Checkout",
          product_type: "checkout",
          telegram_user_name: payerName,
          pix_code: pixData.qr_code,
          qr_code: pixData.qr_code_base64,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        
        // Atualizar lead com payment_id
        if (leadId) {
          await supabase.from("checkout_leads").update({
            payment_id: String(paymentData.id),
            status: "payment_generated"
          }).eq("id", leadId)
        }
      } catch (err) {
        console.error("[v0] Error saving payment:", err)
      }
    }

    return NextResponse.json({
      paymentId: paymentData.id,
      status: paymentData.status,
      qrCode: pixData.qr_code,
      qrCodeBase64: pixData.qr_code_base64,
      ticketUrl: pixData.ticket_url,
      leadId: leadId,
    })
  } catch (error) {
    console.error("Erro ao processar PIX:", error)
    return NextResponse.json(
      { error: "Erro interno ao processar pagamento" },
      { status: 500 }
    )
  }
}
