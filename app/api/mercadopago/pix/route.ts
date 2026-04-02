import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { accessToken, amount, description, payer, siteId, userId } = await request.json()

    console.log("[v0] PIX API called - amount:", amount, "hasToken:", !!accessToken, "tokenLength:", accessToken?.length)

    if (!accessToken || !amount) {
      console.log("[v0] Missing required fields")
      return NextResponse.json(
        { error: "accessToken e amount sao obrigatorios" },
        { status: 400 }
      )
    }

    // Extrair dados do payer do formulario
    const payerEmail = payer?.email || "cliente@checkout.com"
    const payerName = payer?.name || "Cliente"
    const payerCpf = payer?.cpf?.replace(/\D/g, "") || ""
    const payerPhone = payer?.phone?.replace(/\D/g, "") || ""

    // Salvar lead no banco se tiver dados do formulario
    if (payer && (payer.email || payer.name || payer.cpf)) {
      try {
        const supabase = getSupabase()
        await supabase.from("checkout_leads").insert({
          site_id: siteId || null,
          email: payer.email || null,
          name: payer.name || null,
          cpf: payer.cpf || null,
          phone: payer.phone || null,
          amount: amount,
          status: "pending",
        })
      } catch (err) {
        console.error("Error saving lead:", err)
        // Continua mesmo se falhar salvar lead
      }
    }

    // Criar pagamento PIX via Mercado Pago
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
          email: payerEmail,
          first_name: payerName.split(" ")[0] || "Cliente",
          last_name: payerName.split(" ").slice(1).join(" ") || "",
          identification: payerCpf ? {
            type: "CPF",
            number: payerCpf
          } : undefined,
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
        const supabase = getSupabase()
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
      } catch (err) {
        console.error("Error saving payment:", err)
      }
    }

    return NextResponse.json({
      paymentId: paymentData.id,
      status: paymentData.status,
      qrCode: pixData.qr_code,
      qrCodeBase64: pixData.qr_code_base64,
      ticketUrl: pixData.ticket_url,
    })
  } catch (error) {
    console.error("Erro ao processar PIX:", error)
    return NextResponse.json(
      { error: "Erro interno ao processar pagamento" },
      { status: 500 }
    )
  }
}
