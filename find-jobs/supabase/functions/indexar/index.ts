// indexar | Rellena los embeddings de vacantes y empresas.
// Es tarea de mantenimiento: solo se llama con la service role key, nunca
// desde el navegador. Por eso verify_jwt va en false y la puerta la cuida
// esta funcion.
import { MODELO_EMBED, clienteAdmin, embeder, falla, json, preflight, registrar } from '../_shared/shared.ts'

function esServicio(req: Request): boolean {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return false
  const llave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (llave && token === llave) return true
  const partes = token.split('.')
  if (partes.length !== 3) return false
  try {
    const payload = JSON.parse(atob(partes[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload?.role === 'service_role'
  } catch {
    return false
  }
}

function textoVacante(v: any): string {
  const e = v.empresas ?? {}
  const habilidades = (v.vacante_skills ?? [])
    .map((s: any) => `${s.skills?.nombre ?? ''}${s.obligatoria ? ' (obligatoria)' : ''}`)
    .filter((s: string) => s.trim().length > 0)
  return [
    `Puesto: ${v.titulo}.`,
    v.area ? `Area: ${v.area}.` : '',
    v.seniority ? `Nivel: ${v.seniority}.` : '',
    e.nombre ? `Empresa: ${e.nombre}${e.sector ? ` (${e.sector})` : ''}.` : '',
    v.modalidad ? `Modalidad: ${v.modalidad}.` : '',
    v.pais ? `Pais: ${v.pais}.` : '',
    v.ingles_req ? `Ingles requerido: ${v.ingles_req}.` : '',
    v.horas_semana ? `Horas por semana: ${v.horas_semana}.` : '',
    v.sueldo_mxn_min ? `Sueldo desde ${v.sueldo_mxn_min} MXN.` : '',
    habilidades.length > 0 ? `Habilidades: ${habilidades.join(', ')}.` : '',
    v.descripcion ?? '',
  ].filter(Boolean).join(' ')
}

function textoEmpresa(e: any): string {
  const dims = (e.entorno_empresa ?? [])
    .map((d: any) => `${d.dimension} ${d.valor}`)
    .join(', ')
  return [
    `Empresa: ${e.nombre}.`,
    e.sector ? `Sector: ${e.sector}.` : '',
    e.tamano ? `Tamano: ${e.tamano}.` : '',
    e.pais ? `Pais: ${e.pais}.` : '',
    e.modalidad ? `Modalidad: ${e.modalidad}.` : '',
    e.descripcion ?? '',
    dims ? `Entorno de trabajo: ${dims}.` : '',
    e.entorno ? `Notas de entorno: ${JSON.stringify(e.entorno)}` : '',
  ].filter(Boolean).join(' ')
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return falla('Usa POST.', 405)
  if (!esServicio(req)) {
    return falla('Esta funcion solo se llama con la service role key desde el servidor.', 403)
  }

  const admin = clienteAdmin()
  const t0 = Date.now()
  const cuerpo = (await req.json().catch(() => ({}))) as {
    que?: string; limite?: number; reindexar?: boolean
  }
  const que = cuerpo.que ?? 'todo'
  const limite = Math.min(Math.max(Number(cuerpo.limite ?? 100) || 100, 1), 500)

  const resultado = { vacantes: 0, empresas: 0, errores: [] as string[] }

  if (que === 'todo' || que === 'vacantes') {
    let q = admin.from('vacantes')
      .select('id, titulo, area, seniority, pais, modalidad, ingles_req, horas_semana, sueldo_mxn_min, descripcion, empresas(nombre, sector), vacante_skills(obligatoria, skills(nombre))')
      .eq('activa', true).limit(limite)
    if (!cuerpo.reindexar) q = q.is('embedding', null)
    const { data, error } = await q
    if (error) return falla(`No pude leer vacantes: ${error.message}`, 500)
    for (const v of (data ?? []) as any[]) {
      try {
        const embedding = await embeder(textoVacante(v))
        const up = await admin.from('vacantes').update({ embedding }).eq('id', v.id)
        if (up.error) resultado.errores.push(`vacante ${v.id}: ${up.error.message}`)
        else resultado.vacantes++
      } catch (e) {
        resultado.errores.push(`vacante ${v.id}: ${e instanceof Error ? e.message : 'error'}`)
      }
    }
  }

  if (que === 'todo' || que === 'empresas') {
    let q = admin.from('empresas')
      .select('id, nombre, sector, tamano, pais, modalidad, descripcion, entorno, entorno_empresa(dimension, valor)')
      .limit(limite)
    if (!cuerpo.reindexar) q = q.is('embedding', null)
    const { data, error } = await q
    if (error) return falla(`No pude leer empresas: ${error.message}`, 500)
    for (const e of (data ?? []) as any[]) {
      try {
        const embedding = await embeder(textoEmpresa(e))
        const up = await admin.from('empresas').update({ embedding }).eq('id', e.id)
        if (up.error) resultado.errores.push(`empresa ${e.id}: ${up.error.message}`)
        else resultado.empresas++
      } catch (err) {
        resultado.errores.push(`empresa ${e.id}: ${err instanceof Error ? err.message : 'error'}`)
      }
    }
  }

  const [pendientesV, pendientesE] = await Promise.all([
    admin.from('vacantes').select('id', { count: 'exact', head: true }).is('embedding', null),
    admin.from('empresas').select('id', { count: 'exact', head: true }).is('embedding', null),
  ])

  await registrar(admin, {
    persona_id: null, funcion: 'indexar', modelo: MODELO_EMBED,
    latencia_ms: Date.now() - t0, ok: resultado.errores.length === 0,
    error: resultado.errores.slice(0, 3).join(' | ') || undefined,
  })

  return json({
    ...resultado,
    pendientes: { vacantes: pendientesV.count ?? 0, empresas: pendientesE.count ?? 0 },
    modelo: MODELO_EMBED,
  })
})
