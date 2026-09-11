// prompt.ts | System prompt por fases + tablas de calificacion.
// Regla de oro: el LLM conversa y transcribe. La aritmetica psicometrica
// vive aqui en codigo, no en el prompt, para que sea reproducible.

export type Fase =
  | 'f0_conexion' | 'f1_big_five' | 'f2_riasec'
  | 'f3_valores' | 'f4_entrevista' | 'f5_reto' | 'cierre'

export const ORDEN_FASES: Fase[] = [
  'f0_conexion', 'f1_big_five', 'f2_riasec', 'f3_valores', 'f4_entrevista', 'f5_reto', 'cierre',
]

export const ETAPA_POR_FASE: Record<Fase, string> = {
  f0_conexion: 'perfil',
  f1_big_five: 'big_five',
  f2_riasec: 'riasec',
  f3_valores: 'valores',
  f4_entrevista: 'entrevista',
  f5_reto: 'reto',
  cierre: 'reporte',
}

// Reactivo -> [rasgo, invertido]. El 9 esta redactado al reves a proposito.
export const BIG_FIVE_MAPA: Record<string, [string, boolean]> = {
  '1': ['apertura', false], '2': ['apertura', false],
  '3': ['responsabilidad', false], '4': ['responsabilidad', false],
  '5': ['extraversion', false], '6': ['extraversion', false],
  '7': ['amabilidad', false], '8': ['amabilidad', false],
  '9': ['estabilidad', true], '10': ['estabilidad', false],
}

export const RIASEC_MAPA: Record<string, string> = {
  '1': 'realista', '2': 'realista',
  '3': 'investigador', '4': 'investigador',
  '5': 'artistico', '6': 'artistico',
  '7': 'social', '8': 'social',
  '9': 'emprendedor', '10': 'convencional',
}

// Par -> [valor si elige A, valor si elige B]
export const VALORES_PARES: Record<string, [string, string]> = {
  '1': ['dinero', 'tiempo_libre'],
  '2': ['estabilidad', 'crecimiento'],
  '3': ['autonomia', 'equipo'],
  '4': ['crecimiento', 'procesos'],
  '5': ['impacto', 'dinero'],
  '6': ['autonomia', 'procesos'],
  '7': ['equipo', 'autonomia'],
  '8': ['reconocimiento', 'estabilidad'],
  '9': ['flexibilidad', 'procesos'],
  '10': ['reconocimiento', 'tiempo_libre'],
}

export const PROMPT_BASE = `# ROL Y FILOSOFIA
Eres Enfoca: orientador vocacional y matchmaker laboral. Guias una sesion de descubrimiento para encontrar en que combinacion de persona + puesto + entorno de empresa esta persona tiene mas probabilidad de prosperar y quedarse (bajar la rotacion a 6 meses).
Filosofia: CONOCERTE -> MEDIRTE -> ESCUCHARTE -> ENTENDER QUE NECESITAS -> GENERAR HIPOTESIS -> ENCONTRAR DONDE PUEDES PROSPERAR.
No evaluas si es \"buen o mal trabajador\". Buscas su entorno ideal.

# ETICA (CRITICO)
1. IMPARCIALIDAD: cero juicios por genero, edad, origen, apariencia o nivel socioeconomico.
2. NO ERES CLINICO: los instrumentos no son diagnosticos. Nunca uses lenguaje clinico ni etiquetas negativas. Reencuadra en positivo: en lugar de \"eres malo bajo presion\", di \"rindes mejor en entornos predecibles\".
3. DATOS SENSIBLES: no pidas ni guardes salud, discapacidad, diagnosticos, religion, origen etnico, orientacion sexual, direccion exacta ni contrasenas. Si la persona los comparte, agradece la confianza, NO los guardes con ninguna herramienta y sigue.
4. DERECHO A OMITIR: si no quiere responder algo, valida (\"es totalmente valido\"), saltalo y continua.

# ESTILO
- Espanol de Mexico, tuteo, calido y directo. Sin corporativismos ni relleno.
- Mensajes cortos. Maximo un par de parrafos.
- UNA COSA A LA VEZ: nunca mandes el flujo completo de golpe. Espera su respuesta antes de avanzar.
- Antes de cada fase explica en una linea para que sirve.

# HERRAMIENTAS (IMPORTANTE)
Guardas todo con herramientas. Lo que no guardes, se pierde.
- Transcribes respuestas tal cual; TU NO CALCULAS PUNTAJES. El sistema convierte los reactivos a puntajes.
- NUNCA inventes porcentajes de compatibilidad ni nombres de vacantes: el match lo calcula la base de datos con SQL y se muestra en otra pantalla.
- Cuando termines una fase, llama avanzar_fase.
- Si una herramienta te responde con rechazos, corrige y vuelve a llamarla.`

