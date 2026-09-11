// reto | Fase 5. Genera un reto corto y lo califica con rubrica.
// El LLM propone puntos por criterio; la calificacion final la calcula el
// codigo con la rubrica guardada, para que sea reproducible y auditable.
import {
  MODELO_CHAT, clienteAdmin, entero, falla, identificar, json, openai,
  preflight, presupuestoAgotado, registrar,
} from '../_shared/shared.ts'

const AREAS: readonly string[] = ['verbal', 'analitico', 'espacial', 'logico']

// Si no nos dicen el area, la elegimos con el interes RIASEC mas alto.
const AREA_POR_INTERES: Record<string, string> = {
  investigador: 'analitico',
  convencional: 'logico',
  realista: 'espacial',
  artistico: 'espacial',
  social: 'verbal',
  emprendedor: 'verbal',
}

// Un reto aprobado sube la evidencia de las habilidades de ese terreno.
// Eso vale un bono de 1.15 en encaje_habilidades (ver migracion 0004).
const SLUGS_POR_AREA: Record<string, string[]> = {
  analitico: ['excel_avanzado', 'sql_basico', 'limpieza_datos', 'dashboards', 'qa_datos', 'facturacion'],
  verbal: ['redaccion_es', 'redaccion_en', 'soporte_chat', 'soporte_tickets', 'exito_cliente', 'copywriting', 'negociacion', 'sdr_prospeccion'],
  espacial: ['diseno_canva', 'edicion_video', 'contenido_redes'],
  logico: ['gestion_procesos', 'seguimiento_proyectos', 'notion_ops', 'automatizacion_nocode', 'prompting', 'qa_manual', 'crm_hubspot', 'agenda_correo'],
}

const ESQUEMA_GENERAR = {
  type: 'object',
  properties: {
    enunciado: { type: 'string', description: 'El reto completo, listo para mostrarse. Incluye el material necesario.' },
    criterios: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          clave: { type: 'string', description: 'identificador corto en snake_case' },
          titulo: { type: 'string' },
          peso: { type: 'number', description: 'Entre 0 y 1. La suma de pesos debe dar 1.' },
          nivel_0: { type: 'string' },
          nivel_2: { type: 'string' },
          nivel_4: { type: 'string' },
        },
        required: ['clave', 'titulo', 'peso', 'nivel_0', 'nivel_2', 'nivel_4'],
        additionalProperties: false,
      },
    },
  },
  required: ['enunciado', 'criterios'],
  additionalProperties: false,
}

