import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("dragon_session")
    
    console.log("[v0] Checkout leads API called - hasSession:", !!sessionCookie)
    
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
    
    console.log("[v0] Fetching leads - userId:", userId, "siteId:", siteId)

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // Primeiro buscar os sites do usuario
    const { data: userSites, error: sitesError } = await supabase
      .from("dragon_bio_sites")
      .select("id")
      .eq("user_id", userId)
    
    console.log("[v0] User sites:", userSites?.length, "error:", sitesError)
    
    const userSiteIds = userSites?.map(s => s.id) || []
    
    // Se usuario nao tem sites, retornar vazio
    if (userSiteIds.length === 0) {
      console.log("[v0] No sites found for user")
      return NextResponse.json({ leads: [], stats: { total: 0, pending: 0, paid: 0, totalAmount: 0 } })
    }

    // Build query - filtrar pelos sites do usuario
    let query = supabase
      .from("checkout_leads")
      .select("*")
      .in("site_id", userSiteIds)
      .order("created_at", { ascending: false })

    // Filter by specific site if provided
    if (siteId) {
      query = query.eq("site_id", siteId)
    }

    const { data: leads, error } = await query.limit(500)
    
    console.log("[v0] Leads found:", leads?.length, "error:", error)

    if (error) {
      console.error("[v0] Error fetching leads:", error)
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
