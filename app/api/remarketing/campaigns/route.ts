import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const { searchParams } = new URL(req.url)
    const botId = searchParams.get("bot_id")

    let query = supabase
      .from("remarketing_campaigns")
      .select("*")
      .order("created_at", { ascending: false })

    if (botId) {
      query = query.eq("bot_id", botId)
    }

    const { data: campaigns, error } = await query

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === "42P01") {
        return NextResponse.json({ campaigns: [] })
      }
      console.error("[remarketing] Error fetching campaigns:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ campaigns: campaigns || [] })
  } catch (err) {
    console.error("[remarketing] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const body = await req.json()
    const { name, bot_id, audience_id, message_template, scheduled_at } = body

    if (!name || !bot_id || !audience_id) {
      return NextResponse.json({ error: "Campos obrigatorios faltando" }, { status: 400 })
    }

    const { data: campaign, error } = await supabase
      .from("remarketing_campaigns")
      .insert({
        name,
        bot_id,
        audience_id,
        message_template: message_template || "",
        scheduled_at: scheduled_at || null,
        status: "rascunho",
        sent_count: 0,
        delivered_count: 0,
        open_rate: 0,
        click_rate: 0
      })
      .select()
      .single()

    if (error) {
      console.error("[remarketing] Error creating campaign:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ campaign })
  } catch (err) {
    console.error("[remarketing] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("remarketing_campaigns")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[remarketing] Error updating campaign:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ campaign: data })
  } catch (err) {
    console.error("[remarketing] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 })
    }

    const { error } = await supabase
      .from("remarketing_campaigns")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[remarketing] Error deleting campaign:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[remarketing] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
