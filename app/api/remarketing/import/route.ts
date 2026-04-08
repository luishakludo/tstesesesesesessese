import { getSupabase } from "@/lib/supabase"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

interface ImportUser {
  nome: string
  email: string
  telefone?: string
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function validatePhone(phone: string): boolean {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, "")
  // Brazilian phone: 10-11 digits, International: 8-15 digits
  return cleaned.length >= 8 && cleaned.length <= 15
}

function parseTextInput(text: string): { users: ImportUser[], errors: string[] } {
  const lines = text.trim().split("\n").filter(line => line.trim())
  const users: ImportUser[] = []
  const errors: string[] = []

  lines.forEach((line, index) => {
    const parts = line.split(",").map(p => p.trim())
    
    if (parts.length < 2) {
      errors.push(`Linha ${index + 1}: formato invalido (esperado: nome,email,telefone)`)
      return
    }

    const [nome, email, telefone] = parts

    if (!nome || nome.length < 2) {
      errors.push(`Linha ${index + 1}: nome invalido`)
      return
    }

    if (!validateEmail(email)) {
      errors.push(`Linha ${index + 1}: email invalido (${email})`)
      return
    }

    if (telefone && !validatePhone(telefone)) {
      errors.push(`Linha ${index + 1}: telefone invalido (${telefone})`)
      return
    }

    users.push({
      nome,
      email: email.toLowerCase(),
      telefone: telefone || undefined
    })
  })

  return { users, errors }
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
    const { botId, textData, mode } = body

    if (!botId) {
      return NextResponse.json({ error: "Bot nao selecionado" }, { status: 400 })
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

    let usersToImport: ImportUser[] = []
    let parseErrors: string[] = []

    if (mode === "text" && textData) {
      const result = parseTextInput(textData)
      usersToImport = result.users
      parseErrors = result.errors
    }

    if (usersToImport.length === 0) {
      return NextResponse.json({ 
        error: "Nenhum usuario valido para importar",
        parseErrors 
      }, { status: 400 })
    }

    // Check for duplicates within the import
    const emailSet = new Set<string>()
    const uniqueUsers: ImportUser[] = []
    const duplicates: string[] = []

    usersToImport.forEach(u => {
      if (emailSet.has(u.email)) {
        duplicates.push(u.email)
      } else {
        emailSet.add(u.email)
        uniqueUsers.push(u)
      }
    })

    // Check for existing emails in database
    const { data: existingUsers } = await supabase
      .from("remarketing_users")
      .select("email")
      .eq("bot_id", botId)
      .in("email", uniqueUsers.map(u => u.email))

    const existingEmails = new Set((existingUsers || []).map(u => u.email))
    const newUsers = uniqueUsers.filter(u => !existingEmails.has(u.email))
    const skippedExisting = uniqueUsers.filter(u => existingEmails.has(u.email))

    if (newUsers.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Todos os usuarios ja existem",
        imported: 0,
        duplicates: duplicates.length,
        skipped: skippedExisting.length,
        parseErrors
      })
    }

    // Insert new users
    const { data: inserted, error: insertError } = await supabase
      .from("remarketing_users")
      .insert(
        newUsers.map(u => ({
          user_id: user.id,
          bot_id: botId,
          nome: u.nome,
          email: u.email,
          telefone: u.telefone || null,
          status: "novo",
          origem: "importacao"
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
      duplicates: duplicates.length,
      skipped: skippedExisting.length,
      parseErrors,
      total: usersToImport.length
    })

  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
