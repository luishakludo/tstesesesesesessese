import { NextRequest, NextResponse } from "next/server"
import FormData from "form-data"
import { getSupabaseAdmin } from "@/lib/supabase"

export const runtime = "nodejs"

// API de teste automatico - acessa /api/telegram/test-auto?botId=SEU_BOT_ID
// Ou sem botId para pegar o primeiro bot disponivel
export async function GET(request: NextRequest) {
  const logs: string[] = []
  const log = (msg: string) => {
    console.log(msg)
    logs.push(msg)
  }

  log("========== TESTE AUTOMATICO DE UPLOAD DE FOTO ==========")
  log("")

  try {
    // 1. Buscar token do bot no banco
    log("PASSO 1: Buscando bot no banco de dados...")
    
    const supabase = getSupabaseAdmin()
    const botId = request.nextUrl.searchParams.get("botId")
    
    let query = supabase.from("bots").select("id, name, token")
    if (botId) {
      query = query.eq("id", botId)
    }
    
    const { data: bots, error: dbError } = await query.limit(1)
    
    if (dbError) {
      log(`ERRO NO BANCO: ${dbError.message}`)
      return new NextResponse(logs.join("\n"), { headers: { "Content-Type": "text/plain" } })
    }
    
    if (!bots || bots.length === 0) {
      log("ERRO: Nenhum bot encontrado no banco")
      log("Dica: Adicione um bot primeiro ou passe ?botId=ID_DO_BOT")
      return new NextResponse(logs.join("\n"), { headers: { "Content-Type": "text/plain" } })
    }
    
    const bot = bots[0]
    log(`Bot encontrado: ${bot.name} (ID: ${bot.id})`)
    log(`Token: ${bot.token.substring(0, 10)}...${bot.token.substring(bot.token.length - 5)}`)
    log("")

    // 2. Criar uma imagem de teste (PNG vermelho 100x100)
    log("PASSO 2: Criando imagem de teste (PNG 100x100 vermelho)...")
    
    // PNG minimo vermelho 1x1 (valido)
    const pngRedPixel = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64, // 100x100
      0x08, 0x02, 0x00, 0x00, 0x00, 0xFF, 0x80, 0x02, // 8-bit RGB
      0x03, 0x00, 0x00, 0x00, 0x19, 0x49, 0x44, 0x41, // IDAT chunk
      0x54, 0x78, 0x9C, 0xED, 0xC1, 0x01, 0x0D, 0x00,
      0x00, 0x00, 0xC2, 0xA0, 0xF7, 0x4F, 0x6D, 0x0E,
      0x37, 0xA0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0xBE, 0x0D, 0x21, 0x00, 0x00, 0x01,
      0x9A, 0x60, 0xE1, 0xD5, 0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82  // IEND chunk
    ])
    
    log(`Imagem criada: ${pngRedPixel.length} bytes`)
    log("")

    // 3. Criar FormData com form-data library
    log("PASSO 3: Criando FormData com form-data library...")
    
    const form = new FormData()
    form.append("photo", pngRedPixel, {
      filename: "test-photo.png",
      contentType: "image/png",
      knownLength: pngRedPixel.length,
    })
    
    const headers = form.getHeaders()
    log(`Headers: ${JSON.stringify(headers)}`)
    log("")

    // 4. Enviar para o Telegram
    log("PASSO 4: Enviando para Telegram (setMyProfilePhoto)...")
    
    const telegramUrl = `https://api.telegram.org/bot${bot.token}/setMyProfilePhoto`
    log(`URL: ${telegramUrl.replace(bot.token, "TOKEN_HIDDEN")}`)
    
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: headers,
      body: form.getBuffer(),
    })
    
    log(`Status: ${response.status} ${response.statusText}`)
    log("")

    // 5. Ler resposta
    log("PASSO 5: Lendo resposta do Telegram...")
    
    const responseText = await response.text()
    log(`Resposta RAW: ${responseText}`)
    log("")

    // 6. Parsear resposta
    log("PASSO 6: Analisando resposta...")
    
    try {
      const result = JSON.parse(responseText)
      log(`ok: ${result.ok}`)
      if (result.ok) {
        log("SUCESSO! A foto foi alterada no Telegram!")
      } else {
        log(`ERRO: ${result.description}`)
        log(`error_code: ${result.error_code}`)
      }
    } catch {
      log(`Erro ao parsear JSON: ${responseText}`)
    }
    
    log("")
    log("========== FIM DO TESTE ==========")
    
    return new NextResponse(logs.join("\n"), { 
      headers: { "Content-Type": "text/plain; charset=utf-8" } 
    })

  } catch (error) {
    log(`EXCECAO: ${String(error)}`)
    log(`Stack: ${(error as Error)?.stack || "N/A"}`)
    return new NextResponse(logs.join("\n"), { 
      headers: { "Content-Type": "text/plain; charset=utf-8" } 
    })
  }
}
