import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    // Buscar todos os usuarios de todos os bots
    const { data: botUsers, error } = await supabaseAdmin
      .from("bot_users")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching bot users:", error)
      return NextResponse.json({ error: "Erro ao buscar usuarios" }, { status: 500 })
    }

    // Agrupar usuarios por bot_id
    const usersByBot: Record<string, typeof botUsers> = {}
    
    for (const user of botUsers || []) {
      if (!usersByBot[user.bot_id]) {
        usersByBot[user.bot_id] = []
      }
      usersByBot[user.bot_id].push(user)
    }

    return NextResponse.json({ 
      usersByBot,
      total: botUsers?.length || 0
    })
  } catch (error) {
    console.error("Error in remarketing users API:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