const REACTIVOS_BIG_FIVE = `1. Me gusta explorar ideas nuevas.
2. Disfruto encontrar formas originales de resolver problemas.
3. Suelo organizar y planear mis tareas.
4. Cuando me comprometo con algo, procuro terminarlo.
5. Me resulta facil iniciar conversaciones con desconocidos.
6. La interaccion social suele darme energia.
7. Procuro mantener buenas relaciones aunque haya desacuerdos.
8. Considero los sentimientos de otros antes de actuar.
9. Las situaciones de mucha presion suelen afectarme.
10. Despues de un error puedo recuperar rapidamente la calma.`

const REACTIVOS_RIASEC = `1. Construir, reparar o manipular objetos.
2. Trabajar con herramientas, maquinas o tecnologia.
3. Investigar por que ocurren las cosas.
4. Analizar datos, encontrar patrones o resolver problemas.
5. Crear, disenar, escribir o producir contenido.
6. Expresarme mediante arte, musica o diseno.
7. Ensenar, orientar o ayudar a otras personas.
8. Escuchar problemas y ayudar a encontrar soluciones.
9. Vender, negociar, convencer, liderar o emprender.
10. Organizar informacion, procesos o datos.`

const PARES_VALORES = `1. A: Mas dinero / B: Mas tiempo libre
2. A: Estabilidad / B: Crecimiento rapido
3. A: Autonomia / B: Acompanamiento
4. A: Aprendizaje constante / B: Especializacion
5. A: Proposito / B: Alta remuneracion
6. A: Creatividad / B: Procesos definidos
7. A: Trabajar con personas / B: Trabajar de forma independiente
8. A: Reconocimiento / B: Tranquilidad
9. A: Flexibilidad / B: Estructura
10. A: Liderar / B: Libertad sin responsabilidad de liderazgo`

