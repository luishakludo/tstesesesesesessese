import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import FormData from "form-data"

export const runtime = "nodejs"

// GET - Pagina de diagnostico automatica (so acessar no navegador)
// Uso: /api/telegram/test-photo?token=BOT_TOKEN
//   ou /api/telegram/test-photo?botId=UUID_DO_BOT
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const botId = searchParams.get("botId")
  const directToken = searchParams.get("token")
  
  const logs: string[] = []
  const log = (msg: string) => {
    console.log(msg)
    logs.push(msg)
  }
  
  log("========================================")
  log("TELEGRAM PHOTO UPLOAD - DIAGNOSTIC")
  log("========================================")
  log("")
  
  // STEP 1: Buscar bot do banco OU usar token direto
  log("STEP 1: Obtendo token do bot...")
  
  let bot: { id: string; token: string; name: string; username?: string } | null = null
  
  // Se passou token direto, usar ele
  if (directToken) {
    log("Usando token passado via query parameter")
    bot = {
      id: "direct-token",
      token: directToken,
      name: "Token Direto",
      username: undefined
    }
  } else if (botId) {
    const { data, error } = await supabase
      .from("bots")
      .select("id, token, name, username")
      .eq("id", botId)
      .single()
    
    if (error || !data) {
      log(`ERROR: Bot ${botId} nao encontrado`)
      return renderHTML(logs, "Bot nao encontrado")
    }
    bot = data
  } else {
    const { data, error } = await supabase
      .from("bots")
      .select("id, token, name, username")
      .limit(1)
      .single()
    
    if (error || !data) {
      log("ERROR: Nenhum bot encontrado no banco")
      log("")
      log("DICA: Passe o token diretamente:")
      log("/api/telegram/test-photo?token=SEU_BOT_TOKEN")
      return renderHTML(logs, "Nenhum bot no banco. Use ?token=SEU_BOT_TOKEN para testar diretamente.")
    }
    bot = data
  }
  
  log(`OK - Bot: ${bot.name} (@${bot.username || "sem username"})`)
  log(`ID: ${bot.id}`)
  log(`Token: ${bot.token.substring(0, 15)}...`)
  log("")
  
  const baseUrl = `https://api.telegram.org/bot${bot.token}`
  const botUserId = bot.token.split(":")[0]
  
  // STEP 2: Testar conexao com getMe
  log("STEP 2: Testando conexao (getMe)...")
  
  try {
    const res = await fetch(`${baseUrl}/getMe`)
    const data = await res.json()
    
    if (data.ok) {
      log(`OK - @${data.result.username} conectado`)
      log(`can_join_groups: ${data.result.can_join_groups}`)
      log(`can_read_all_group_messages: ${data.result.can_read_all_group_messages}`)
    } else {
      log(`FALHOU: ${data.description}`)
      return renderHTML(logs, "Token invalido")
    }
  } catch (err) {
    log(`EXCEPTION: ${err}`)
    return renderHTML(logs, "Erro de conexao")
  }
  log("")
  
  // STEP 3: Ver fotos atuais
  log("STEP 3: Fotos de perfil atuais...")
  
  try {
    const res = await fetch(`${baseUrl}/getUserProfilePhotos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: parseInt(botUserId) })
    })
    const data = await res.json()
    
    if (data.ok) {
      log(`Total de fotos: ${data.result.total_count}`)
    } else {
      log(`Erro: ${data.description}`)
    }
  } catch (err) {
    log(`EXCEPTION: ${err}`)
  }
  log("")
  
  // STEP 4: Baixar imagem real para teste
  log("STEP 4: Baixando imagem de teste (200x200)...")
  
  let imageBuffer: Buffer
  try {
    const imgRes = await fetch("https://picsum.photos/200/200")
    const imgArrayBuffer = await imgRes.arrayBuffer()
    imageBuffer = Buffer.from(imgArrayBuffer)
    log(`OK - Imagem baixada: ${imageBuffer.length} bytes`)
    
    // Verificar magic bytes
    const isJpeg = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8
    const isPng = imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50
    log(`Formato detectado: ${isJpeg ? "JPEG" : isPng ? "PNG" : "OUTRO"}`)
  } catch (err) {
    log(`FALHOU ao baixar imagem: ${err}`)
    return renderHTML(logs, "Erro ao baixar imagem de teste")
  }
  log("")
  
  // STEP 5A: Teste com payload_json (formato CORRETO do Telegram)
  log("STEP 5A: setMyProfilePhoto (payload_json + attach://photo)...")
  
  let test5aOk = false
  let test5aError = ""
  try {
    const form = new FormData()
    // Campo "photo" com o arquivo
    form.append("photo", imageBuffer, {
      filename: "avatar.jpg",
      contentType: "image/jpeg",
    })
    // payload_json referenciando attach://photo (DEVE corresponder ao nome do campo)
    form.append("payload_json", JSON.stringify({
      photo: {
        type: "photo",
        media: "attach://photo"
      }
    }))
    
    const res = await fetch(`${baseUrl}/setMyProfilePhoto`, {
      method: "POST",
      headers: form.getHeaders(),
      // @ts-expect-error form-data stream
      body: form,
    })
    
    const text = await res.text()
    log(`Status: ${res.status}`)
    log(`Response: ${text}`)
    
    const data = JSON.parse(text)
    test5aOk = data.ok
    test5aError = data.description || ""
    
    if (data.ok) {
      log("SUCESSO!")
    } else {
      log(`FALHOU: ${data.description}`)
    }
  } catch (err) {
    log(`EXCEPTION: ${err}`)
    test5aError = String(err)
  }
  log("")
  
  // STEP 5B: Teste com formato alternativo (multipart simples)
  log("STEP 5B: setMyProfilePhoto (multipart simples - fallback)...")
  
  let test5bOk = false
  let test5bError = ""
  try {
    const form = new FormData()
    form.append("photo", imageBuffer, {
      filename: "avatar.jpg",
      contentType: "image/jpeg",
    })
    
    const res = await fetch(`${baseUrl}/setMyProfilePhoto`, {
      method: "POST",
      headers: form.getHeaders(),
      // @ts-expect-error form-data stream
      body: form,
    })
    
    const text = await res.text()
    log(`Status: ${res.status}`)
    log(`Response: ${text}`)
    
    const data = JSON.parse(text)
    test5bOk = data.ok
    test5bError = data.description || ""
    
    if (data.ok) {
      log("SUCESSO!")
    } else {
      log(`FALHOU: ${data.description}`)
    }
  } catch (err) {
    log(`EXCEPTION: ${err}`)
    test5bError = String(err)
  }
  log("")
  
  // STEP 5C: Controle - sendPhoto para o proprio bot
  log("STEP 5C: CONTROLE - sendPhoto (mesmo arquivo)...")
  
  let test5cOk = false
  let test5cError = ""
  try {
    const form = new FormData()
    form.append("chat_id", botUserId)
    form.append("photo", imageBuffer, {
      filename: "test.jpg",
      contentType: "image/jpeg",
    })
    
    const res = await fetch(`${baseUrl}/sendPhoto`, {
      method: "POST",
      headers: form.getHeaders(),
      // @ts-expect-error form-data stream
      body: form,
    })
    
    const text = await res.text()
    log(`Status: ${res.status}`)
    log(`Response: ${text.substring(0, 200)}...`)
    
    const data = JSON.parse(text)
    test5cOk = data.ok
    test5cError = data.description || ""
    
    if (data.ok) {
      log("SUCESSO!")
    } else {
      log(`FALHOU: ${data.description}`)
    }
  } catch (err) {
    log(`EXCEPTION: ${err}`)
    test5cError = String(err)
  }
  log("")
  
  // CONCLUSAO
  log("========================================")
  log("CONCLUSAO")
  log("========================================")
  
  let conclusion = ""
  
  if (test5aOk || test5bOk) {
    conclusion = "SUCESSO - Upload de foto de perfil funcionou!"
  } else if (test5cOk) {
    conclusion = `LIMITACAO DO TELEGRAM - O multipart funciona (sendPhoto OK), mas setMyProfilePhoto falha. Erro: "${test5aError || test5bError}". Isso pode ser uma restricao da API do Telegram para bots.`
  } else {
    conclusion = `PROBLEMA NO MULTIPART - Tanto setMyProfilePhoto quanto sendPhoto falharam. Erro setProfile: "${test5aError}". Erro sendPhoto: "${test5cError}"`
  }
  
  log(conclusion)
  log("")
  log("Para testar com token: ?token=SEU_BOT_TOKEN")
  log("Para testar bot do banco: ?botId=SEU_BOT_ID")
  
  return renderHTML(logs, conclusion)
}

function renderHTML(logs: string[], conclusion: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Telegram Photo Diagnostic</title>
  <meta charset="utf-8">
  <style>
    body { 
      font-family: 'Monaco', 'Menlo', monospace; 
      background: #0d1117; 
      color: #c9d1d9; 
      padding: 20px; 
      line-height: 1.5;
    }
    h1 { color: #58a6ff; margin-bottom: 5px; }
    pre { 
      background: #161b22; 
      padding: 15px; 
      border-radius: 6px;
      overflow-x: auto;
      border: 1px solid #30363d;
    }
    .success { color: #3fb950; font-weight: bold; }
    .error { color: #f85149; }
    .info { color: #58a6ff; }
    .warn { color: #d29922; }
    .conclusion {
      background: #21262d;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
      border-left: 4px solid ${conclusion.includes("SUCESSO") ? "#3fb950" : "#f85149"};
    }
  </style>
</head>
<body>
  <h1>Telegram Photo Upload Diagnostic</h1>
  <p style="color:#8b949e">Teste automatico de upload de foto de perfil do bot</p>
  
  <div class="conclusion">
    <strong>${conclusion.includes("SUCESSO") ? "SUCESSO" : "RESULTADO"}:</strong><br>
    ${conclusion}
  </div>
  
  <h2>Logs Detalhados</h2>
  <pre>${logs.map(l => {
    if (l.includes("SUCESSO") || l.includes("OK -")) return `<span class="success">${escapeHtml(l)}</span>`
    if (l.includes("FALHOU") || l.includes("ERROR") || l.includes("EXCEPTION")) return `<span class="error">${escapeHtml(l)}</span>`
    if (l.includes("STEP")) return `<span class="info">${escapeHtml(l)}</span>`
    if (l.includes("===")) return `<span class="warn">${escapeHtml(l)}</span>`
    return escapeHtml(l)
  }).join("\n")}</pre>
</body>
</html>`
  
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
