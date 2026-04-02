import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { cookies } from "next/headers"

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

    const supabase = getSupabase()

    // Build query
    let query = supabase
      .from("checkout_leads")
      .select(`
        *,
        dragon_bio_sites!left(id, nome, slug, user_id)
      `)
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

    // Filter to only show leads from sites owned by this user
    const userLeads = leads?.filter(lead => {
      if (!lead.dragon_bio_sites) return false
      return lead.dragon_bio_sites.user_id === userId
    }) || []

    // Stats
    const stats = {
      total: userLeads.length,
      pending: userLeads.filter(l => l.status === "pending").length,
      paid: userLeads.filter(l => l.status === "paid").length,
      totalAmount: userLeads.reduce((acc, l) => acc + (Number(l.amount) || 0), 0),
    }

    return NextResponse.json({ leads: userLeads, stats })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
