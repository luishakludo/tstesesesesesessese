import { NextRequest, NextResponse } from "next/server"

// IMPORTANTE: Forcar runtime nodejs para suportar upload de arquivos
export const runtime = "nodejs"

interface TelegramResponse<T> {
  ok: boolean
  result?: T
  description?: string
}

export async function POST(request: NextRequest) {
  try {
    const reqFormData = await request.formData()
    const token = reqFormData.get("token") as string
    const name = reqFormData.get("name") as string | null
    const description = reqFormData.get("description") as string | null
    const shortDescription = reqFormData.get("shortDescription") as string | null
    const photo = reqFormData.get("photo") as File | null
    const deletePhoto = reqFormData.get("deletePhoto") === "true"

    console.log("[v0] UPDATE API - Received request")
    console.log("[v0] UPDATE API - token exists:", !!token)
    console.log("[v0] UPDATE API - name:", name)
    console.log("[v0] UPDATE API - photo:", photo ? `File: ${photo.name}, size: ${photo.size}, type: ${photo.type}` : "null")
    console.log("[v0] UPDATE API - photo instanceof File:", photo instanceof File)

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

    // Upload new profile photo usando FormData nativo do Web API
    if (photo) {
      console.log("[v0] UPDATE API - Photo upload starting...")
      
      // Validacoes
      if (!photo.type.startsWith("image/")) {
        results.photo = false
        results.photoError = "Arquivo deve ser uma imagem (PNG, JPG)"
        return NextResponse.json({ success: true, results })
      }
      
      // Telegram limite: 5MB para foto de perfil
      const maxSize = 5 * 1024 * 1024
      if (photo.size > maxSize) {
        results.photo = false
        results.photoError = `Imagem muito grande (${(photo.size / 1024 / 1024).toFixed(2)}MB). Máximo: 5MB`
        return NextResponse.json({ success: true, results })
      }
      
      try {
        // Converter File para Blob com ArrayBuffer
        const arrayBuffer = await photo.arrayBuffer()
        const blob = new Blob([arrayBuffer], { type: photo.type })
        
        console.log("[v0] UPDATE API - Blob size:", blob.size)
        console.log("[v0] UPDATE API - Blob type:", blob.type)
        
        // Criar FormData nativo para enviar ao Telegram
        const telegramFormData = new FormData()
        telegramFormData.append("photo", blob, photo.name || "photo.png")
        
        console.log("[v0] UPDATE API - Sending to Telegram...")
        
        const response = await fetch(`${baseUrl}/setMyProfilePhoto`, {
          method: "POST",
          body: telegramFormData,
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
