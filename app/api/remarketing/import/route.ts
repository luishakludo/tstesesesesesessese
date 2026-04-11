import { getSupabase } from "@/lib/supabase"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

// Parse chat IDs from text - accepts comma or line separated values
function parseChatIds(text: string): { chatIds: string[], errors: string[] } {
  const errors: string[] = []
  
  // Split by comma or newline, trim whitespace, filter empty
  const rawIds = text
    .split(/[,\n]/)
    .map(id => id.trim())
    .filter(id => id.length > 0)
  
  const chatIds: string[] = []
  
  rawIds.forEach((id, index) => {
    // Chat ID should be numeric (can be negative for groups)
    const cleaned = id.replace(/\s/g, "")
    if (/^-?\d+$/.test(cleaned)) {
      chatIds.push(cleaned)
    } else {
      errors.push(`ID invalido na posicao ${index + 1}: "${id}" (deve ser numerico)`)
    }
  })
  
  return { chatIds, errors }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    
    // Get user from cookie
    const cookieStore = await cookies()
    const userCookie = cookieStore.get("dragon_user")
    
    if (!userCookie?.value) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }
    
    const user = JSON.parse(userCookie.value)
    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { botId, textData } = body

    if (!botId) {
      return NextResponse.json({ error: "Bot nao selecionado" }, { status: 400 })
    }

    if (!textData || !textData.trim()) {
      return NextResponse.json({ error: "Nenhum ID fornecido" }, { status: 400 })
    }

    // Verify bot belongs to user
    const { data: bot } = await supabase
      .from("bots")
      .select("id, user_id")
      .eq("id", botId)
      .single()

    if (!bot || bot.user_id !== user.id) {
      return NextResponse.json({ error: "Bot nao encontrado" }, { status: 404 })
    }

    // Parse chat IDs from input
    const { chatIds, errors: parseErrors } = parseChatIds(textData)

    if (chatIds.length === 0) {
      return NextResponse.json({ 
        error: "Nenhum ID valido para importar",
        parseErrors 
      }, { status: 400 })
    }

    // Remove duplicates from input
    const uniqueChatIds = [...new Set(chatIds)]
    const duplicatesInInput = chatIds.length - uniqueChatIds.length

    // Check for existing chat_ids in database for this bot
    const { data: existingUsers } = await supabase
      .from("bot_users")
      .select("chat_id")
      .eq("bot_id", botId)
      .in("chat_id", uniqueChatIds)

    const existingChatIds = new Set((existingUsers || []).map(u => u.chat_id))
    const newChatIds = uniqueChatIds.filter(id => !existingChatIds.has(id))
    const skippedExisting = uniqueChatIds.length - newChatIds.length

    if (newChatIds.length === 0) {
      return NextResponse.json({
        success: true,
        imported: 0,
        duplicates: duplicatesInInput,
        skipped: skippedExisting,
        parseErrors,
        message: "Todos os IDs ja existem no sistema"
      })
    }

    // Insert new users into bot_users table
    const { data: inserted, error: insertError } = await supabase
      .from("bot_users")
      .insert(
        newChatIds.map(chatId => ({
          user_id: user.id,
          bot_id: botId,
          chat_id: chatId,
          first_name: `User ${chatId}`,
          username: null,
          payment_status: "nao_pago",
          funnel_stage: "lead",
          is_subscriber: false,
          created_at: new Date().toISOString()
        }))
      )
      .select()

    if (insertError) {
      console.error("Error inserting users:", insertError)
      return NextResponse.json({ 
        error: "Erro ao salvar usuarios",
        details: insertError.message 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      imported: inserted?.length || 0,
      duplicates: duplicatesInInput,
      skipped: skippedExisting,
      parseErrors,
      total: chatIds.length
    })

  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
