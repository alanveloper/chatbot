// enfoca-api | Port directo del backend Express (backend/src/server.ts).
// Mantiene el mismo contrato de /api/health, /api/chat, /api/transcribe y
// /api/speech para que el frontend solo cambie la URL base.
// Sin JWT (verify_jwt = false en config.toml): el frontend no inicia sesion.
import { SYSTEM_PROMPT, UX_CONTRACT } from './prompt.ts'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const BASE_OPENAI = Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1'

function corsHeaders(req: Request): Record<string, string> {
  // CORS_ORIGIN acepta una lista separada por comas, p. ej. el dominio de Vercel.
  const permitidos = (Deno.env.get('CORS_ORIGIN') ?? '*').split(',').map((o) => o.trim()).filter(Boolean)
  const origen = req.headers.get('origin') ?? ''
  const permitido = permitidos.includes('*') ? '*' : permitidos.includes(origen) ? origen : permitidos[0]
  return {
    'access-control-allow-origin': permitido,
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    vary: 'origin',
  }
}

function llaveOpenai(): string {
  const llave = Deno.env.get('OPENAI_API_KEY')
  if (!llave) throw new Error('Falta el secreto OPENAI_API_KEY en Supabase.')
  return llave
}

function isOrientationResponse(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const result = value as { assistant?: { message?: unknown } }
  return typeof result.assistant?.message === 'string'
}

// La API REST de Responses no trae output_text (eso lo arma el SDK).
function textoDeSalida(respuesta: any): string {
  if (typeof respuesta?.output_text === 'string') return respuesta.output_text
  return (respuesta?.output ?? [])
    .flatMap((item: any) => item?.content ?? [])
    .filter((parte: any) => parte?.type === 'output_text' && typeof parte.text === 'string')
    .map((parte: any) => parte.text)
    .join('')
}