const ESQUEMA_EVALUAR = {
  type: 'object',
  properties: {
    criterios: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          clave: { type: 'string' },
          puntos: { type: 'number', description: 'Entero de 0 a 4 segun la rubrica.' },
          comentario: { type: 'string' },
        },
        required: ['clave', 'puntos', 'comentario'],
        additionalProperties: false,
      },
    },
    lo_que_hiciste_bien: { type: 'string' },
    como_mejorar: { type: 'string' },
  },
  required: ['criterios', 'lo_que_hiciste_bien', 'como_mejorar'],
  additionalProperties: false,
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return falla('Usa POST.', 405)

  const ident = await identificar(req)
  if (!ident) return falla('Necesitas iniciar sesion.', 401)
  const { personaId, supa } = ident
  const admin = clienteAdmin()
  const t0 = Date.now()
  if (await presupuestoAgotado(admin)) {
    return falla('Se alcanzo el tope de gasto diario de IA. Intenta mas tarde.', 429)
  }

  const cuerpo = (await req.json().catch(() => ({}))) as {
    accion?: string; area?: string; reto_id?: string
    respuesta?: string; segundos?: number; sesion_id?: string
  }
  const accion = cuerpo.accion ?? 'generar'

  // ---------------- GENERAR ----------------
  if (accion === 'generar') {
    let area = AREAS.includes(String(cuerpo.area)) ? String(cuerpo.area) : ''
    if (!area) {
      const { data: riasec } = await supa.from('riasec').select('tipo, puntaje')
        .eq('persona_id', personaId).order('puntaje', { ascending: false }).limit(1)
      const top = ((riasec ?? []) as Array<{ tipo: string }>)[0]?.tipo
      area = (top && AREA_POR_INTERES[top]) || 'analitico'
    }

    let generado: any
    let tokensIn = 0
    let tokensOut = 0
    try {
      const r = await openai('chat/completions', {
        model: MODELO_CHAT,
        temperature: 0.8,
        max_tokens: 900,
        messages: [
          {
            role: 'system',
            content: `Eres Enfoca. Disenas UN reto breve de habilidad ${area} para una persona que busca trabajo en Mexico.
Reglas:
- Espanol de Mexico, tuteo. Se resuelve en 5 a 8 minutos.
- Debe ser autocontenido: si necesita datos, un texto o una tabla, inclúyelos en el enunciado.
- Situacion realista de trabajo, no acertijo de examen. Sin trampas ni doble sentido.
- No pidas datos personales ni herramientas externas.
- Entrega 3 o 4 criterios de evaluacion con pesos que sumen 1 y describe los niveles 0, 2 y 4.`,
          },
          { role: 'user', content: `Genera el reto de area ${area}.` },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'reto', strict: true, schema: ESQUEMA_GENERAR },
        },
      })
      tokensIn = r?.usage?.prompt_tokens ?? 0
      tokensOut = r?.usage?.completion_tokens ?? 0
      generado = JSON.parse(r?.choices?.[0]?.message?.content ?? '{}')
    } catch (e) {
      await registrar(admin, {
        persona_id: personaId, funcion: 'reto/generar', modelo: MODELO_CHAT,
        latencia_ms: Date.now() - t0, ok: false,
        error: e instanceof Error ? e.message : 'error',
      })
      return falla('No pude generar el reto. Intenta de nuevo.', 502)
    }

    const criterios = (generado.criterios ?? [])
      .filter((c: any) => typeof c?.clave === 'string')
      .map((c: any) => ({
        clave: String(c.clave).slice(0, 60),
        titulo: String(c.titulo ?? c.clave).slice(0, 160),
        peso: Math.min(1, Math.max(0.05, Number(c.peso) || 0.25)),
        niveles: { '0': c.nivel_0 ?? '', '2': c.nivel_2 ?? '', '4': c.nivel_4 ?? '' },
      }))
    if (criterios.length === 0) return falla('El reto salio sin rubrica. Intenta de nuevo.', 502)

    const rubrica = { escala: '0-4', aprueba_con: 2.5, criterios }
    const guardado = await supa.from('retos').insert({
      persona_id: personaId,
      sesion_id: cuerpo.sesion_id ?? null,
      area,
      enunciado: String(generado.enunciado ?? '').slice(0, 8000),
      rubrica,
      eventos: { generado_at: new Date().toISOString(), modelo: MODELO_CHAT },
    }).select('id, area, enunciado, created_at').single()
    if (guardado.error) return falla(`No pude guardar el reto: ${guardado.error.message}`, 500)

    await registrar(admin, {
      persona_id: personaId, funcion: 'reto/generar', modelo: MODELO_CHAT,
      tokens_in: tokensIn, tokens_out: tokensOut, latencia_ms: Date.now() - t0, ok: true,
    })

    return json({
      reto_id: guardado.data.id,
      area: guardado.data.area,
      enunciado: guardado.data.enunciado,
      // Se muestran los criterios, no los niveles: se evalua a ciegas.
      criterios: criterios.map((c: any) => ({ clave: c.clave, titulo: c.titulo, peso: c.peso })),
    })
  }

  // ---------------- EVALUAR ----------------
  if (accion === 'evaluar') {
    const respuesta = (cuerpo.respuesta ?? '').trim()
    if (!cuerpo.reto_id) return falla('Falta reto_id.')
    if (!respuesta) return falla('Falta tu respuesta al reto.')
    if (respuesta.length > 8000) return falla('La respuesta es muy larga (maximo 8000 caracteres).')

    const { data: reto } = await supa.from('retos')
      .select('id, area, enunciado, rubrica, puntaje')
      .eq('id', cuerpo.reto_id).maybeSingle()
    if (!reto) return falla('No encontre ese reto.', 404)
    if (reto.puntaje !== null) return falla('Ese reto ya fue calificado.', 409)

    const rubrica = (reto.rubrica ?? {}) as any
    const criterios = (rubrica.criterios ?? []) as Array<{ clave: string; titulo: string; peso: number; niveles: Record<string, string> }>

    let evaluado: any
    let tokensIn = 0
    let tokensOut = 0
    try {
      const r = await openai('chat/completions', {
        model: MODELO_CHAT,
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          {
            role: 'system',
            content: `Eres evaluador de Enfoca. Calificas con la rubrica dada, criterio por criterio, en escala 0, 1, 2, 3 o 4.
Reglas:
- Espanol de Mexico, tuteo. Retroalimentacion util y respetuosa, nunca descalificadora.
- Califica solo lo que se pidio. No penalices ortografia salvo que el criterio lo diga.
- No calcules el total ni porcentajes: el sistema lo hace.
- Devuelve un puntaje por cada clave de la rubrica, sin inventar claves nuevas.`,
          },
          {
            role: 'user',
            content: `AREA: ${reto.area}\n\nRETO:\n${reto.enunciado}\n\nRUBRICA:\n${JSON.stringify(criterios)}\n\nRESPUESTA DE LA PERSONA:\n${respuesta}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'evaluacion', strict: true, schema: ESQUEMA_EVALUAR },
        },
      })
      tokensIn = r?.usage?.prompt_tokens ?? 0
      tokensOut = r?.usage?.completion_tokens ?? 0
      evaluado = JSON.parse(r?.choices?.[0]?.message?.content ?? '{}')
    } catch (e) {
      await registrar(admin, {
        persona_id: personaId, funcion: 'reto/evaluar', modelo: MODELO_CHAT,
        latencia_ms: Date.now() - t0, ok: false,
        error: e instanceof Error ? e.message : 'error',
      })
      return falla('No pude calificar el reto. Intenta de nuevo.', 502)
    }

    // Aqui calcula el codigo, no el modelo.
    const porClave = new Map<string, { puntos: number; comentario: string }>()
    for (const c of evaluado.criterios ?? []) {
      const puntos = entero(c?.puntos, 0, 4)
      if (typeof c?.clave !== 'string' || puntos === null) continue
      porClave.set(c.clave, { puntos, comentario: String(c.comentario ?? '').slice(0, 800) })
    }
    let sumaPesos = 0
    let sumaPuntos = 0
    const detalle = criterios.map((c) => {
      const v = porClave.get(c.clave)
      const puntos = v?.puntos ?? 0
      sumaPesos += c.peso
      sumaPuntos += puntos * c.peso
      return { clave: c.clave, titulo: c.titulo, peso: c.peso, puntos, comentario: v?.comentario ?? '' }
    })
    const promedio = sumaPesos > 0 ? sumaPuntos / sumaPesos : 0
    const puntaje = Math.round((promedio / 4) * 100)
    const aprueba = promedio >= Number(rubrica.aprueba_con ?? 2.5)

    const resultado = {
      promedio_0_4: Number(promedio.toFixed(2)),
      puntaje_0_100: puntaje,
      aprueba,
      criterios: detalle,
      lo_que_hiciste_bien: String(evaluado.lo_que_hiciste_bien ?? ''),
      como_mejorar: String(evaluado.como_mejorar ?? ''),
    }

    await supa.from('retos').update({
      respuesta,
      puntaje,
      resultado: aprueba ? 'aprobado' : 'no_aprobado',
      segundos: entero(cuerpo.segundos, 0, 86400),
      eventos: { calificado_at: new Date().toISOString(), modelo: MODELO_CHAT, detalle: resultado },
    }).eq('id', reto.id)

    // Bono de evidencia: solo sobre habilidades que la persona ya declaro.
    let habilidadesConEvidencia = 0
    if (aprueba) {
      const slugs = SLUGS_POR_AREA[String(reto.area)] ?? []
      if (slugs.length > 0) {
        const { data: ids } = await supa.from('skills').select('id').in('slug', slugs)
        const lista = ((ids ?? []) as Array<{ id: string }>).map((s) => s.id)
        if (lista.length > 0) {
          const sub = await supa.from('persona_skills')
            .update({ evidencia: 'reto_enfoca', evidencia_nota: `Validada con reto ${reto.area} de Enfoca.` })
            .eq('persona_id', personaId).eq('evidencia', 'declarada')
            .in('skill_id', lista).select('skill_id')
          habilidadesConEvidencia = (sub.data ?? []).length
        }
      }
    }

    await registrar(admin, {
      persona_id: personaId, funcion: 'reto/evaluar', modelo: MODELO_CHAT,
      tokens_in: tokensIn, tokens_out: tokensOut, latencia_ms: Date.now() - t0, ok: true,
    })

    return json({
      reto_id: reto.id,
      area: reto.area,
      ...resultado,
      habilidades_con_evidencia: habilidadesConEvidencia,
      nota: 'Un reto no define tu capacidad: es una senal mas dentro de tu perfil.',
    })
  }

  return falla("La accion debe ser 'generar' o 'evaluar'.")
})
