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
  log("Telegram Bot API 9.4+ (Feb 2026) - InputProfilePhoto format")

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

    // Validar tipo de imagem (deve ser JPG para static profile photo)
    const validTypes = ["image/jpeg", "image/jpg", "image/png"]
    if (!validTypes.includes(file.type)) {
      log(`ERROR: Invalid image type. Expected JPEG/PNG, got: ${file.type}`)
      return NextResponse.json({
        success: false,
        error: `Tipo de imagem invalido. Use JPEG ou PNG. Recebido: ${file.type}`,
        logs,
      })
    }

    // 3. Converter para Buffer
    log("STEP 3: Converting to Buffer...")
    const arrayBuffer = await file.arrayBuffer()
    log(`ArrayBuffer byteLength: ${arrayBuffer.byteLength}`)
    
    const buffer = Buffer.from(arrayBuffer)
    log(`Buffer length: ${buffer.length}`)
    log(`Buffer first 10 bytes (hex): ${buffer.slice(0, 10).toString("hex")}`)

    // Detectar formato real da imagem pelos magic bytes
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47
    log(`Magic bytes detection - JPEG: ${isJpeg}, PNG: ${isPng}`)

    // 4. Criar FormData com form-data library (Bot API 9.4+ format)
    // setMyProfilePhoto agora requer:
    // - photo: JSON object { type: "static", photo: "attach://photo_file" }
    // - photo_file: o arquivo binario
    log("STEP 4: Creating FormData with Bot API 9.4+ InputProfilePhoto format...")
    
    const form = new FormData()
    
    // O objeto InputProfilePhotoStatic
    const inputProfilePhoto = {
      type: "static",
      photo: "attach://photo_file"
    }
    log(`InputProfilePhoto object: ${JSON.stringify(inputProfilePhoto)}`)
    
    // Adicionar o objeto photo como JSON
    form.append("photo", JSON.stringify(inputProfilePhoto))
    
    // Adicionar o arquivo binario com o nome referenciado (photo_file)
    form.append("photo_file", buffer, {
      filename: file.name || "photo.jpg",
      contentType: file.type || "image/jpeg",
    })

    const headers = form.getHeaders()
    log(`FormData headers: ${JSON.stringify(headers)}`)

    // 5. Enviar para Telegram
    log("STEP 5: Sending to Telegram setMyProfilePhoto...")
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

    let telegramResult: { ok: boolean; description?: string; error_code?: number; result?: unknown }
    try {
      telegramResult = JSON.parse(responseText)
    } catch {
      telegramResult = { ok: false, description: `Failed to parse: ${responseText}` }
    }

    log(`Telegram ok: ${telegramResult.ok}`)
    log(`Telegram description: ${telegramResult.description || "none"}`)
    log(`Telegram error_code: ${telegramResult.error_code || "none"}`)
    if (telegramResult.result) {
      log(`Telegram result: ${JSON.stringify(telegramResult.result)}`)
    }

    log("========== TEST PHOTO API END ==========")

    return NextResponse.json({
      success: telegramResult.ok,
      telegramResponse: telegramResult,
      fileInfo: {
        name: file.name,
        type: file.type,
        size: file.size,
        bufferLength: buffer.length,
        detectedFormat: isJpeg ? "JPEG" : isPng ? "PNG" : "unknown",
      },
      apiVersion: "Bot API 9.4+ (InputProfilePhoto format)",
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
