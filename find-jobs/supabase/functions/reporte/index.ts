// reporte | Cierre de la sesion: Mapa Profesional en Markdown + JSON.
// El LLM solo escribe la narrativa. Las metricas se copian de la base de
// datos, asi el reporte nunca puede contradecir lo medido.
import {
  MODELO_REPORTE, PROMPT_VERSION, clienteAdmin, embeder, falla, identificar,
  json, openai, preflight, presupuestoAgotado, registrar,
} from '../_shared/shared.ts'

const textos = { type: 'array', items: { type: 'string' } }

const ESQUEMA = {
  type: 'object',
  properties: {
    resumen: { type: 'string', description: '3 a 5 oraciones, en segunda persona, con sus palabras.' },
    entorno_ideal: { type: 'string' },
    fortalezas: textos,
    dealbreakers: textos,
    areas_compatibles: textos,
    puestos_potenciales: textos,
    condiciones_ideales: textos,
    friccion: { ...textos, description: 'Entornos donde probablemente se desgastaria, sin juzgarla.' },
    siguientes_pasos: textos,
    hipotesis: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          texto: { type: 'string' },
          tipo: { type: 'string', enum: ['area', 'puesto', 'entorno', 'condicion'] },
          confianza: { type: 'number', description: '0 a 1.' },
        },
        required: ['texto', 'tipo', 'confianza'],
        additionalProperties: false,
      },
    },
    mapa_profesional_markdown: {
      type: 'string',
      description: 'Mapa Profesional completo en Markdown, con encabezados y listas.',
    },
  },
  required: [
    'resumen', 'entorno_ideal', 'fortalezas', 'dealbreakers', 'areas_compatibles',
    'puestos_potenciales', 'condiciones_ideales', 'friccion', 'siguientes_pasos',
    'hipotesis', 'mapa_profesional_markdown',
  ],
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

  const { data: perfil, error: ePerfil } = await supa.rpc('perfil_persona', { p_persona: personaId })
  if (ePerfil) return falla(`No pude leer tu perfil: ${ePerfil.message}`, 500)

  const hayBig = perfil?.big_five && Object.keys(perfil.big_five).length > 0
  const hayRiasec = perfil?.riasec && Object.keys(perfil.riasec).length > 0
  if (!hayBig && !hayRiasec) {
    return falla('Todavia no hay suficiente para tu reporte. Termina al menos las fases de personalidad e intereses.', 409)
  }

  const [cMensajes, cRetos] = await Promise.all([
    supa.from('mensajes').select('rol, contenido, fase')
      .eq('persona_id', personaId).in('rol', ['user', 'assistant'])
      .order('id', { ascending: false }).limit(150),
    supa.from('retos').select('area, puntaje, resultado').eq('persona_id', personaId),
  ])
  const transcripcion = ((cMensajes.data ?? []) as Array<{ rol: string; contenido: string }>)
    .reverse()
    .map((m) => `${m.rol === 'user' ? 'PERSONA' : 'ENFOCA'}: ${m.contenido}`)
    .join('\n')
    .slice(-14000)
  const retos = (cRetos.data ?? []) as Array<{ area: string; puntaje: number | null }>

  const completado = {
    personalidad: Boolean(hayBig),
    intereses: Boolean(hayRiasec),
    valores: Boolean(perfil?.valores && Object.keys(perfil.valores).length > 0),
    condiciones: Boolean(perfil?.condiciones && Object.keys(perfil.condiciones).length > 0),
    entrevista: (perfil?.fortalezas ?? []).length > 0,
    reto: retos.length > 0,
  }
  const faltan = Object.entries(completado).filter(([, v]) => !v).map(([k]) => k)

  const sistema = `Eres Enfoca, orientador vocacional. Escribes el cierre de una sesion de descubrimiento.
FILOSOFIA: conocer, medir, escuchar, entender que necesita, generar hipotesis y encontrar donde puede prosperar.
REGLAS DURAS:
- Espanol de Mexico, tuteo, calido y concreto. Cero relleno corporativo.
- NO eres clinico: nada de diagnosticos, etiquetas ni lenguaje patologizante. La friccion se describe como entorno que no le acomoda, nunca como defecto.
- NO inventes ni repitas numeros: las metricas las pone el sistema aparte. En tu texto no escribas porcentajes ni puntajes.
- NO nombres vacantes ni empresas concretas: eso lo calcula el motor de match.
- Usa lo que la persona dijo, citando sus palabras cuando ayude.
- Si algo no se midio, dilo con honestidad en siguientes_pasos.
El campo mapa_profesional_markdown debe ser un documento util con esta estructura:
# Tu Mapa Profesional
## Como funcionas mejor
## Tus fortalezas
## Lo que no negocias
## Areas y puestos con mas sentido para ti
## Condiciones ideales de trabajo
## Donde te desgastarias
## Hipotesis por validar
## Siguientes pasos`

  const usuario = `PERFIL MEDIDO (viene de la base de datos, es la verdad):
${JSON.stringify(perfil)}

FASES SIN MEDIR: ${faltan.length > 0 ? faltan.join(', ') : 'ninguna'}
RETOS COGNITIVOS: ${retos.length > 0 ? JSON.stringify(retos) : 'sin reto todavia'}

TRANSCRIPCION DE LA SESION (lo cualitativo sale de aqui):
${transcripcion || 'Sin conversacion registrada.'}`

  let narrativa: any
  let tokensIn = 0
  let tokensOut = 0
  try {
    const r = await openai('chat/completions', {
      model: MODELO_REPORTE,
      temperature: 0.5,
      max_tokens: 2600,
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: usuario },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'mapa_profesional', strict: true, schema: ESQUEMA },
      },
    })
    tokensIn = r?.usage?.prompt_tokens ?? 0
    tokensOut = r?.usage?.completion_tokens ?? 0
    narrativa = JSON.parse(r?.choices?.[0]?.message?.content ?? '{}')
  } catch (e) {
    const detalle = e instanceof Error ? e.message : 'error'
    await registrar(admin, {
      persona_id: personaId, funcion: 'reporte', modelo: MODELO_REPORTE,
      latencia_ms: Date.now() - t0, ok: false, error: detalle,
    })
    return falla('No pude generar tu reporte en este momento. Intenta de nuevo.', 502)
  }

  const mapaMd = String(narrativa.mapa_profesional_markdown ?? '').trim()
  const resumen = String(narrativa.resumen ?? '').trim()

  // Las metricas se copian de la base, no del LLM.
  const payload = {
    version_prompt: PROMPT_VERSION,
    generado_at: new Date().toISOString(),
    modelo: MODELO_REPORTE,
    estado_evaluacion: faltan.length === 0 ? 'completada' : 'parcial',
    fases_sin_medir: faltan,
    metricas: {
      big_five: perfil?.big_five ?? {},
      riasec: perfil?.riasec ?? {},
      codigo_riasec: perfil?.codigo_riasec ?? null,
      valores: perfil?.valores ?? {},
      condiciones: perfil?.condiciones ?? {},
      habilidades: perfil?.habilidades ?? [],
      filtros_duros: {
        ingles: perfil?.persona?.ingles ?? null,
        horas_semana: perfil?.persona?.horas_semana ?? null,
        sueldo_minimo_mxn: perfil?.persona?.sueldo_minimo_mxn ?? null,
      },
      retos,
    },
    cualitativo: {
      resumen,
      fortalezas: narrativa.fortalezas ?? [],
      dealbreakers: narrativa.dealbreakers ?? [],
      entorno_ideal: narrativa.entorno_ideal ?? '',
      friccion: narrativa.friccion ?? [],
    },
    recomendaciones: {
      areas_compatibles: narrativa.areas_compatibles ?? [],
      puestos_potenciales: narrativa.puestos_potenciales ?? [],
      condiciones_ideales: narrativa.condiciones_ideales ?? [],
      siguientes_pasos: narrativa.siguientes_pasos ?? [],
    },
    hipotesis: narrativa.hipotesis ?? [],
    // Compatibilidad con el contrato que ya esperaba el frontend del hackathon.
    candidato_vista_frontend: {
      resumen,
      mapa_profesional_markdown: mapaMd,
    },
    nota_metodologica:
      'Big Five y RIASEC son instrumentos de autorreporte con fines de orientacion. No son diagnosticos clinicos ni miden capacidad laboral. El match se calcula en SQL con pesos renormalizados sobre lo efectivamente medido.',
  }

  const { data: ultima } = await supa.from('reportes').select('version')
    .eq('persona_id', personaId).order('version', { ascending: false }).limit(1)
  const version = (((ultima ?? []) as Array<{ version: number }>)[0]?.version ?? 0) + 1

  const guardado = await supa.from('reportes').insert({
    persona_id: personaId, version, payload, mapa_md: mapaMd, resumen,
    modelo: MODELO_REPORTE, prompt_version: PROMPT_VERSION,
  }).select('id, version, created_at').single()
  if (guardado.error) return falla(`No pude guardar el reporte: ${guardado.error.message}`, 500)

  const hipotesis = (narrativa.hipotesis ?? [])
    .filter((h: any) => typeof h?.texto === 'string' && h.texto.trim().length > 3)
    .map((h: any) => ({
      persona_id: personaId,
      texto: h.texto.trim().slice(0, 1000),
      tipo: ['area', 'puesto', 'entorno', 'condicion'].includes(h?.tipo) ? h.tipo : 'area',
      confianza: Math.min(1, Math.max(0, Number(h?.confianza ?? 0.5))),
      evidencia: { origen: 'reporte', reporte_id: guardado.data.id, version },
    }))
  if (hipotesis.length > 0) await supa.from('hipotesis').insert(hipotesis)

  // Memoria semantica: el reporte se vuelve buscable por significado.
  try {
    const embedding = await embeder(`${resumen}\n\n${mapaMd}`)
    await supa.from('reportes').update({ embedding }).eq('id', guardado.data.id)
    await supa.from('llm_documents').insert({
      persona_id: personaId, sujeto_tipo: 'persona', sujeto_id: personaId,
      kind: 'reporte', payload, texto: `${resumen}\n\n${mapaMd}`.slice(0, 20000),
      embedding, modelo: MODELO_REPORTE,
    })
  } catch (e) {
    await registrar(admin, {
      persona_id: personaId, funcion: 'reporte/embed', ok: false,
      error: e instanceof Error ? e.message : 'error',
    })
  }

  await supa.from('personas').update({ etapa: 'reporte' }).eq('id', personaId)
  await registrar(admin, {
    persona_id: personaId, funcion: 'reporte', modelo: MODELO_REPORTE,
    tokens_in: tokensIn, tokens_out: tokensOut, latencia_ms: Date.now() - t0, ok: true,
  })

  return json({
    reporte_id: guardado.data.id,
    version,
    estado_evaluacion: payload.estado_evaluacion,
    fases_sin_medir: faltan,
    resumen,
    mapa_md: mapaMd,
    payload,
    siguiente_paso: 'Llama a la funcion match para ver tus vacantes afines.',
  })
})
