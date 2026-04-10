import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

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

    // DEBUG OBRIGATORIO
    console.log("========== TELEGRAM UPDATE API ==========")
    console.log("TOKEN EXISTS:", !!token)
    console.log("TOKEN LENGTH:", token?.length)
    console.log("FILE:", file)
    console.log("NAME:", file?.name)
    console.log("TYPE:", file?.type)
    console.log("SIZE:", file?.size)
    console.log("FILE instanceof File:", file instanceof File)
    console.log("==========================================")

    if (!token || typeof token !== "string") {
      console.log("ERROR: Token missing")
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

    // Upload profile photo - VIA SUPABASE STORAGE + URL PUBLICA
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
        // 1. Convert File → Uint8Array para Supabase
        console.log("Converting File to buffer...")
        const arrayBuffer = await file.arrayBuffer()
        const buffer = new Uint8Array(arrayBuffer)
        console.log("Buffer created, length:", buffer.length)

        // 2. Gerar nome unico para o arquivo
        const ext = file.name?.split(".").pop() || "jpg"
        const uniqueId = `bot_${Date.now()}_${Math.random().toString(36).substring(7)}`
        const filePath = `bot-photos/${uniqueId}.${ext}`
        console.log("File path:", filePath)

        // 3. Upload para Supabase Storage (bucket flow-media)
        console.log("Uploading to Supabase Storage...")
        const { error: uploadError } = await supabase.storage
          .from("flow-media")
          .upload(filePath, buffer, {
            contentType: file.type,
            upsert: true,
          })

        if (uploadError) {
          console.log("Supabase upload error:", uploadError)
          results.photo = false
          results.photoError = `Erro no upload: ${uploadError.message}`
          return NextResponse.json({ success: true, results })
        }

        // 4. Pegar URL publica
        const { data: urlData } = supabase.storage.from("flow-media").getPublicUrl(filePath)
        const publicUrl = urlData.publicUrl
        console.log("Public URL:", publicUrl)

        // 5. Enviar para o Telegram usando URL publica
        console.log("Sending to Telegram with URL...")
        const telegramResponse = await fetch(`${baseUrl}/setMyProfilePhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo: publicUrl }),
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
