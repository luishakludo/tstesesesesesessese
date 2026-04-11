import { getSupabase } from "@/lib/supabase"
import { NextResponse } from "next/server"

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

    const body = await request.json()
    const { botId, textData } = body

    if (!botId) {
      return NextResponse.json({ error: "Bot nao selecionado" }, { status: 400 })
    }

    if (!textData || !textData.trim()) {
      return NextResponse.json({ error: "Nenhum ID fornecido" }, { status: 400 })
    }

    // Verify bot exists
    const { data: bot } = await supabase
      .from("bots")
      .select("id")
      .eq("id", botId)
      .single()

    if (!bot) {
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
    // source = 'imported' to differentiate from users captured by bot (source = 'start')
    const { data: inserted, error: insertError } = await supabase
      .from("bot_users")
      .insert(
        newChatIds.map(chatId => ({
          bot_id: botId,
          telegram_user_id: parseInt(chatId),
          chat_id: parseInt(chatId),
          first_name: `Importado`,
          username: null,
          funnel_step: 0, // 0 indicates imported user (didn't go through funnel)
          is_subscriber: false,
          source: "imported", // Mark as imported vs "start" for organic users
          created_at: new Date().toISOString()
        }))
      )
      .select()

    if (insertError) {
      console.error("[v0] Error inserting users:", insertError)
      // If error is about missing 'source' column, try without it
      if (insertError.message?.includes("source")) {
        console.log("[v0] Retrying without source column...")
        const { data: inserted2, error: insertError2 } = await supabase
          .from("bot_users")
          .insert(
            newChatIds.map(chatId => ({
              bot_id: botId,
              telegram_user_id: parseInt(chatId),
              chat_id: parseInt(chatId),
              first_name: `Importado`,
              username: null,
              funnel_step: 0,
              is_subscriber: false,
              created_at: new Date().toISOString()
            }))
          )
          .select()
        
        if (insertError2) {
          return NextResponse.json({ 
            error: "Erro ao salvar usuarios",
            details: insertError2.message 
          }, { status: 500 })
        }
        
        return NextResponse.json({
          success: true,
          imported: inserted2?.length || 0,
          duplicates: duplicatesInInput,
          skipped: skippedExisting,
          parseErrors,
          total: chatIds.length
        })
      }
      
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
