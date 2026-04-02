import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("dragon_session")
    
    if (!sessionCookie) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const session = JSON.parse(sessionCookie.value)
    const userId = session.user?.id

    if (!userId) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get("siteId")

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Build query - filtrar por user_id diretamente
    let query = supabase
      .from("checkout_leads")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    // Filter by site if provided
    if (siteId) {
      query = query.eq("site_id", siteId)
    }

    const { data: leads, error } = await query.limit(500)

    if (error) {
      console.error("Error fetching leads:", error)
      return NextResponse.json({ error: "Erro ao buscar leads" }, { status: 500 })
    }

    // Stats
    const stats = {
      total: leads?.length || 0,
      pending: leads?.filter(l => l.status === "pending" || l.status === "payment_generated").length || 0,
      paid: leads?.filter(l => l.status === "paid" || l.status === "approved").length || 0,
      totalAmount: leads?.reduce((acc, l) => acc + (Number(l.amount) || 0), 0) || 0,
    }

    return NextResponse.json({ leads: leads || [], stats })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
