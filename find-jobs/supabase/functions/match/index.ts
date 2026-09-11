// match | Convierte el perfil en un vector, deja que SQL calcule el score y
// guarda el resultado. El LLM solo redacta el porque; nunca el cuanto.
import {
  MODELO_CHAT, clienteAdmin, embeder, falla, identificar, json, openai,
  preflight, presupuestoAgotado, registrar,
} from '../_shared/shared.ts'

function textoPerfil(p: any): string {
  const partes: string[] = []
  const persona = p?.persona ?? {}
  if (persona.ciudad) partes.push(`Vive en ${persona.ciudad}.`)
  if (p?.codigo_riasec) partes.push(`Codigo de intereses RIASEC: ${p.codigo_riasec}.`)
  if (p?.riasec) {
    partes.push('Intereses vocacionales: ' + Object.entries(p.riasec)
      .sort((a: any, b: any) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`).join(', ') + '.')
  }
  if (p?.big_five) {
    partes.push('Personalidad: ' + Object.entries(p.big_five)
      .map(([k, v]: [string, any]) => `${k} ${v?.puntaje}`).join(', ') + '.')
  }
  if (p?.valores) {
    partes.push('Valores que prioriza: ' + Object.entries(p.valores)
      .sort((a: any, b: any) => b[1] - a[1]).slice(0, 5)
      .map(([k, v]) => `${k} ${v}`).join(', ') + '.')
  }
  if (p?.condiciones) {
    partes.push('Condiciones de trabajo que necesita: ' + Object.entries(p.condiciones)
      .map(([k, v]: [string, any]) => `${k} ${v?.valor}${v?.indispensable ? ' (indispensable)' : ''}`)
      .join(', ') + '.')
  }
  if (Array.isArray(p?.habilidades) && p.habilidades.length > 0) {
    partes.push('Habilidades: ' + p.habilidades
      .map((h: any) => `${h.nombre} nivel ${h.nivel}`).join(', ') + '.')
  }
  if (Array.isArray(p?.fortalezas) && p.fortalezas.length > 0) {
    partes.push('Fortalezas: ' + p.fortalezas.map((f: any) => f.titulo).join('; ') + '.')
  }
  if (Array.isArray(p?.dealbreakers) && p.dealbreakers.length > 0) {
    partes.push('No tolera: ' + p.dealbreakers.join('; ') + '.')
  }
  return partes.join(' ') || 'Perfil todavia sin datos suficientes.'
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

  const cuerpo = (await req.json().catch(() => ({}))) as {
    limite?: number; explicar?: boolean; incluir_descartadas?: boolean
  }
  const limite = Math.min(Math.max(Number(cuerpo.limite ?? 10) || 10, 1), 25)
  const explicar = cuerpo.explicar !== false

  const { data: perfil, error: ePerfil } = await supa.rpc('perfil_persona', { p_persona: personaId })
  if (ePerfil) return falla(`No pude leer tu perfil: ${ePerfil.message}`, 500)

  const texto = textoPerfil(perfil)

  // La parte semantica es opcional: si falla el embedding, el score se
  // renormaliza solo con los componentes medidos.
  let embedding: number[] | null = null
  const sinPresupuesto = await presupuestoAgotado(admin)
  if (!sinPresupuesto) {
    try {
      embedding = await embeder(texto)
    } catch (e) {
      await registrar(admin, {
        persona_id: personaId, funcion: 'match/embed',
        ok: false, error: e instanceof Error ? e.message : 'error',
      })
    }
  }

  const parametros = {
    p_persona: personaId,
    p_limit: limite,
    p_incluir_descartadas: cuerpo.incluir_descartadas === true,
  }
  let filas: any[] = []
  let r = await supa.rpc('buscar_vacantes', { ...parametros, p_embedding: embedding })
  if (r.error && embedding) {
    // Algunas versiones de PostgREST quieren el vector como texto '[...]'.
    r = await supa.rpc('buscar_vacantes', { ...parametros, p_embedding: JSON.stringify(embedding) })
  }
  if (r.error) return falla(`No pude calcular el match: ${r.error.message}`, 500)
  filas = (r.data ?? []) as any[]

  if (filas.length > 0) {
    const guardables = filas.map((v) => ({
      persona_id: personaId,
      vacante_id: v.vacante_id,
      score: v.score ?? 0,
      desglose: v.desglose ?? {},
      descartada_por: v.descartada_por ?? null,
      calculado_at: new Date().toISOString(),
    }))
    await supa.from('matches').upsert(guardables, { onConflict: 'persona_id,vacante_id' })
  }

  // Explicacion en lenguaje humano de las 3 mejores, sin inventar numeros.
  let tokensIn = 0
  let tokensOut = 0
  if (explicar && filas.length > 0 && !sinPresupuesto) {
    const top = filas.slice(0, 3)
    try {
      const r2 = await openai('chat/completions', {
        model: MODELO_CHAT,
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `Eres Enfoca. Explicas por que un puesto le queda a una persona.
Reglas: espanol de Mexico, tuteo, maximo 2 oraciones por vacante.
Usa el desglose que te doy (cada componente va de 0 a 1) para decir QUE empata y QUE no.
Nunca inventes porcentajes: el score ya esta calculado. Nunca digas que la persona es buena o mala.
Si un componente esta en \"faltantes\", puedes sugerir que completar para afinar el match.`,
          },
          {
            role: 'user',
            content: `Perfil: ${texto}\n\nVacantes:\n${JSON.stringify(
              top.map((v) => ({
                vacante_id: v.vacante_id, titulo: v.titulo, empresa: v.empresa,
                modalidad: v.modalidad, score: v.score, desglose: v.desglose,
              })),
            )}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'explicaciones',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                explicaciones: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      vacante_id: { type: 'string' },
                      explicacion: { type: 'string' },
                    },
                    required: ['vacante_id', 'explicacion'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['explicaciones'],
              additionalProperties: false,
            },
          },
        },
      })
      tokensIn = r2?.usage?.prompt_tokens ?? 0
      tokensOut = r2?.usage?.completion_tokens ?? 0
      const salida = JSON.parse(r2?.choices?.[0]?.message?.content ?? '{}')
      for (const e of salida.explicaciones ?? []) {
        const fila = filas.find((v) => v.vacante_id === e.vacante_id)
        if (!fila) continue
        fila.explicacion = e.explicacion
        await supa.from('matches').update({ explicacion: e.explicacion })
          .eq('persona_id', personaId).eq('vacante_id', e.vacante_id)
      }
    } catch (e) {
      await registrar(admin, {
        persona_id: personaId, funcion: 'match/explicar', modelo: MODELO_CHAT,
        ok: false, error: e instanceof Error ? e.message : 'error',
      })
    }
  }

  await registrar(admin, {
    persona_id: personaId, funcion: 'match', modelo: MODELO_CHAT,
    tokens_in: tokensIn, tokens_out: tokensOut,
    latencia_ms: Date.now() - t0, ok: true,
  })

  const primera = filas[0]?.desglose ?? {}
  return json({
    vacantes: filas,
    perfil_usado: texto,
    semantica: embedding !== null,
    cobertura: primera?.cobertura ?? 0,
    faltantes: primera?.faltantes ?? [],
    nota: 'El score se renormaliza sobre lo ya medido. Completa mas fases para afinarlo.',
  })
})
