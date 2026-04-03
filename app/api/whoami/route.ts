import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie") || ""
    const sessionMatch = cookieHeader.match(/dragon_session=([^;]+)/)
    const sessionValue = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null
    
    if (!sessionValue) {
      return NextResponse.json({ error: "Nao logado", userId: null })
    }
    
    const session = JSON.parse(sessionValue)
    
    return NextResponse.json({
      userId: session.user?.id || null,
      email: session.user?.email || null,
      name: session.user?.name || null,
    })
  } catch (err) {
    return NextResponse.json({ error: "Erro ao ler sessao", userId: null })
  }
}