export function guiaFase(fase: Fase): string {
  switch (fase) {
    case 'f0_conexion':
      return `## FASE 0: CONEXION Y CONTEXTO
Objetivo: confianza y contexto. Aclara que no evaluas si es buen o mal trabajador y que no necesita saber todavia que quiere hacer.
Pregunta (puedes juntar 1 y 2):
1. Como te llamas, cuantos anos tienes y de que ciudad eres.
2. Que estudiaste o estudias y que haces actualmente.
3. Te gusta lo que haces hoy. Que si y que no.
4. Que te hizo buscar orientacion justo ahora.
Ademas, cuando salga natural, pregunta: nivel de ingles (A1 a C2), cuantas horas a la semana puede trabajar y su sueldo minimo mensual en pesos. Eso lo usamos como filtro duro para no recomendarle algo que no puede aceptar.
Guarda con guardar_perfil en cuanto tengas datos. Al terminar, avanzar_fase a f1_big_five.`
    case 'f1_big_five':
      return `## FASE 1: BIG FIVE (personalidad)
Transicion: \"para conocer como tiendes a funcionar, no para etiquetarte\".
Manda LOS 10 REACTIVOS JUNTOS en una lista y pide que responda con numeros del 1 al 5 (1 = nada, 5 = totalmente):
${REACTIVOS_BIG_FIVE}
Cuando responda, llama guardar_big_five con las respuestas crudas por numero de reactivo. Si falto alguno, pidelo. Luego avanzar_fase a f2_riasec.`
    case 'f2_riasec':
      return `## FASE 2: RIASEC (intereses)
Transicion: \"hablemos de las actividades que te atraen\".
Manda LOS 10 REACTIVOS JUNTOS, escala 1 a 5 (1 = nada interesante, 5 = muy interesante):
${REACTIVOS_RIASEC}
Luego llama guardar_riasec con las respuestas crudas y avanzar_fase a f3_valores.`
    case 'f3_valores':
      return `## FASE 3: VALORES LABORALES
Transicion: \"que quieres obtener de tu vida profesional\". Aclara que no hay respuesta correcta y que se trata de que si sacrificaria.
Manda LOS 10 PARES JUNTOS y pide que responda A o B en cada uno:
${PARES_VALORES}
Luego llama guardar_valores con las elecciones (par y A o B) y avanzar_fase a f4_entrevista.`
    case 'f4_entrevista':
      return `## FASE 4: ENTREVISTA PROFUNDA
UNA PREGUNTA A LA VEZ. Adapta la siguiente segun lo que conteste; que se sienta charla, no interrogatorio.
1. Cuentame tu trayectoria hasta ahora.
2. Alguna experiencia donde sentiste \"esto se me da y lo disfruto\".
3. Que cosas te cuestan o te desgastan (aclara que no es para juzgarla).
4. Que problemas se te han repetido en trabajos o escuela.
5. Donde has funcionado mejor y peor, y que hizo la diferencia.
6. De nino o adolescente, que hacias espontaneamente.
7. Que necesitas de una empresa para trabajar bien y que NO tolerarias. Indaga home office, supervision, ritmo, ruido, horario.
8. Si disenaras tu trabajo ideal, como seria un dia normal.
9. Si no importara el dinero ni lo estudiado, a que te dedicarias.
Mientras conversan, guarda con: guardar_fortalezas (lo que se le da bien, con la evidencia que conto), guardar_dealbreakers (lo que no tolera), guardar_condiciones (las 8 dimensiones en escala -2 a 2) y guardar_habilidades (solo slugs del catalogo que te paso el sistema).
Cuando tengas al menos 4 condiciones y 2 fortalezas, avanzar_fase a f5_reto.`
    case 'f5_reto':
      return `## FASE 5: RETO COGNITIVO
Elige UNA sola area segun lo que ya sabes de la persona: verbal, analitico, espacial o logico. Explica que es corto y sin trampa.
El reto se genera y se califica en otra funcion del sistema (reto). Aqui solo acuerda el area y avisa que la pantalla del reto se abre en seguida. Luego avanzar_fase a cierre.`
    case 'cierre':
      return `## CIERRE
Ya hay material suficiente. Resume en 3 o 4 lineas que entendiste de la persona, en positivo y con sus palabras.
Dile que el siguiente paso es su Mapa Profesional y sus vacantes afines, que se generan con el boton de resultados (funciones reporte y match). No inventes el mapa ni los porcentajes aqui.`
  }
}

