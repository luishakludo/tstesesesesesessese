import { NextRequest, NextResponse } from "next/server"
import FormData from "form-data"

// OBRIGATORIO: Node.js runtime
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const logs: string[] = []
  const log = (msg: string) => {
    console.log(msg)
    logs.push(msg)
  }

  log("========== TEST PHOTO API START ==========")

  try {
    // 1. Parse FormData
    log("STEP 1: Parsing FormData...")
    const data = await request.formData()
    
    const token = data.get("token") as string
    const file = data.get("photo") as File | null

    log(`TOKEN exists: ${!!token}`)
    log(`TOKEN length: ${token?.length || 0}`)
    log(`TOKEN preview: ${token ? token.substring(0, 10) + "..." : "null"}`)

    // 2. Verificar arquivo
    log("STEP 2: Checking file...")
    log(`FILE exists: ${!!file}`)
    log(`FILE instanceof File: ${file instanceof File}`)
    
    if (!file) {
      log("ERROR: No file received!")
      return NextResponse.json({
        success: false,
        error: "No file received",
        logs,
      })
    }

    log(`FILE name: ${file.name}`)
    log(`FILE type: ${file.type}`)
    log(`FILE size: ${file.size} bytes`)
    log(`FILE size (KB): ${(file.size / 1024).toFixed(2)} KB`)

    // 3. Converter para Buffer
    log("STEP 3: Converting to Buffer...")
    const arrayBuffer = await file.arrayBuffer()
    log(`ArrayBuffer byteLength: ${arrayBuffer.byteLength}`)
    
    const buffer = Buffer.from(arrayBuffer)
    log(`Buffer length: ${buffer.length}`)
    log(`Buffer first 10 bytes: ${buffer.slice(0, 10).toString("hex")}`)

    // 4. Criar FormData com form-data library
    log("STEP 4: Creating FormData with form-data library...")
    const form = new FormData()
    form.append("photo", buffer, {
      filename: file.name || "photo.jpg",
      contentType: file.type || "image/jpeg",
    })

    const headers = form.getHeaders()
    log(`FormData headers: ${JSON.stringify(headers)}`)

    // 5. Enviar para Telegram
    log("STEP 5: Sending to Telegram...")
    const telegramUrl = `https://api.telegram.org/bot${token}/setMyProfilePhoto`
    log(`Telegram URL: ${telegramUrl.replace(token, "TOKEN_HIDDEN")}`)

    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: headers,
      // @ts-expect-error - form-data stream works with fetch in Node.js
      body: form,
    })

    log(`Response status: ${response.status}`)
    log(`Response statusText: ${response.statusText}`)
    log(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`)

    // 6. Parse response
    log("STEP 6: Parsing Telegram response...")
    const responseText = await response.text()
    log(`Response text: ${responseText}`)

    let telegramResult: { ok: boolean; description?: string; error_code?: number }
    try {
      telegramResult = JSON.parse(responseText)
    } catch {
      telegramResult = { ok: false, description: `Failed to parse: ${responseText}` }
    }

    log(`Telegram ok: ${telegramResult.ok}`)
    log(`Telegram description: ${telegramResult.description || "none"}`)
    log(`Telegram error_code: ${telegramResult.error_code || "none"}`)

    log("========== TEST PHOTO API END ==========")

    return NextResponse.json({
      success: telegramResult.ok,
      telegramResponse: telegramResult,
      fileInfo: {
        name: file.name,
        type: file.type,
        size: file.size,
        bufferLength: buffer.length,
      },
      logs,
    })

  } catch (error) {
    log(`EXCEPTION: ${String(error)}`)
    log(`EXCEPTION stack: ${(error as Error)?.stack || "no stack"}`)
    log("========== TEST PHOTO API ERROR ==========")

    return NextResponse.json({
      success: false,
      error: String(error),
      logs,
    }, { status: 500 })
  }
}
