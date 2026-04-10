import FormData from "form-data"
import axios from "axios"

export interface UpdateBotPhotoResult {
  success: boolean
  error?: string
  response?: unknown
}

/**
 * Atualiza a foto de perfil de um bot do Telegram
 * 
 * Este formato foi testado e confirmado funcionando:
 * - photo_file: Buffer da imagem
 * - photo: JSON { type: "static", photo: "attach://photo_file" }
 * - Envio via axios com multipart/form-data
 * 
 * @param imageBuffer - Buffer da imagem (JPEG ou PNG)
 * @param token - Token do bot do Telegram
 * @returns Resultado da operacao
 */
export async function updateBotProfilePhoto(
  imageBuffer: Buffer,
  token: string
): Promise<UpdateBotPhotoResult> {
  const baseUrl = `https://api.telegram.org/bot${token}`
  
  try {
    const form = new FormData()
    
    // Anexar o buffer da imagem com nome "photo_file"
    form.append("photo_file", imageBuffer, {
      filename: "avatar.jpg",
      contentType: "image/jpeg",
    })
    
    // O parametro "photo" deve ser um JSON com InputProfilePhotoStatic
    // FORMATO CORRETO: { type: "static", photo: "attach://photo_file" }
    const photoJson = JSON.stringify({
      type: "static",
      photo: "attach://photo_file"
    })
    form.append("photo", photoJson, { contentType: "application/json" })
    
    const response = await axios.post(`${baseUrl}/setMyProfilePhoto`, form, {
      headers: {
        ...form.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })
    
    if (response.data.ok) {
      return {
        success: true,
        response: response.data
      }
    } else {
      return {
        success: false,
        error: response.data.description || "Unknown error",
        response: response.data
      }
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return {
        success: false,
        error: err.response?.data?.description || err.message,
        response: err.response?.data
      }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * Deleta uma foto de perfil do bot pelo file_id
 * 
 * @param fileId - ID do arquivo da foto a ser deletada
 * @param token - Token do bot do Telegram
 * @returns Resultado da operacao
 */
export async function deleteBotProfilePhoto(
  fileId: string,
  token: string
): Promise<UpdateBotPhotoResult> {
  const baseUrl = `https://api.telegram.org/bot${token}`
  
  try {
    const response = await axios.post(`${baseUrl}/deleteMyProfilePhoto`, {
      file_id: fileId
    })
    
    if (response.data.ok) {
      return {
        success: true,
        response: response.data
      }
    } else {
      return {
        success: false,
        error: response.data.description || "Unknown error",
        response: response.data
      }
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return {
        success: false,
        error: err.response?.data?.description || err.message,
        response: err.response?.data
      }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * Busca as fotos de perfil atuais do bot
 * 
 * @param token - Token do bot do Telegram
 * @returns Lista de fotos ou erro
 */
export async function getBotProfilePhotos(token: string): Promise<{
  success: boolean
  photos?: Array<{ file_id: string; width: number; height: number }>
  totalCount?: number
  error?: string
}> {
  const baseUrl = `https://api.telegram.org/bot${token}`
  const botUserId = token.split(":")[0]
  
  try {
    const response = await axios.post(`${baseUrl}/getUserProfilePhotos`, {
      user_id: parseInt(botUserId)
    })
    
    if (response.data.ok) {
      const photos = response.data.result.photos.flat()
      return {
        success: true,
        photos,
        totalCount: response.data.result.total_count
      }
    } else {
      return {
        success: false,
        error: response.data.description || "Unknown error"
      }
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return {
        success: false,
        error: err.response?.data?.description || err.message
      }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}
