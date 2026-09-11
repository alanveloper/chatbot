// privacidad | Derechos ARCO en una funcion: exportar todo y borrar todo.
// La LFPDPPP no es opcional y en un hackathon con datos de personas reales
// esto es lo minimo. Se registra el evento antes de borrar.
import { clienteAdmin, falla, identificar, json, preflight } from '../_shared/shared.ts'

// Sin columnas de embedding: son vectores enormes y no le sirven a nadie.
const TABLAS: Array<[string, string]> = [
  ['personas', '*'],
  ['consentimientos', '*'],
  ['sesiones', '*'],
  ['mensajes', 'rol, contenido, fase, created_at'],
  ['respuestas', '*'],
  ['big_five', '*'],
  ['riasec', '*'],
  ['valores_persona', '*'],
  ['elecciones_valores', '*'],
  ['condiciones_persona', '*'],
  ['dealbreakers', '*'],
  ['persona_skills', '*'],
  ['fortalezas', '*'],
  ['retos', 'id, area, enunciado, respuesta, resultado, puntaje, segundos, eventos, created_at'],
  ['reportes', 'id, version, payload, mapa_md, resumen, modelo, prompt_version, created_at'],
  ['hipotesis', '*'],
  ['matches', '*'],
  ['postulaciones', '*'],
  ['llm_documents', 'id, sujeto_tipo, kind, texto, modelo, created_at'],
]

Deno.serve(async (req: Request) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return falla('Usa POST.', 405)

  const ident = await identificar(req)
  if (!ident) return falla('Necesitas iniciar sesion.', 401)
  const { personaId, supa } = ident
  const admin = clienteAdmin()

  const cuerpo = (await req.json().catch(() => ({}))) as { accion?: string; confirmar?: string }
  const accion = cuerpo.accion ?? 'exportar'

  if (accion === 'exportar') {
    const salida: Record<string, unknown> = {}
    for (const [tabla, columnas] of TABLAS) {
      // RLS ya limita a las filas propias; el filtro explicito es cinturon.
      const q = tabla === 'personas'
        ? await supa.from(tabla).select(columnas).eq('id', personaId)
        : await supa.from(tabla).select(columnas).eq('persona_id', personaId)
      salida[tabla] = q.error ? { error: q.error.message } : q.data
    }

    await admin.from('eventos_privacidad').insert({
      persona_id: personaId,
      accion: 'exportar',
      detalle: JSON.stringify({ tablas: TABLAS.length, at: new Date().toISOString() }),
    })

    return json({
      generado_at: new Date().toISOString(),
      persona_id: personaId,
      aviso: 'Este archivo contiene todos tus datos en Enfoca. Guardalo en un lugar seguro.',
      datos: salida,
    })
  }

  if (accion === 'borrar') {
    if (cuerpo.confirmar !== 'BORRAR') {
      return falla("Para borrar tu cuenta manda confirmar con el valor exacto 'BORRAR'.", 428)
    }

    // Primero el registro del evento, con el id en el detalle: al borrar la
    // persona el renglon queda sin persona_id pero la bitacora sobrevive.
    await admin.from('eventos_privacidad').insert({
      persona_id: null,
      accion: 'borrar',
      detalle: JSON.stringify({ persona_id: personaId, at: new Date().toISOString() }),
    })

    // El borrado en cascada limpia sesiones, mensajes, reportes, matches, etc.
    const borradoPerfil = await admin.from('personas').delete().eq('id', personaId)
    if (borradoPerfil.error) {
      return falla(`No pude borrar tu perfil: ${borradoPerfil.error.message}`, 500)
    }

    const borradoAuth = await admin.auth.admin.deleteUser(personaId)
    if (borradoAuth.error) {
      return json({
        borrado: true,
        aviso: `Tus datos se borraron, pero la cuenta de acceso no: ${borradoAuth.error.message}`,
      })
    }

    return json({
      borrado: true,
      mensaje: 'Listo. Se borraron tu perfil, tus respuestas, tus reportes y tu cuenta.',
    })
  }

  return falla("La accion debe ser 'exportar' o 'borrar'.")
})
