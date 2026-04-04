import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase()
  try {
    const { id: botId } = await params

    if (!botId) {
      return NextResponse.json({ error: "bot_id is required" }, { status: 400 })
    }

    const { data: users, error } = await supabase
      .from("bot_users")
      .select("*")
      .eq("bot_id", botId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[bot-users] Error fetching:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ users: users || [] })
  } catch (err) {
    console.error("[bot-users] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase()
  try {
    const { id: botId } = await params
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("user_id")

    if (!botId) {
      return NextResponse.json({ error: "bot_id is required" }, { status: 400 })
    }

    if (userId) {
      // Delete specific user
      const { error } = await supabase
        .from("bot_users")
        .delete()
        .eq("bot_id", botId)
        .eq("id", userId)

      if (error) {
        console.error("[bot-users] Error deleting user:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      // Delete all users from bot
      const { error } = await supabase
        .from("bot_users")
        .delete()
        .eq("bot_id", botId)

      if (error) {
        console.error("[bot-users] Error deleting all users:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[bot-users] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
