import { NextRequest, NextResponse } from "next/server"
import FormData from "form-data"

// IMPORTANTE: Forcar runtime nodejs (form-data NAO funciona no edge)
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

    // Upload new profile photo usando form-data (lib) com Buffer
    if (photo) {
      console.log("[v0] UPDATE API - Photo upload starting...")
      try {
        // CONVERSAO REAL: File -> ArrayBuffer -> Buffer
        const arrayBuffer = await photo.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        console.log("[v0] UPDATE API - Buffer size:", buffer.length)
        console.log("[v0] UPDATE API - File type:", photo.type)
        
        // Usar form-data library com Buffer (NAO Blob)
        const form = new FormData()
        form.append("photo", buffer, {
          filename: photo.name || "photo.png",
          contentType: photo.type || "image/png",
        })
        
        console.log("[v0] UPDATE API - Sending to Telegram with form-data lib...")
        
        const response = await fetch(`${baseUrl}/setMyProfilePhoto`, {
          method: "POST",
          // IMPORTANTE: usar getHeaders() para multipart funcionar
          headers: form.getHeaders(),
          // @ts-expect-error form-data stream e compativel com fetch body
          body: form,
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
