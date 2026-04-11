import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const { searchParams } = new URL(req.url)
    const botId = searchParams.get("bot_id")

    if (!botId) {
      return NextResponse.json({ error: "bot_id is required" }, { status: 400 })
    }

    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("bot_id", botId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[campaigns] Error fetching:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch nodes for each campaign
    const campaignIds = (campaigns || []).map((c: { id: string }) => c.id)
    let allNodes: { id: string; campaign_id: string; type: string; label: string; config: Record<string, unknown>; position: number }[] = []

    if (campaignIds.length > 0) {
      const { data: nodes } = await supabase
        .from("campaign_nodes")
        .select("*")
        .in("campaign_id", campaignIds)
        .order("position", { ascending: true })

      allNodes = (nodes as typeof allNodes) || []
    }

    // Group nodes by campaign_id
    const nodesByCampaign: Record<string, typeof allNodes> = {}
    for (const node of allNodes) {
      if (!nodesByCampaign[node.campaign_id]) nodesByCampaign[node.campaign_id] = []
      nodesByCampaign[node.campaign_id].push(node)
    }

    const result = (campaigns || []).map((c: Record<string, unknown>) => ({
      ...c,
      nodes: nodesByCampaign[c.id as string] || [],
    }))

    return NextResponse.json({ campaigns: result })
  } catch (err) {
    console.error("[campaigns] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const body = await req.json()
    const { bot_id, user_id, name, campaign_type, audience_type, audience, nodes } = body as {
      bot_id: string
      user_id: string
      name: string
      campaign_type: "basic" | "complete"
      audience_type?: "start" | "imported"
      audience?: string | null
      nodes: { type: string; label: string; config: Record<string, unknown>; position: number }[]
    }

    if (!bot_id || !user_id || !name || !campaign_type) {
      return NextResponse.json({ error: "Campos obrigatorios faltando" }, { status: 400 })
    }

    // Create campaign
    const { data: campaign, error: campError } = await supabase
      .from("campaigns")
      .insert({
        bot_id,
        user_id,
        name,
        campaign_type,
        audience_type: audience_type || "start",
        audience: audience || null,
        status: "rascunho",
      })
      .select()
      .single()

    if (campError || !campaign) {
      console.error("[campaigns] Error creating:", campError)
      return NextResponse.json({ error: campError?.message || "Erro ao criar campanha" }, { status: 500 })
    }

    // Create nodes
    if (nodes && nodes.length > 0) {
      const nodeRows = nodes.map((n, i) => ({
        campaign_id: campaign.id,
        type: n.type,
        label: n.label || "",
        config: n.config || {},
        position: n.position ?? i,
      }))

      const { error: nodesError } = await supabase
        .from("campaign_nodes")
        .insert(nodeRows)

      if (nodesError) {
        console.error("[campaigns] Error creating nodes:", nodesError)
        // Rollback campaign
        await supabase.from("campaigns").delete().eq("id", campaign.id)
        return NextResponse.json({ error: nodesError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ campaign })
  } catch (err) {
    console.error("[campaigns] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    // Nodes are cascade deleted
    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[campaigns] Error deleting:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[campaigns] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const body = await req.json()
    const { id, status } = body as { id: string; status: string }

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 })
    }

    const validStatuses = ["rascunho", "ativa", "pausada", "concluida"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Status invalido" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("campaigns")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[campaigns] Error updating:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // When campaign is activated, trigger execution immediately
    if (status === "ativa") {
      const baseUrl = req.headers.get("x-forwarded-proto") && req.headers.get("x-forwarded-host")
        ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get("x-forwarded-host")}`
        : req.headers.get("origin") || new URL(req.url).origin

      // Fire-and-forget: trigger execution in background
      fetch(`${baseUrl}/api/campaigns/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: id }),
      }).catch((err) => {
        console.error("[campaigns] Error triggering execution:", err)
      })
    }

    return NextResponse.json({ campaign: data })
  } catch (err) {
    console.error("[campaigns] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
