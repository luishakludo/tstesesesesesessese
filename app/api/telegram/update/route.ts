import { NextRequest, NextResponse } from "next/server"
import FormData from "form-data"

// CRITICAL: Node.js runtime - NÃO usar Edge
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    // 1. Parse incoming FormData
    const data = await request.formData()
    
    const token = data.get("token") as string
    const name = data.get("name") as string | null
    const description = data.get("description") as string | null
    const shortDescription = data.get("shortDescription") as string | null
    const file = data.get("photo") as File | null
    const deletePhoto = data.get("deletePhoto") === "true"

    console.log("========== TELEGRAM UPDATE API ==========")
    console.log("TOKEN EXISTS:", !!token)
    console.log("FILE EXISTS:", !!file)
    if (file) {
      console.log("FILE name:", file.name)
      console.log("FILE type:", file.type)
      console.log("FILE size:", file.size, "bytes")
    }
    console.log("==========================================")

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token é obrigatório" }, { status: 400 })
    }

    const baseUrl = `https://api.telegram.org/bot${token}`
    const results: { 
      name?: boolean
      description?: boolean
      shortDescription?: boolean
      photo?: boolean
      photoError?: string 
    } = {}

    // Update bot name
    if (name !== undefined && name !== null) {
      try {
        const response = await fetch(`${baseUrl}/setMyName`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        })
        const responseData = await response.json()
        results.name = responseData.ok
        console.log("setMyName result:", responseData.ok)
      } catch (err) {
        console.log("setMyName error:", err)
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
        const responseData = await response.json()
        results.description = responseData.ok
        console.log("setMyDescription result:", responseData.ok)
      } catch (err) {
        console.log("setMyDescription error:", err)
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
        const responseData = await response.json()
        results.shortDescription = responseData.ok
        console.log("setMyShortDescription result:", responseData.ok)
      } catch (err) {
        console.log("setMyShortDescription error:", err)
        results.shortDescription = false
      }
    }

    // Delete profile photo
    if (deletePhoto) {
      try {
        const response = await fetch(`${baseUrl}/deleteMyProfilePhoto`, {
          method: "POST",
        })
        const responseData = await response.json()
        results.photo = responseData.ok
        console.log("deleteMyProfilePhoto result:", responseData.ok)
      } catch (err) {
        console.log("deleteMyProfilePhoto error:", err)
        results.photo = false
      }
    }

    // Upload profile photo - MULTIPART/FORM-DATA DIRETO PARA TELEGRAM
    if (file) {
      console.log("========== PHOTO UPLOAD START ==========")
      
      // Validar tipo
      if (!file.type.startsWith("image/")) {
        console.log("ERROR: not an image, type:", file.type)
        results.photo = false
        results.photoError = "Arquivo deve ser uma imagem"
        return NextResponse.json({ success: true, results })
      }

      // Validar tamanho (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        console.log("ERROR: file too large:", file.size)
        results.photo = false
        results.photoError = "Imagem maior que 5MB"
        return NextResponse.json({ success: true, results })
      }

      try {
        // 1. Converter File para Buffer
        console.log("Converting File to Buffer...")
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        console.log("Buffer length:", buffer.length)

        // 2. Criar FormData usando a biblioteca form-data (funciona no Node.js)
        console.log("Creating FormData with form-data library...")
        const form = new FormData()
        form.append("photo", buffer, {
          filename: file.name || "photo.jpg",
          contentType: file.type || "image/jpeg",
        })

        // 3. Enviar para o Telegram via multipart/form-data
        console.log("Sending to Telegram with multipart/form-data...")
        const telegramUrl = `${baseUrl}/setMyProfilePhoto`
        
        const telegramResponse = await fetch(telegramUrl, {
          method: "POST",
          headers: form.getHeaders(),
          // @ts-expect-error - form-data stream works with fetch in Node.js
          body: form,
        })

        const responseText = await telegramResponse.text()
        console.log("TELEGRAM RESPONSE STATUS:", telegramResponse.status)
        console.log("TELEGRAM RESPONSE:", responseText)

        let telegramResult: { ok: boolean; description?: string }
        try {
          telegramResult = JSON.parse(responseText)
        } catch {
          telegramResult = { ok: false, description: responseText }
        }

        results.photo = telegramResult.ok
        
        if (telegramResult.ok) {
          console.log("========== PHOTO UPLOAD SUCCESS ==========")
        } else {
          console.log("========== PHOTO UPLOAD FAILED ==========")
          console.log("ERROR:", telegramResult.description)
          results.photoError = telegramResult.description || "Erro desconhecido"
        }
      } catch (err) {
        console.log("========== PHOTO UPLOAD EXCEPTION ==========")
        console.log("EXCEPTION:", err)
        results.photo = false
        results.photoError = String(err)
      }
    }

    console.log("========== FINAL RESULTS ==========")
    console.log("results:", JSON.stringify(results, null, 2))

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    console.error("========== API ERROR ==========")
    console.error("Error:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar bot" },
      { status: 500 }
    )
  }
}
