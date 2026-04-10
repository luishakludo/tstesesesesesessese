import { NextRequest, NextResponse } from "next/server"

interface TelegramResponse<T> {
  ok: boolean
  result?: T
  description?: string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const token = formData.get("token") as string
    const name = formData.get("name") as string | null
    const description = formData.get("description") as string | null
    const shortDescription = formData.get("shortDescription") as string | null
    const photo = formData.get("photo") as File | null
    const deletePhoto = formData.get("deletePhoto") === "true"

    console.log("[v0] UPDATE API - Received request")
    console.log("[v0] UPDATE API - token exists:", !!token)
    console.log("[v0] UPDATE API - name:", name)
    console.log("[v0] UPDATE API - photo:", photo ? `File: ${photo.name}, size: ${photo.size}, type: ${photo.type}` : "null")

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token é obrigatório" },
        { status: 400 }
      )
    }

    const baseUrl = `https://api.telegram.org/bot${token}`
    const results: { name?: boolean; description?: boolean; shortDescription?: boolean; photo?: boolean; photoError?: string } = {}

    // Update bot name
    if (name !== undefined && name !== null) {
      try {
        const response = await fetch(`${baseUrl}/setMyName`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        })
        const data: TelegramResponse<boolean> = await response.json()
        results.name = data.ok
      } catch {
        results.name = false
      }
    }

    // Update description
    if (description !== undefined && description !== null) {
      try {
        const response = await fetch(`${baseUrl}/setMyDescription`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description }),
        })
        const data: TelegramResponse<boolean> = await response.json()
        results.description = data.ok
      } catch {
        results.description = false
      }
    }

    // Update short description
    if (shortDescription !== undefined && shortDescription !== null) {
      try {
        const response = await fetch(`${baseUrl}/setMyShortDescription`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ short_description: shortDescription }),
        })
        const data: TelegramResponse<boolean> = await response.json()
        results.shortDescription = data.ok
      } catch {
        results.shortDescription = false
      }
    }

    // Delete profile photo
    if (deletePhoto) {
      try {
        const response = await fetch(`${baseUrl}/deleteMyProfilePhoto`, {
          method: "POST",
        })
        const data: TelegramResponse<boolean> = await response.json()
        results.photo = data.ok
      } catch {
        results.photo = false
      }
    }

    // Upload new profile photo usando multipart manual
    if (photo) {
      console.log("[v0] UPDATE API - Photo upload starting...")
      try {
        const arrayBuffer = await photo.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        
        console.log("[v0] UPDATE API - File size:", uint8Array.length)
        console.log("[v0] UPDATE API - File type:", photo.type)
        
        // Criar multipart body manualmente (mais confiavel no Node.js)
        const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`
        const filename = photo.name || "photo.png"
        const contentType = photo.type || "image/png"
        
        // Header part
        const headerStr = [
          `--${boundary}`,
          `Content-Disposition: form-data; name="photo"; filename="${filename}"`,
          `Content-Type: ${contentType}`,
          "",
          ""
        ].join("\r\n")
        
        // Footer part  
        const footerStr = `\r\n--${boundary}--\r\n`
        
        // Converter strings para Uint8Array
        const encoder = new TextEncoder()
        const headerBytes = encoder.encode(headerStr)
        const footerBytes = encoder.encode(footerStr)
        
        // Concatenar tudo
        const bodyLength = headerBytes.length + uint8Array.length + footerBytes.length
        const body = new Uint8Array(bodyLength)
        body.set(headerBytes, 0)
        body.set(uint8Array, headerBytes.length)
        body.set(footerBytes, headerBytes.length + uint8Array.length)
        
        console.log("[v0] UPDATE API - Total body size:", body.length)
        console.log("[v0] UPDATE API - Sending to Telegram...")
        
        const response = await fetch(`${baseUrl}/setMyProfilePhoto`, {
          method: "POST",
          headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body: body,
        })
        
        const responseText = await response.text()
        console.log("[v0] UPDATE API - Response status:", response.status)
        console.log("[v0] UPDATE API - Response text:", responseText)
        
        let telegramResponse: { ok: boolean; description?: string }
        try {
          telegramResponse = JSON.parse(responseText)
        } catch {
          telegramResponse = { ok: false, description: `Parse error: ${responseText}` }
        }
        
        results.photo = telegramResponse.ok
        if (!telegramResponse.ok) {
          results.photoError = telegramResponse.description || "Unknown error"
          console.log("[v0] UPDATE API - Photo upload FAILED:", telegramResponse.description)
        } else {
          console.log("[v0] UPDATE API - Photo upload SUCCESS")
        }
      } catch (err) {
        console.log("[v0] UPDATE API - Photo upload EXCEPTION:", err)
        results.photo = false
        results.photoError = String(err)
      }
    }

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    console.error("Error updating telegram bot:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar bot" },
      { status: 500 }
    )
  }
}
