import { NextRequest, NextResponse } from "next/server"

// CRITICAL: Node.js runtime - NAO usar Edge
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
      return NextResponse.json({ error: "Token e obrigatorio" }, { status: 400 })
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

    // Delete profile photo - usando removeMyProfilePhoto (Bot API 9.4+)
    if (deletePhoto) {
      try {
        const response = await fetch(`${baseUrl}/removeMyProfilePhoto`, {
          method: "POST",
        })
        const responseData = await response.json()
        results.photo = responseData.ok
        console.log("removeMyProfilePhoto result:", responseData.ok)
      } catch (err) {
        console.log("removeMyProfilePhoto error:", err)
        results.photo = false
      }
    }

    // Upload profile photo - Bot API 9.4+ (InputProfilePhoto format)
    if (file) {
      console.log("========== PHOTO UPLOAD START (Bot API 9.4+) ==========")
      
      // Validar tipo
      const validTypes = ["image/jpeg", "image/jpg", "image/png"]
      if (!validTypes.includes(file.type)) {
        console.log("ERROR: invalid image type:", file.type)
        results.photo = false
        results.photoError = "Arquivo deve ser JPEG ou PNG"
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
        console.log("Converting File to ArrayBuffer...")
        const arrayBuffer = await file.arrayBuffer()
        console.log("ArrayBuffer length:", arrayBuffer.byteLength)

        // 2. Criar FormData NATIVO do Node.js (funciona com fetch)
        // A biblioteca form-data usa streams que nao funcionam bem com fetch nativo
        console.log("Creating native FormData...")
        const telegramUrl = `${baseUrl}/setMyProfilePhoto`
        
        // Tentar formato Bot API 9.4+ primeiro (InputProfilePhotoStatic)
        console.log("Trying Bot API 9.4+ format (InputProfilePhotoStatic)...")
        const form94 = new FormData()
        const blob94 = new Blob([arrayBuffer], { type: file.type || "image/jpeg" })
        form94.append("photo_file", blob94, file.name || "photo.jpg")
        form94.append("photo", JSON.stringify({
          type: "static",
          photo: "attach://photo_file"
        }))

        const response94 = await fetch(telegramUrl, {
          method: "POST",
          body: form94,
        })

        const text94 = await response94.text()
        console.log("TELEGRAM 9.4+ RESPONSE STATUS:", response94.status)
        console.log("TELEGRAM 9.4+ RESPONSE:", text94 || "(vazio)")

        let telegramResult: { ok: boolean; description?: string }
        if (text94) {
          try {
            telegramResult = JSON.parse(text94)
          } catch {
            telegramResult = { ok: false, description: text94 }
          }
        } else {
          telegramResult = { ok: false, description: "Resposta vazia do Telegram" }
        }

        // Se falhar com o formato 9.4+, tentar formato legado (envio direto do arquivo)
        if (!telegramResult.ok) {
          console.log("========== TRYING LEGACY FORMAT ==========")
          console.log("Bot API 9.4+ format failed, trying direct file upload...")
          
          const legacyForm = new FormData()
          const legacyBlob = new Blob([arrayBuffer], { type: file.type || "image/jpeg" })
          legacyForm.append("photo", legacyBlob, file.name || "photo.jpg")
          
          const legacyResponse = await fetch(telegramUrl, {
            method: "POST",
            body: legacyForm,
          })
          
          const legacyText = await legacyResponse.text()
          console.log("LEGACY RESPONSE STATUS:", legacyResponse.status)
          console.log("LEGACY RESPONSE:", legacyText || "(vazio)")
          
          if (legacyText) {
            try {
              telegramResult = JSON.parse(legacyText)
            } catch {
              telegramResult = { ok: false, description: legacyText }
            }
          } else {
            telegramResult = { ok: false, description: "Resposta vazia (legacy)" }
          }
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
