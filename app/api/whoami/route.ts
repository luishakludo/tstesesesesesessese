import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    // Tentar ler cookie de varias formas
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("dragon_session")
    
    // Tambem tentar do header
    const cookieHeader = request.headers.get("cookie") || ""
    const allCookieNames = cookieHeader.split(";").map(c => c.trim().split("=")[0]).filter(Boolean)
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ 
        error: "Cookie dragon_session nao encontrado",
        cookiesDisponiveis: allCookieNames,
        tip: "Verifique se voce esta logado em /login"
      })
    }
    
    const session = JSON.parse(sessionCookie.value)
    
    return NextResponse.json({
      userId: session.user?.id || null,
      email: session.user?.email || null,
      name: session.user?.name || null,
      tip: "Use este userId para testar: /api/test-payment-insert?userId=" + session.user?.id
    })
  } catch (err) {
    return NextResponse.json({ error: "Erro ao ler sessao: " + String(err) })
  }
}