async function chat(req: Request, json: (cuerpo: unknown, status?: number) => Response): Promise<Response> {
  const body = await req.json().catch(() => null)
  const messages = body?.messages

  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'El campo messages es obligatorio y debe ser una lista.' }, 400)
  }
  if (messages.length > 100) {
    return json({ error: 'La conversación es demasiado larga para esta prueba.' }, 400)
  }
  const validMessages = messages.every((message: unknown) => {
    if (!message || typeof message !== 'object') return false
    const item = message as Record<string, unknown>
    return (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string' && item.content.trim().length > 0 && item.content.length <= 4000
  })
  if (!validMessages) {
    return json({ error: 'Cada mensaje debe tener role y content válidos.' }, 400)
  }

  const configuredPrompt = Deno.env.get('ORIENTADOR_SYSTEM_PROMPT')?.trim()
  try {
    const r = await fetch(`${BASE_OPENAI}/responses`, {
      method: 'POST',
      headers: { authorization: `Bearer ${llaveOpenai()}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.6-luna',
        instructions: `${configuredPrompt || SYSTEM_PROMPT}${UX_CONTRACT}`,
        input: messages as ChatMessage[],
        max_output_tokens: 1200,
      }),
    })
    const response = await r.json().catch(() => null)
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${JSON.stringify(response ?? {}).slice(0, 400)}`)

    const outputText = textoDeSalida(response)
    try {
      const structured = JSON.parse(outputText) as Record<string, unknown>
      if (isOrientationResponse(structured)) return json({ ...structured, responseId: response.id })
    } catch {
      // Un proveedor puede devolver texto pese a la instrucción; la UX degrada a texto libre.
    }
    return json({ message: outputText, responseId: response.id })
  } catch (error) {
    console.error('Error al consultar OpenAI:', error)
    return json({ error: 'No fue posible obtener una respuesta del asistente.' }, 500)
  }
}

async function transcribe(req: Request, json: (cuerpo: unknown, status?: number) => Response): Promise<Response> {
  // OrientationExperience manda JSON con base64; ChatTest manda el audio crudo.
  let bytes: Uint8Array
  let mimeType: string
  if ((req.headers.get('content-type') ?? '').includes('application/json')) {
    const body = await req.json().catch(() => null)
    const audio = typeof body?.audio === 'string' ? body.audio : ''
    mimeType = typeof body?.mimeType === 'string' && body.mimeType ? body.mimeType : 'audio/webm'
    if (!audio || audio.length > 7_000_000) {
      return json({ error: 'El audio es obligatorio y debe durar poco tiempo.' }, 400)
    }
    try {
      bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0))
    } catch {
      return json({ error: 'El audio no está codificado correctamente.' }, 400)
    }
  } else {
    mimeType = req.headers.get('content-type') || 'audio/webm'
    bytes = new Uint8Array(await req.arrayBuffer())
    if (bytes.length === 0 || bytes.length > 20_000_000) {
      return json({ error: 'No recibimos un audio válido para transcribir.' }, 400)
    }
  }
  if (!mimeType.startsWith('audio/')) {
    return json({ error: 'El formato de audio no es válido.' }, 400)
  }

  try {
    const extension = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm'
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: mimeType }), `respuesta.${extension}`)
    form.append('model', Deno.env.get('OPENAI_TRANSCRIPTION_MODEL') ?? 'gpt-4o-mini-transcribe')
    form.append('language', 'es')
    const r = await fetch(`${BASE_OPENAI}/audio/transcriptions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${llaveOpenai()}` },
      body: form,
    })
    const transcription = await r.json().catch(() => null)
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${JSON.stringify(transcription ?? {}).slice(0, 400)}`)
    const text = String(transcription?.text ?? '').trim()
    if (!text) return json({ error: 'No pude distinguir palabras en el audio.' }, 422)
    return json({ text })
  } catch (error) {
    console.error('Error al transcribir audio:', error)
    return json({ error: 'No pude transcribir tu voz en este momento.' }, 502)
  }
}

async function speech(req: Request, cors: Record<string, string>, json: (cuerpo: unknown, status?: number) => Response): Promise<Response> {
  const body = await req.json().catch(() => null)
  const text = body?.text
  if (typeof text !== 'string' || !text.trim() || text.length > 4000) {
    return json({ error: 'El texto de voz debe tener entre 1 y 4,000 caracteres.' }, 400)
  }

  const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY')
  const elevenLabsVoiceId = Deno.env.get('ELEVENLABS_VOICE_ID')
  if (!elevenLabsApiKey || !elevenLabsVoiceId) {
    return json({ error: 'Configura ELEVENLABS_API_KEY y ELEVENLABS_VOICE_ID en Supabase para usar la voz de Enfoca.' }, 503)
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(elevenLabsVoiceId)}/stream`, {
      method: 'POST',
      headers: { Accept: 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': elevenLabsApiKey },
      body: JSON.stringify({
        text: text.trim(),
        model_id: Deno.env.get('ELEVENLABS_MODEL_ID') ?? 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
        voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
      }),
    })
    if (!response.ok || !response.body) {
      console.error('Error de ElevenLabs:', response.status, await response.text())
      return json({ error: 'No fue posible generar la voz de Enfoca.' }, 502)
    }
    return new Response(response.body, {
      headers: { ...cors, 'content-type': 'audio/mpeg', 'cache-control': 'no-store' },
    })
  } catch (error) {
    console.error('Error al consultar ElevenLabs:', error)
    return json({ error: 'No fue posible conectar con el servicio de voz.' }, 502)
  }
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req)
  const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cors, 'content-type': 'application/json; charset=utf-8' },
  })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // La ruta llega como /enfoca-api/api/chat; basta con mirar el final.
  const ruta = new URL(req.url).pathname.replace(/\/+$/, '')
  if (ruta.endsWith('/health')) return json({ ok: true, service: 'enfoca-backend' })
  if (req.method !== 'POST') return json({ error: 'Usa POST.' }, 405)
  if (ruta.endsWith('/chat')) return chat(req, json)
  if (ruta.endsWith('/transcribe')) return transcribe(req, json)
  if (ruta.endsWith('/speech')) return speech(req, cors, json)
  return json({ error: 'Ruta no encontrada.' }, 404)
})