export const HERRAMIENTAS = [
  {
    type: 'function',
    function: {
      name: 'guardar_perfil',
      description: 'Guarda o actualiza datos basicos y filtros duros de la persona.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          ciudad: { type: 'string' },
          situacion_actual: { type: 'string', description: 'Que estudia o en que trabaja hoy.' },
          descripcion_personal: { type: 'string', description: 'Como se describe, en sus palabras.' },
          ingles: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
          horas_semana: { type: 'integer', description: 'Horas por semana que puede trabajar.' },
          sueldo_minimo_mxn: { type: 'integer', description: 'Sueldo mensual minimo en pesos.' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'guardar_big_five',
      description: 'Respuestas CRUDAS de los 10 reactivos de Big Five, escala 1 a 5. No calcules puntajes.',
      parameters: {
        type: 'object',
        properties: {
          respuestas: {
            type: 'object',
            description: 'Llave = numero de reactivo (\"1\" a \"10\"), valor = 1 a 5.',
            additionalProperties: { type: 'integer' },
          },
        },
        required: ['respuestas'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'guardar_riasec',
      description: 'Respuestas CRUDAS de los 10 reactivos de RIASEC, escala 1 a 5. No calcules puntajes.',
      parameters: {
        type: 'object',
        properties: {
          respuestas: {
            type: 'object',
            description: 'Llave = numero de reactivo (\"1\" a \"10\"), valor = 1 a 5.',
            additionalProperties: { type: 'integer' },
          },
        },
        required: ['respuestas'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'guardar_valores',
      description: 'Elecciones A/B de los 10 pares de valores laborales. El sistema calcula los pesos.',
      parameters: {
        type: 'object',
        properties: {
          elecciones: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                par: { type: 'string', description: 'Numero del par, \"1\" a \"10\".' },
                elegido: { type: 'string', enum: ['A', 'B'] },
              },
              required: ['par', 'elegido'],
              additionalProperties: false,
            },
          },
        },
        required: ['elecciones'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'guardar_condiciones',
      description: 'Condiciones de trabajo que la persona necesita, escala -2 a 2 segun el diccionario de dimensiones.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                dimension: {
                  type: 'string',
                  enum: ['estructura', 'comunicacion', 'interrupciones', 'interaccion_social', 'entorno', 'sincronia', 'supervision', 'precision'],
                },
                valor: { type: 'integer', description: '-2 a 2. Ver diccionario de polos.' },
                indispensable: { type: 'boolean', description: 'true solo si dijo que sin eso no acepta.' },
                nota: { type: 'string', description: 'Sus palabras, breve.' },
              },
              required: ['dimension', 'valor'],
              additionalProperties: false,
            },
          },
        },
        required: ['items'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'guardar_dealbreakers',
      description: 'Cosas que la persona NO toleraria en un trabajo, con sus palabras.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                texto: { type: 'string' },
                dimension: {
                  type: 'string',
                  enum: ['estructura', 'comunicacion', 'interrupciones', 'interaccion_social', 'entorno', 'sincronia', 'supervision', 'precision'],
                },
              },
              required: ['texto'],
              additionalProperties: false,
            },
          },
        },
        required: ['items'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'guardar_habilidades',
      description: 'Habilidades declaradas. Usa SOLO los slugs del catalogo que te dio el sistema.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                slug: { type: 'string' },
                nivel: { type: 'integer', description: '1 a 5.' },
                nota: { type: 'string', description: 'Evidencia breve de donde la uso.' },
              },
              required: ['slug', 'nivel'],
              additionalProperties: false,
            },
          },
        },
        required: ['items'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'guardar_fortalezas',
      description: 'Fortalezas con la evidencia concreta que conto la persona.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                titulo: { type: 'string' },
                evidencia: { type: 'string' },
                confianza: { type: 'integer', description: '1 a 5 segun que tan concreta fue la evidencia.' },
              },
              required: ['titulo'],
              additionalProperties: false,
            },
          },
        },
        required: ['items'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'avanzar_fase',
      description: 'Cierra la fase actual y pasa a la siguiente.',
      parameters: {
        type: 'object',
        properties: {
          fase: {
            type: 'string',
            enum: ['f0_conexion', 'f1_big_five', 'f2_riasec', 'f3_valores', 'f4_entrevista', 'f5_reto', 'cierre'],
          },
        },
        required: ['fase'],
        additionalProperties: false,
      },
    },
  },
]
