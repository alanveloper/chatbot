// chat-orientador | Reemplaza al POST /api/chat de Express.
// Diferencia clave: aqui la conversacion se persiste y el LLM escribe en la
// base de datos con herramientas validadas. Nada de localStorage.
import {
  DIMENSIONES, MODELO_CHAT, PROMPT_VERSION, VALORES,
  clienteAdmin, entero, falla, identificar, json, openai, preflight,
  presupuestoAgotado, registrar,
} from '../_shared/shared.ts'
import {
  BIG_FIVE_MAPA, ETAPA_POR_FASE, HERRAMIENTAS, ORDEN_FASES, PROMPT_BASE,
  RIASEC_MAPA, VALORES_PARES, guiaFase, type Fase,
} from './prompt.ts'

type Resultado = { ok: boolean; detalle: string; aplicado?: unknown; rechazado?: unknown }

Deno.serve(async (req: Request) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return falla('Usa POST.', 405)

  const ident = await identificar(req)
  if (!ident) return falla('Necesitas iniciar sesion para usar Enfoca.', 401)
  const { personaId, supa } = ident
  const admin = clienteAdmin()
  const t0 = Date.now()

  const cuerpo = (await req.json().catch(() => ({}))) as {
    mensaje?: string; sesion_id?: string; nueva?: boolean
  }
  const mensaje = (cuerpo.mensaje ?? '').trim()
  if (!mensaje) return falla('El campo mensaje es obligatorio.')
  if (mensaje.length > 4000) return falla('El mensaje es muy largo (maximo 4000 caracteres).')
  if (await presupuestoAgotado(admin)) {
    return falla('Se alcanzo el tope de gasto diario de IA. Intenta mas tarde.', 429)
  }

  // ---- persona (el trigger la crea al registrarse; esto es el cinturon) ----
  const campos = 'id, nombre, ciudad, etapa, situacion_actual, ingles, horas_semana, sueldo_minimo_mxn'
  let { data: persona } = await supa.from('personas').select(campos).eq('id', personaId).maybeSingle()
  if (!persona) {
    const creada = await supa.from('personas')
      .insert({ id: personaId, prompt_version: PROMPT_VERSION }).select(campos).single()
    if (creada.error) return falla(`No pude crear tu perfil: ${creada.error.message}`, 500)
    persona = creada.data
  }

  // ---- sesion abierta ----
  let sesion: { id: string; fase: Fase } | null = null
  if (cuerpo.sesion_id) {
    const { data } = await supa.from('sesiones').select('id, fase').eq('id', cuerpo.sesion_id).maybeSingle()
    if (data) sesion = data as { id: string; fase: Fase }
  }
  if (!sesion && !cuerpo.nueva) {
    const { data } = await supa.from('sesiones').select('id, fase')
      .eq('persona_id', personaId).eq('cerrada', false)
      .order('iniciada_at', { ascending: false }).limit(1)
    if (data && data.length > 0) sesion = data[0] as { id: string; fase: Fase }
  }
  if (!sesion) {
    const creada = await supa.from('sesiones').insert({
      persona_id: personaId, fase: 'f0_conexion',
      modelo: MODELO_CHAT, prompt_version: PROMPT_VERSION,
    }).select('id, fase').single()
    if (creada.error) return falla(`No pude abrir la sesion: ${creada.error.message}`, 500)
    sesion = creada.data as { id: string; fase: Fase }
  }
  const sesionId = sesion.id
  let fase: Fase = sesion.fase

  // ---- contexto: catalogos + lo ya medido ----
  const [cSkills, cDims, cPerfil] = await Promise.all([
    supa.from('skills').select('id, slug, nombre, familia'),
    supa.from('dimensiones_ref').select('dimension, titulo, polo_menos, polo_mas').order('orden'),
    supa.rpc('perfil_persona', { p_persona: personaId }),
  ])
  const skills = (cSkills.data ?? []) as Array<{ id: string; slug: string; nombre: string; familia: string }>
  const dims = (cDims.data ?? []) as Array<{ dimension: string; titulo: string; polo_menos: string; polo_mas: string }>
  const perfil = cPerfil.data as any
  const idPorSlug = new Map(skills.map((s) => [s.slug, s.id]))

  const { data: historial } = await supa.from('mensajes')
    .select('rol, contenido').eq('sesion_id', sesionId)
    .in('rol', ['user', 'assistant'])
    .order('id', { ascending: false }).limit(24)
  const previos = ((historial ?? []) as Array<{ rol: string; contenido: string }>).reverse()

  await supa.from('mensajes').insert({
    sesion_id: sesionId, persona_id: personaId, rol: 'user', fase, contenido: mensaje, meta: {},
  })

  // ---- herramientas: validar en el servidor, siempre ----
  const aplicadas: string[] = []

  async function auditar(herramienta: string, entrada: unknown, r: Resultado) {
    await admin.from('audit_llm_writes').insert({
      persona_id: personaId, funcion: 'chat-orientador', herramienta,
      entrada: entrada ?? {}, aplicado: r.aplicado ?? null, rechazado: r.rechazado ?? null,
    })
  }

  async function guardarRespuestas(f: Fase, crudas: Record<string, unknown>) {
    const filas = Object.entries(crudas).map(([reactivo, respuesta]) => ({
      persona_id: personaId, sesion_id: sesionId, fase: f,
      reactivo, respuesta: { valor: respuesta },
    }))
    if (filas.length > 0) {
      await supa.from('respuestas').upsert(filas, { onConflict: 'persona_id,fase,reactivo' })
    }
  }

  async function ejecutar(nombre: string, args: Record<string, any>): Promise<Resultado> {
    try {
      if (nombre === 'guardar_perfil') {
        const parche: Record<string, unknown> = {}
        for (const k of ['nombre', 'ciudad', 'situacion_actual', 'descripcion_personal']) {
          if (typeof args[k] === 'string' && args[k].trim()) parche[k] = args[k].trim().slice(0, 2000)
        }
        if (typeof args.ingles === 'string' && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(args.ingles)) {
          parche.ingles = args.ingles
        }
        const horas = entero(args.horas_semana, 1, 80)
        if (horas !== null) parche.horas_semana = horas
        const sueldo = entero(args.sueldo_minimo_mxn, 0, 500000)
        if (sueldo !== null) parche.sueldo_minimo_mxn = sueldo
        if (Object.keys(parche).length === 0) return { ok: false, detalle: 'No mandaste ningun campo valido.' }
        const { error } = await supa.from('personas').update(parche).eq('id', personaId)
        if (error) return { ok: false, detalle: error.message }
        return { ok: true, detalle: `Perfil actualizado: ${Object.keys(parche).join(', ')}.`, aplicado: parche }
      }

      if (nombre === 'guardar_big_five' || nombre === 'guardar_riasec') {
        const esBig = nombre === 'guardar_big_five'
        const crudas = (args.respuestas ?? {}) as Record<string, unknown>
        const acumulado = new Map<string, number[]>()
        const rechazado: string[] = []
        for (const [reactivo, valor] of Object.entries(crudas)) {
          const v = entero(valor, 1, 5)
          const mapa = esBig ? BIG_FIVE_MAPA[reactivo] : RIASEC_MAPA[reactivo]
          if (!mapa || v === null) { rechazado.push(reactivo); continue }
          const clave = esBig ? (mapa as [string, boolean])[0] : (mapa as string)
          const invertido = esBig ? (mapa as [string, boolean])[1] : false
          const lista = acumulado.get(clave) ?? []
          lista.push(invertido ? 6 - v : v)
          acumulado.set(clave, lista)
        }
        if (acumulado.size === 0) {
          return {
            ok: false,
            detalle: 'Ninguna respuesta fue valida. Usa numeros de reactivo \"1\" a \"10\" y valores de 1 a 5.',
            rechazado,
          }
        }
        const ahora = new Date().toISOString()
        const filas = [...acumulado.entries()].map(([clave, vals]) => {
          const prom = vals.reduce((a, b) => a + b, 0) / vals.length
          const puntaje = Math.round(((prom - 1) / 4) * 100)
          return esBig
            ? {
                persona_id: personaId, rasgo: clave, puntaje,
                confianza: Math.max(1, Math.min(5, vals.length * 2)),
                reactivos: { crudas, usados: vals.length },
                actualizado_at: ahora,
              }
            : { persona_id: personaId, tipo: clave, puntaje }
        })
        const { error } = await supa.from(esBig ? 'big_five' : 'riasec')
          .upsert(filas, { onConflict: esBig ? 'persona_id,rasgo' : 'persona_id,tipo' })
        if (error) return { ok: false, detalle: error.message }
        await guardarRespuestas(esBig ? 'f1_big_five' : 'f2_riasec', crudas)
        return {
          ok: true,
          detalle: `Guardado. El sistema calculo ${filas.length} puntajes de 0 a 100.`,
          aplicado: filas,
          rechazado: rechazado.length > 0 ? rechazado : null,
        }
      }

      if (nombre === 'guardar_valores') {
        const elecciones = Array.isArray(args.elecciones) ? args.elecciones : []
        const conteo = new Map<string, { elegido: number; visto: number }>()
        const filasElec: Record<string, unknown>[] = []
        const rechazado: unknown[] = []
        for (const e of elecciones) {
          const par = VALORES_PARES[String(e?.par)]
          const lado = String(e?.elegido ?? '').toUpperCase()
          if (!par || (lado !== 'A' && lado !== 'B')) { rechazado.push(e?.par); continue }
          const elegido = lado === 'A' ? par[0] : par[1]
          const descartado = lado === 'A' ? par[1] : par[0]
          filasElec.push({ persona_id: personaId, par: String(e.par), elegido, descartado })
          for (const v of par) {
            const c = conteo.get(v) ?? { elegido: 0, visto: 0 }
            c.visto += 1
            if (v === elegido) c.elegido += 1
            conteo.set(v, c)
          }
        }
        if (filasElec.length === 0) {
          return { ok: false, detalle: 'No hubo elecciones validas. Manda par \"1\" a \"10\" y elegido A o B.', rechazado }
        }
        const filasPeso = [...conteo.entries()]
          .filter(([v]) => VALORES.includes(v))
          .map(([valor, c]) => ({
            persona_id: personaId, valor,
            peso: Math.round((c.elegido / Math.max(c.visto, 1)) * 100),
          }))
        const a = await supa.from('elecciones_valores').insert(filasElec)
        if (a.error) return { ok: false, detalle: a.error.message }
        const b = await supa.from('valores_persona').upsert(filasPeso, { onConflict: 'persona_id,valor' })
        if (b.error) return { ok: false, detalle: b.error.message }
        return {
          ok: true,
          detalle: `Guardadas ${filasElec.length} elecciones y ${filasPeso.length} pesos de valores.`,
          aplicado: filasPeso,
        }
      }

      if (nombre === 'guardar_condiciones') {
        const items = Array.isArray(args.items) ? args.items : []
        const filas: Record<string, unknown>[] = []
        const rechazado: unknown[] = []
        for (const it of items) {
          const valor = entero(it?.valor, -2, 2)
          if (!DIMENSIONES.includes(String(it?.dimension)) || valor === null) { rechazado.push(it); continue }
          filas.push({
            persona_id: personaId, dimension: it.dimension, valor,
            indispensable: it?.indispensable === true,
            nota: typeof it?.nota === 'string' ? it.nota.slice(0, 500) : null,
          })
        }
        if (filas.length === 0) {
          return { ok: false, detalle: `Dimensiones validas: ${DIMENSIONES.join(', ')}. El valor va de -2 a 2.`, rechazado }
        }
        const { error } = await supa.from('condiciones_persona')
          .upsert(filas, { onConflict: 'persona_id,dimension' })
        if (error) return { ok: false, detalle: error.message }
        return {
          ok: true, detalle: `Guardadas ${filas.length} condiciones.`,
          aplicado: filas, rechazado: rechazado.length > 0 ? rechazado : null,
        }
      }

      if (nombre === 'guardar_dealbreakers') {
        const items = Array.isArray(args.items) ? args.items : []
        const { data: previosDb } = await supa.from('dealbreakers').select('texto').eq('persona_id', personaId)
        const ya = new Set(((previosDb ?? []) as Array<{ texto: string }>).map((d) => d.texto.toLowerCase()))
        const filas = items
          .filter((it: any) => typeof it?.texto === 'string' && it.texto.trim().length > 2)
          .map((it: any) => ({
            persona_id: personaId, texto: it.texto.trim().slice(0, 500),
            dimension: DIMENSIONES.includes(String(it?.dimension)) ? it.dimension : null,
          }))
          .filter((f: { texto: string }) => !ya.has(f.texto.toLowerCase()))
        if (filas.length === 0) return { ok: true, detalle: 'Sin dealbreakers nuevos que guardar.' }
        const { error } = await supa.from('dealbreakers').insert(filas)
        if (error) return { ok: false, detalle: error.message }
        return { ok: true, detalle: `Guardados ${filas.length} dealbreakers.`, aplicado: filas }
      }

      if (nombre === 'guardar_habilidades') {
        const items = Array.isArray(args.items) ? args.items : []
        const filas: Record<string, unknown>[] = []
        const rechazado: string[] = []
        for (const it of items) {
          const skillId = idPorSlug.get(String(it?.slug))
          const nivel = entero(it?.nivel, 1, 5)
          if (!skillId || nivel === null) { rechazado.push(String(it?.slug)); continue }
          filas.push({
            persona_id: personaId, skill_id: skillId, nivel,
            evidencia: 'declarada',
            evidencia_nota: typeof it?.nota === 'string' ? it.nota.slice(0, 500) : null,
          })
        }
        if (filas.length === 0) {
          return {
            ok: false,
            detalle: `Ningun slug era valido. Catalogo: ${[...idPorSlug.keys()].join(', ')}.`,
            rechazado,
          }
        }
        const { error } = await supa.from('persona_skills')
          .upsert(filas, { onConflict: 'persona_id,skill_id' })
        if (error) return { ok: false, detalle: error.message }
        return {
          ok: true, detalle: `Guardadas ${filas.length} habilidades.`,
          aplicado: filas, rechazado: rechazado.length > 0 ? rechazado : null,
        }
      }

      if (nombre === 'guardar_fortalezas') {
        const items = Array.isArray(args.items) ? args.items : []
        const { data: previasDb } = await supa.from('fortalezas').select('titulo').eq('persona_id', personaId)
        const ya = new Set(((previasDb ?? []) as Array<{ titulo: string }>).map((f) => f.titulo.toLowerCase()))
        const filas = items
          .filter((it: any) => typeof it?.titulo === 'string' && it.titulo.trim().length > 2)
          .map((it: any) => ({
            persona_id: personaId, titulo: it.titulo.trim().slice(0, 200),
            evidencia: typeof it?.evidencia === 'string' ? it.evidencia.slice(0, 1000) : null,
            confianza: entero(it?.confianza, 1, 5) ?? 3,
          }))
          .filter((f: { titulo: string }) => !ya.has(f.titulo.toLowerCase()))
        if (filas.length === 0) return { ok: true, detalle: 'Sin fortalezas nuevas que guardar.' }
        const { error } = await supa.from('fortalezas').insert(filas)
        if (error) return { ok: false, detalle: error.message }
        return { ok: true, detalle: `Guardadas ${filas.length} fortalezas.`, aplicado: filas }
      }

      if (nombre === 'avanzar_fase') {
        const destino = String(args?.fase) as Fase
        if (!ORDEN_FASES.includes(destino)) {
          return { ok: false, detalle: `Fases validas: ${ORDEN_FASES.join(', ')}.` }
        }
        if (ORDEN_FASES.indexOf(destino) < ORDEN_FASES.indexOf(fase)) {
          return { ok: false, detalle: 'No se puede regresar de fase. Sigue con la actual.' }
        }
        fase = destino
        await supa.from('sesiones').update({ fase: destino }).eq('id', sesionId)
        await supa.from('personas').update({ etapa: ETAPA_POR_FASE[destino] }).eq('id', personaId)
        return { ok: true, detalle: `Fase actual: ${destino}.`, aplicado: { fase: destino } }
      }

      return { ok: false, detalle: `Herramienta desconocida: ${nombre}.` }
    } catch (e) {
      return { ok: false, detalle: e instanceof Error ? e.message : 'Error inesperado.' }
    }
  }

  // ---- prompt ----
  const medido = {
    big_five: perfil?.big_five ?? null,
    riasec: perfil?.riasec ?? null,
    valores: perfil?.valores ?? null,
    condiciones: perfil?.condiciones ?? null,
    habilidades: (perfil?.habilidades ?? []).length,
    fortalezas: (perfil?.fortalezas ?? []).length,
  }
  const sistema = [
    PROMPT_BASE,
    guiaFase(fase),
    '# DICCIONARIO DE DIMENSIONES (escala -2 a 2)\n' + dims
      .map((d) => `- ${d.dimension} (${d.titulo}): -2 = ${d.polo_menos} | +2 = ${d.polo_mas}`).join('\n'),
    '# CATALOGO DE HABILIDADES (usa el slug exacto)\n' + skills
      .map((s) => `- ${s.slug}: ${s.nombre} (${s.familia})`).join('\n'),
    '# LO QUE YA MEDIMOS DE ESTA PERSONA\n' + JSON.stringify(medido) +
      '\nNo repitas fases ya medidas. Si algo ya esta, confirmalo en una linea y sigue.',
    '# DATOS DE LA PERSONA\n' + JSON.stringify(persona),
  ].join('\n\n')

  const mensajes: any[] = [
    { role: 'system', content: sistema },
    ...previos.map((m) => ({ role: m.rol, content: m.contenido })),
    { role: 'user', content: mensaje },
  ]

  let contenido = ''
  let tokensIn = 0
  let tokensOut = 0
  try {
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      const r = await openai('chat/completions', {
        model: MODELO_CHAT,
        messages: mensajes,
        tools: HERRAMIENTAS,
        tool_choice: 'auto',
        temperature: 0.6,
        max_tokens: 900,
      })
      tokensIn += r?.usage?.prompt_tokens ?? 0
      tokensOut += r?.usage?.completion_tokens ?? 0
      const m = r?.choices?.[0]?.message
      if (!m) break
      mensajes.push(m)
      const llamadas = m.tool_calls ?? []
      if (llamadas.length === 0) { contenido = m.content ?? ''; break }
      for (const lc of llamadas) {
        let args: Record<string, any> = {}
        try { args = JSON.parse(lc.function?.arguments || '{}') } catch { args = {} }
        const nombre = lc.function?.name ?? ''
        const res = await ejecutar(nombre, args)
        if (res.ok) aplicadas.push(nombre)
        await auditar(nombre, args, res)
        mensajes.push({ role: 'tool', tool_call_id: lc.id, content: JSON.stringify(res) })
      }
    }
  } catch (e) {
    const detalle = e instanceof Error ? e.message : 'Error desconocido'
    await registrar(admin, {
      persona_id: personaId, funcion: 'chat-orientador', modelo: MODELO_CHAT,
      tokens_in: tokensIn, tokens_out: tokensOut, latencia_ms: Date.now() - t0,
      ok: false, error: detalle,
    })
    return falla('No pude responder en este momento. Tu avance quedo guardado, vuelve a intentar.', 502)
  }

  if (!contenido) contenido = 'Se me fue la idea un segundo. Me lo repites?'

  await supa.from('mensajes').insert({
    sesion_id: sesionId, persona_id: personaId, rol: 'assistant', fase,
    contenido, meta: { herramientas: aplicadas, modelo: MODELO_CHAT },
  })
  await supa.from('sesiones').update({
    progreso: { fase, herramientas: aplicadas, actualizado: new Date().toISOString() },
  }).eq('id', sesionId)
  await registrar(admin, {
    persona_id: personaId, funcion: 'chat-orientador', modelo: MODELO_CHAT,
    tokens_in: tokensIn, tokens_out: tokensOut, latencia_ms: Date.now() - t0, ok: true,
  })

  return json({
    sesion_id: sesionId,
    fase,
    etapa: ETAPA_POR_FASE[fase],
    respuesta: contenido,
    guardado: aplicadas,
  })
})
