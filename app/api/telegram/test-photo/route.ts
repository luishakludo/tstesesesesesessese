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

  log("========================================")
  log("DIAGNOSTIC TEST - PROVE ROOT CAUSE")
  log("========================================")

  try {
    // Parse FormData
    const data = await request.formData()
    
    const token = data.get("token") as string
    const chatId = data.get("chatId") as string | null
    const file = data.get("photo") as File | null

    if (!token) {
      return NextResponse.json({ success: false, error: "Token required", logs })
    }

    // ========================================
    // STEP 1 — VERIFY FILE IN BACKEND
    // ========================================
    log("")
    log("--- STEP 1: VERIFY FILE IN BACKEND ---")
    log(`FILE EXISTS: ${!!file}`)
    log(`TYPE: ${file?.constructor?.name}`)
    log(`NAME: ${file?.name}`)
    log(`SIZE: ${file?.size}`)
    log(`MIME: ${file?.type}`)

    if (!file) {
      log("STOP: File is missing!")
      return NextResponse.json({
        success: false,
        conclusion: "File was never sent correctly - no file received in backend",
        logs,
      })
    }

    if (file.size === 0) {
      log("STOP: File size is 0!")
      return NextResponse.json({
        success: false,
        conclusion: "File was never sent correctly - file is empty",
        logs,
      })
    }

    // ========================================
    // STEP 2 — VERIFY BUFFER CONVERSION
    // ========================================
    log("")
    log("--- STEP 2: VERIFY BUFFER CONVERSION ---")
    
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    log(`BUFFER SIZE: ${buffer.length}`)

    if (buffer.length === 0) {
      log("STOP: Buffer size is 0!")
      return NextResponse.json({
        success: false,
        conclusion: "File was never sent correctly - buffer conversion failed",
        logs,
      })
    }

    // Verify magic bytes
    const firstBytes = buffer.slice(0, 10).toString("hex")
    log(`FIRST 10 BYTES (hex): ${firstBytes}`)
    
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50
    log(`DETECTED FORMAT: ${isJpeg ? "JPEG" : isPng ? "PNG" : "UNKNOWN"}`)

    // ========================================
    // STEP 3 — VERIFY MULTIPART BODY
    // ========================================
    log("")
    log("--- STEP 3: VERIFY MULTIPART BODY ---")
    
    const form = new FormData()
    form.append("photo", buffer, {
      filename: "photo.jpg",
      contentType: file.type || "image/jpeg"
    })

    const headers = form.getHeaders()
    log(`HEADERS: ${JSON.stringify(headers)}`)

    // ========================================
    // STEP 4 — SEND TO setMyProfilePhoto
    // ========================================
    log("")
    log("--- STEP 4: SEND TO setMyProfilePhoto ---")
    
    const setProfileUrl = `https://api.telegram.org/bot${token}/setMyProfilePhoto`
    log(`URL: /bot****/setMyProfilePhoto`)

    const profileResponse = await fetch(setProfileUrl, {
      method: "POST",
      headers: form.getHeaders(),
      // @ts-expect-error - form-data stream works with fetch in Node.js
      body: form,
    })

    const profileText = await profileResponse.text()
    log(`TELEGRAM RAW RESPONSE: ${profileText}`)

    let profileResult: { ok: boolean; description?: string; error_code?: number }
    try {
      profileResult = JSON.parse(profileText)
    } catch {
      profileResult = { ok: false, description: profileText }
    }

    const setProfilePhotoWorked = profileResult.ok

    // ========================================
    // STEP 5 — CONTROL TEST: sendPhoto
    // ========================================
    log("")
    log("--- STEP 5: CONTROL TEST (sendPhoto) ---")
    
    let sendPhotoWorked = false
    let sendPhotoResult: { ok: boolean; description?: string } | null = null

    if (chatId) {
      log(`CHAT_ID provided: ${chatId}`)
      
      // Create new form for sendPhoto
      const form2 = new FormData()
      form2.append("chat_id", chatId)
      form2.append("photo", buffer, {
        filename: "photo.jpg",
        contentType: file.type || "image/jpeg"
      })

      const sendPhotoUrl = `https://api.telegram.org/bot${token}/sendPhoto`
      log(`URL: /bot****/sendPhoto`)

      const sendResponse = await fetch(sendPhotoUrl, {
        method: "POST",
        headers: form2.getHeaders(),
        // @ts-expect-error - form-data stream works with fetch in Node.js
        body: form2,
      })

      const sendText = await sendResponse.text()
      log(`TELEGRAM RAW RESPONSE: ${sendText}`)

      try {
        sendPhotoResult = JSON.parse(sendText)
        sendPhotoWorked = sendPhotoResult?.ok || false
      } catch {
        sendPhotoResult = { ok: false, description: sendText }
      }
    } else {
      log("CHAT_ID not provided - skipping sendPhoto control test")
      log("To run control test, add chatId to the request")
    }

    // ========================================
    // CONCLUSION
    // ========================================
    log("")
    log("========================================")
    log("CONCLUSION")
    log("========================================")

    let conclusion = ""

    if (setProfilePhotoWorked) {
      conclusion = "SUCCESS: setMyProfilePhoto worked!"
      log(conclusion)
    } else if (chatId && sendPhotoWorked && !setProfilePhotoWorked) {
      conclusion = "Telegram API does not accept this operation - sendPhoto works but setMyProfilePhoto fails. This is a Telegram Bot API limitation/restriction."
      log(conclusion)
    } else if (chatId && !sendPhotoWorked && !setProfilePhotoWorked) {
      conclusion = "Multipart is broken - both sendPhoto and setMyProfilePhoto failed"
      log(conclusion)
    } else {
      conclusion = `setMyProfilePhoto failed with: ${profileResult.description || "unknown error"}. Run control test with chatId to determine if multipart is broken or if it's a Telegram API limitation.`
      log(conclusion)
    }

    log("========================================")

    return NextResponse.json({
      success: setProfilePhotoWorked,
      conclusion,
      results: {
        fileReceived: true,
        bufferValid: buffer.length > 0,
        setMyProfilePhoto: {
          success: setProfilePhotoWorked,
          response: profileResult,
        },
        sendPhoto: chatId ? {
          success: sendPhotoWorked,
          response: sendPhotoResult,
        } : "skipped - no chatId provided",
      },
      logs,
    })

  } catch (error) {
    log(`EXCEPTION: ${String(error)}`)
    log(`STACK: ${(error as Error)?.stack || "no stack"}`)

    return NextResponse.json({
      success: false,
      conclusion: `Exception occurred: ${String(error)}`,
      error: String(error),
      logs,
    }, { status: 500 })
  }
}
