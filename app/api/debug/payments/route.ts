import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // 1. Buscar todos os payments (ultimos 20)
    const { data: allPayments, error: paymentsError } = await supabase
      .from("payments")
      .select("id, bot_id, user_id, amount, status, product_type, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
    
    // 2. Buscar bots do usuario (se fornecido)
    let userBots: { id: string; name: string }[] = []
    if (userId) {
      const { data: bots } = await supabase
        .from("bots")
        .select("id, name")
        .eq("user_id", userId)
      userBots = bots || []
    }
    
    // 3. Filtrar payments por bot_id OU user_id
    const userBotIds = userBots.map(b => b.id)
    const userPayments = allPayments?.filter(p => 
      userBotIds.includes(p.bot_id) || p.user_id === userId
    ) || []
    
    return NextResponse.json({
      debug: true,
      userId,
      userBots,
      userBotIds,
      allPaymentsCount: allPayments?.length || 0,
      allPayments: allPayments?.slice(0, 10),
      userPaymentsCount: userPayments.length,
      userPayments,
      error: paymentsError,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
