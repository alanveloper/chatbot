// shared.ts | Utilidades comunes de las Edge Functions de Enfoca.
//
// NOTA DE DESPLIEGUE: al desplegar con el CLI ("supabase functions deploy"),
// este archivo se resuelve desde ../_shared/shared.ts. Las versiones que ya
// estan corriendo en el proyecto se subieron con una copia hermana de este
// mismo archivo dentro de cada carpeta; el contenido es identico, solo cambia
// la ruta del import. Si cambias algo aqui, vuelve a desplegar las funciones.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export const cors: Record<string, string> = {
  'access-control-allow-origin': Deno.env.get('CORS_ORIGIN') ?? '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

export const MODELO_CHAT = Deno.env.get('MODEL_CHAT') ?? 'gpt-4o-mini'
export const MODELO_REPORTE = Deno.env.get('MODEL_REPORTE') ?? 'gpt-4o'
export const MODELO_EMBED = Deno.env.get('MODEL_EMBED') ?? 'text-embedding-3-small'
export const PROMPT_VERSION = 'enfoca-1.0.0'

// Se arma por partes para poder apuntar a un proxy o a Azure sin tocar codigo.
const BASE_OPENAI = Deno.env.get('OPENAI_BASE_URL') ?? ['https:/', 'api.openai.com', 'v1'].join('/')

export function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cors, 'content-type': 'application/json; charset=utf-8' },
  })
}

export function falla(mensaje: string, status = 400): Response {
  return json({ error: mensaje }, status)
}

export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: cors }) : null
}

export function clienteUsuario(req: Request): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

export function clienteAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

// El cliente de usuario respeta RLS: nadie ve el perfil de nadie mas.
export async function identificar(
  req: Request,
): Promise<{ personaId: string; supa: SupabaseClient } | null> {
  const supa = clienteUsuario(req)
  const { data, error } = await supa.auth.getUser()
  if (error || !data?.user) return null
  return { personaId: data.user.id, supa }
}

export async function openai(ruta: string, payload: unknown): Promise<any> {
  const llave = Deno.env.get('OPENAI_API_KEY')
  if (!llave) throw new Error('Falta el secreto OPENAI_API_KEY en Supabase.')
  const r = await fetch(BASE_OPENAI + '/' + ruta, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + llave, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const cuerpo = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${JSON.stringify(cuerpo ?? {}).slice(0, 400)}`)
  return cuerpo
}

export async function embeder(texto: string): Promise<number[]> {
  const r = await openai('embeddings', { model: MODELO_EMBED, input: texto.slice(0, 8000) })
  return r.data[0].embedding as number[]
}

// USD por millon de tokens [entrada, salida]. Ajusta si cambias de modelo.
const PRECIOS: Record<string, [number, number]> = {
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4o': [2.5, 10],
  'gpt-4.1-mini': [0.4, 1.6],
  'gpt-4.1': [2, 8],
  'text-embedding-3-small': [0.02, 0],
}

export function costo(modelo: string, entrada = 0, salida = 0): number {
  const p = PRECIOS[modelo] ?? [0, 0]
  return Number(((entrada / 1e6) * p[0] + (salida / 1e6) * p[1]).toFixed(6))
}

export async function registrar(
  admin: SupabaseClient,
  d: {
    persona_id: string | null
    funcion: string
    modelo?: string
    tokens_in?: number
    tokens_out?: number
    latencia_ms?: number
    ok: boolean
    error?: string
  },
): Promise<void> {
  await admin.from('llm_calls').insert({
    persona_id: d.persona_id,
    funcion: d.funcion,
    modelo: d.modelo ?? null,
    prompt_version: PROMPT_VERSION,
    tokens_in: d.tokens_in ?? null,
    tokens_out: d.tokens_out ?? null,
    costo_usd: d.modelo ? costo(d.modelo, d.tokens_in ?? 0, d.tokens_out ?? 0) : null,
    latencia_ms: d.latencia_ms ?? null,
    ok: d.ok,
    error: d.error ?? null,
  })
}

// Freno de mano: si el hackathon se desmadra, no se vacia la tarjeta.
export async function presupuestoAgotado(admin: SupabaseClient): Promise<boolean> {
  const tope = Number(Deno.env.get('LLM_GASTO_MAX_USD_DIA') ?? '5')
  if (!Number.isFinite(tope) || tope <= 0) return false
  const desde = new Date(Date.now() - 86400000).toISOString()
  const { data } = await admin.from('llm_calls').select('costo_usd').gte('created_at', desde)
  const gasto = (data ?? []).reduce(
    (s: number, r: { costo_usd: number | null }) => s + Number(r.costo_usd ?? 0),
    0,
  )
  return gasto >= tope
}

export function entero(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, Math.round(n)))
}

export const VALORES: readonly string[] = [
  'dinero', 'tiempo_libre', 'estabilidad', 'crecimiento', 'autonomia',
  'procesos', 'reconocimiento', 'impacto', 'equipo', 'flexibilidad',
]

export const DIMENSIONES: readonly string[] = [
  'estructura', 'comunicacion', 'interrupciones', 'interaccion_social',
  'entorno', 'sincronia', 'supervision', 'precision',
]

export const RASGOS: readonly string[] = [
  'apertura', 'responsabilidad', 'extraversion', 'amabilidad', 'estabilidad',
]

export const TIPOS_RIASEC: readonly string[] = [
  'realista', 'investigador', 'artistico', 'social', 'emprendedor', 'convencional',
]
