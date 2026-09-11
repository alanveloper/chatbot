export type Job = {
  title: string
  company: string
  location: string
  schedule: string
  match: number
  description: string
  tags: string[]
}

export const workQuestions = [
  {
    id: 'workingNow',
    title: '¿Trabajas actualmente?',
    description: 'Esto nos ayuda a entender desde dónde empiezas.',
    kind: 'choices',
    options: ['Sí, tiempo completo', 'Sí, medio tiempo', 'No, estoy buscando', 'No por el momento'],
  },
  {
    id: 'currentRole',
    title: '¿En qué área trabajas o has trabajado recientemente?',
    description: 'Puedes describir tu puesto, estudios o experiencia más relevante.',
    kind: 'text',
    placeholder: 'Ej. Atención a clientes en una tienda, diseño gráfico freelance...',
  },
  {
    id: 'roleEnjoyment',
    title: '¿Qué tanto disfrutas el rol que desempeñas?',
    description: 'No hay respuestas correctas. Queremos conocer tu experiencia.',
    kind: 'choices',
    options: ['Me gusta mucho', 'Hay partes que disfruto', 'No me siento a gusto', 'Aún no tengo experiencia laboral'],
  },
  {
    id: 'why',
    title: '¿Qué disfrutas y qué cambiarías de tu trabajo ideal?',
    description: 'Cuéntanos qué actividades te dan energía y cuáles prefieres evitar.',
    kind: 'text',
    placeholder: 'Me gusta resolver problemas y trabajar de forma autónoma. Preferiría no atender llamadas todo el día...',
  },
  {
    id: 'workStyle',
    title: '¿Qué estilo de trabajo se parece más a ti?',
    description: 'Elige el que más se acerque a tu preferencia actual.',
    kind: 'choices',
    options: ['Flexibilidad y metas por entrega', 'Horario claro y desconexión al terminar', 'Colaborar constantemente con un equipo', 'Concentrarme en tareas individuales'],
  },
] as const

export const assessments = [
  { id: 'interests', title: 'Intereses profesionales', time: '8 min', description: 'Explora las actividades y entornos que más te motivan.' },
  { id: 'strengths', title: 'Fortalezas y habilidades', time: '10 min', description: 'Identifica cómo te gusta aportar y qué se te facilita.' },
  { id: 'workstyle', title: 'Estilo de trabajo', time: '7 min', description: 'Conoce las condiciones que necesitas para trabajar bien.' },
]

export const mockJobs: Job[] = [
  {
    title: 'Asistente de operaciones', company: 'Norte Studio', location: 'Remoto en México', schedule: 'Tiempo completo · Horario flexible', match: 91,
    description: 'Organiza procesos, da seguimiento a proyectos y mejora la forma en que trabaja el equipo.', tags: ['Autonomía', 'Organización', 'Remoto'],
  },
  {
    title: 'Especialista de soporte por chat', company: 'Claro Servicios', location: 'Híbrido · Ciudad de México', schedule: 'Tiempo completo · Turno definido', match: 86,
    description: 'Ayuda a clientes a resolver dudas por escrito dentro de un equipo de soporte colaborativo.', tags: ['Comunicación escrita', 'Equipo', 'Estabilidad'],
  },
  {
    title: 'Coordinador de contenido', company: 'Taller Nube', location: 'Remoto', schedule: 'Por proyecto · Metas por entrega', match: 82,
    description: 'Planea y coordina contenido digital con espacio para gestionar tu propio ritmo de trabajo.', tags: ['Creatividad', 'Flexibilidad', 'Planeación'],
  },
]
