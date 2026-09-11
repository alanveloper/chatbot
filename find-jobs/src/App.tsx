import { FormEvent, useEffect, useMemo, useState } from 'react'
import OrientationExperience from './OrientationExperience'
import { assessments, mockJobs, workQuestions } from './data'

type BasicProfile = { name: string; email: string; headline: string }
type Answers = Record<string, string>
type Step = 'welcome' | 'profile' | 'questions' | 'assessments' | 'results' | 'chat'

const storageKey = 'enfoca-profile-v1'
const initialProfile: BasicProfile = { name: '', email: '', headline: '' }

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? '{}') as { profile?: BasicProfile; answers?: Answers; completed?: string[] }
  } catch {
    return {}
  }
}

function Landing({ onProfile }: { onProfile: () => void }) {
  return <>
    <section className="landing-hero" id="inicio">
      <div className="landing-container hero-layout">
        <div className="hero-copy">
          <p className="eyebrow eyebrow-rose">Orientación laboral para pensar diferente</p>
          <h1>Tu forma de trabajar <span>merece un lugar.</span></h1>
          <p className="lede">Enfoca transforma lo que sabes de ti en un mapa para explorar roles, entornos y equipos donde puedas desarrollarte con mayor claridad.</p>
          <div className="hero-actions"><button className="button primary" onClick={onProfile}>Crear mi perfil</button></div>
          <p className="hero-note">Puedes pausar, omitir una pregunta o volver después. Nada se pierde.</p>
        </div>
        <div className="hero-stage" aria-label="Ejemplo de cómo Enfoca presenta un mapa de compatibilidad">
          <div className="stage-orbit orbit-one" /><div className="stage-orbit orbit-two" />
          <article className="hero-profile-card"><div className="card-rainbow" /><div className="profile-card-top"><div><span>Mapa de carrera</span><strong>Tu lectura inicial</strong></div><b>Privado</b></div><div className="profile-card-body"><p>Las condiciones que vale la pena cuidar</p><h3>Espacio para concentrarte, prioridades visibles y autonomía.</h3></div><div className="profile-dimensions"><div className="dimension-row role"><span>Rol</span><strong>Tareas que disfrutas</strong></div><div className="dimension-row environment"><span>Entorno</span><strong>Ritmo y comunicación</strong></div><div className="dimension-row team"><span>Equipo</span><strong>Cultura y liderazgo</strong></div><div className="dimension-row path"><span>Trayectoria</span><strong>Dirección que buscas</strong></div></div></article>
          <article className="floating-note"><span className="note-line" /><p>Una recomendación siempre incluye sus razones.</p></article>
          <article className="floating-role"><span>Próximo paso</span><strong>Explorar oportunidades</strong></article>
        </div>
      </div>
    </section>

    <section className="landing-section introduction" id="enfoca"><div className="landing-container intro-grid"><div><p className="eyebrow eyebrow-blue">No es una prueba. Es un punto de partida.</p><h2>Las oportunidades no se ven igual cuando tienes el contexto completo.</h2></div><div className="intro-copy"><p>Enfoca reúne intereses, fortalezas demostrables, energía, comunicación y condiciones de trabajo. No entrega un veredicto: te da información que puedes usar.</p><a href="#como-funciona">Conoce cómo se construye tu mapa</a></div></div></section>

    <section className="landing-section story-section" id="como-funciona"><div className="landing-container story-grid"><div className="story-visual"><div className="story-label"><span>Tu perfil</span><strong>Una conversación a la vez</strong></div><div className="story-track"><article><small>01</small><strong>Lo que te interesa</strong><p>Tareas, temas y retos que te dan energía.</p></article><article><small>02</small><strong>Cómo trabajas mejor</strong><p>Ritmo, estructura y forma de comunicarte.</p></article><article><small>03</small><strong>Qué quieres construir</strong><p>Metas, aprendizaje y siguiente dirección.</p></article></div></div><div className="story-copy"><p className="eyebrow eyebrow-green">Construye tu mapa a tu ritmo</p><h2>Una conversación tranquila puede abrir mejores preguntas.</h2><p className="lede">Partimos de experiencias reales para que identifiques lo que te ayuda a hacer un buen trabajo, no de lo que se espera que respondas.</p><button className="text-button landing-text-button" onClick={onProfile}>Empezar mi perfil</button></div></div></section>

    <section className="landing-section dimensions-section"><div className="landing-container dimensions-heading"><p className="eyebrow eyebrow-violet">Compatibilidad que se puede explicar</p><h2>Cuatro lentes para mirar cada oportunidad.</h2><p>Las coincidencias y fricciones se muestran con sus razones para que tú tomes la decisión.</p></div><div className="landing-container dimensions-grid"><article className="dimension-card role-card"><span>01 · Rol</span><h3>Lo que haces</h3><p>Tareas, habilidades e intereses que pueden hacer sentido para ti.</p></article><article className="dimension-card environment-card"><span>02 · Entorno</span><h3>Cómo se trabaja</h3><p>Ritmo, modalidad, procesos y acuerdos de comunicación.</p></article><article className="dimension-card team-card"><span>03 · Equipo</span><h3>Con quién colaboras</h3><p>Cultura real, liderazgo, claridad y flexibilidad disponible.</p></article><article className="dimension-card path-card"><span>04 · Trayectoria</span><h3>Hacia dónde avanzas</h3><p>Aprendizaje, crecimiento y los objetivos que quieres acercar.</p></article></div></section>

    <section className="landing-section privacy-section" id="privacidad"><div className="landing-container privacy-layout"><div className="privacy-copy"><p className="eyebrow eyebrow-rose">Privacidad por defecto</p><h2>Tu perfil te pertenece.</h2><p className="lede">Las empresas no ven tus respuestas personales. Tú eliges qué información profesional compartes, con quién y cuándo.</p><button className="text-button landing-text-button" onClick={onProfile}>Ver cómo funciona mi perfil</button></div><div className="privacy-display"><div className="vault-head"><span>Tu bóveda</span><b>Control personal</b></div><div className="vault-item"><span>Preferencias de comunicación</span><strong>Solo tú</strong></div><div className="vault-item"><span>Condiciones para concentrarte</span><strong>Solo tú</strong></div><div className="vault-item shared"><span>Presentación profesional</span><strong>Compartir cuando quieras</strong></div><p>Nada sale de aquí sin que tú lo marques.</p></div></div></section>

    <section className="landing-section teams-section" id="equipos"><div className="landing-container teams-layout"><div><p className="eyebrow eyebrow-orange">Para organizaciones</p><h2>Describe el trabajo tal como se vive.</h2><p className="lede">Ayuda a más personas a entender el rol, el ritmo, la forma de colaborar y los apoyos que ya existen en tu equipo.</p></div><div className="teams-card"><p>Una oportunidad clara explica:</p><ul><li>Las tareas y prioridades reales</li><li>La dinámica del equipo</li><li>La flexibilidad disponible</li></ul><a className="button secondary" href="mailto:hola@enfoca.mx">Conocer Enfoca para equipos</a></div></div></section>

    <section className="landing-cta"><div className="landing-container"><p className="eyebrow eyebrow-rose">Tu siguiente paso profesional</p><h2>Empieza por lo que ya sabes de ti.</h2><p>Construye una primera lectura y explora con más claridad.</p><button className="button primary" onClick={onProfile}>Crear mi perfil</button></div></section>
  </>
}

function App() {
  const saved = useMemo(loadSaved, [])
  const [step, setStep] = useState<Step>('welcome')
  const [profile, setProfile] = useState<BasicProfile>(saved.profile ?? initialProfile)
  const [answers, setAnswers] = useState<Answers>(saved.answers ?? {})
  const [completed, setCompleted] = useState<string[]>(saved.completed ?? [])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ profile, answers, completed }))
  }, [profile, answers, completed])

  const currentQuestion = workQuestions[questionIndex]
  const overallProgress = step === 'profile' ? 12 : step === 'questions' ? 20 + (questionIndex / workQuestions.length) * 35 : step === 'assessments' ? 60 + (completed.length / assessments.length) * 25 : step === 'results' ? 100 : 0
  const firstName = profile.name.trim().split(' ')[0] || 'tu'

  function beginProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile.name.trim() || !profile.email.trim()) {
      setError('Completa tu nombre y correo para continuar.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(profile.email)) {
      setError('Escribe un correo válido.')
      return
    }
    setError('')
    setStep('chat')
  }

  function nextQuestion() {
    if (!answers[currentQuestion.id]?.trim()) {
      setError('Elige o escribe una respuesta para continuar.')
      return
    }
    setError('')
    if (questionIndex === workQuestions.length - 1) setStep('assessments')
    else setQuestionIndex((index) => index + 1)
  }

  function toggleAssessment(id: string) {
    setCompleted((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id])
  }

  function resetDemo() {
    localStorage.removeItem(storageKey)
    setProfile(initialProfile)
    setAnswers({})
    setCompleted([])
    setQuestionIndex(0)
    setStep('welcome')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setStep('welcome')} aria-label="Ir al inicio de Enfoca"><span>enfoca</span><i /></button>
        {step === 'welcome' ? <div className="topbar-actions landing-actions"><nav className="landing-nav" aria-label="Navegación principal"><a href="#enfoca">Enfoca</a><a href="#como-funciona">Cómo funciona</a><a href="#equipos">Para equipos</a></nav><button className="header-cta" onClick={() => setStep('profile')}>Crear perfil</button></div> : <div className="topbar-actions">{step !== 'chat' && <div className="save-status">Tus avances se guardan en este dispositivo</div>}</div>}
      </header>

      {step !== 'welcome' && step !== 'chat' && <div className="progress-wrap" aria-label={`Progreso ${Math.round(overallProgress)}%`}><div className="progress" style={{ width: `${overallProgress}%` }} /></div>}

      <main>
        {step === 'welcome' && <Landing onProfile={() => setStep('profile')} />}

        {step === 'profile' && <section className="form-page page narrow">
          <p className="eyebrow">Tu perfil</p><h1>Empecemos por lo básico.</h1><p className="lede">Comparte tu nombre y correo para personalizar la conversación. Después podrás empezar a tu ritmo.</p>
          <form onSubmit={beginProfile} noValidate>
            <label>Nombre completo<input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Escribe tu nombre" autoComplete="name" /></label>
            <label>Correo electrónico<input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="tu@correo.com" autoComplete="email" /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="actions"><button type="button" className="button secondary" onClick={() => setStep('welcome')}>Atrás</button><button className="button primary" type="submit">Ir a la conversación</button></div>
          </form>
        </section>}

        {step === 'questions' && <section className="form-page page narrow question-page">
          <p className="eyebrow">Perfil de trabajo · {questionIndex + 1} de {workQuestions.length}</p><h1>{currentQuestion.title}</h1><p className="lede">{currentQuestion.description}</p>
          <div className="question-content">
            {currentQuestion.kind === 'choices' ? <div className="choices">{currentQuestion.options.map((option) => <button key={option} className={`choice ${answers[currentQuestion.id] === option ? 'selected' : ''}`} onClick={() => { setAnswers({ ...answers, [currentQuestion.id]: option }); setError('') }}>{option}</button>)}</div> : <textarea className="answer-area" rows={5} placeholder={currentQuestion.placeholder} value={answers[currentQuestion.id] ?? ''} onChange={(e) => { setAnswers({ ...answers, [currentQuestion.id]: e.target.value }); setError('') }} />}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="actions"><button className="button secondary" onClick={() => questionIndex === 0 ? setStep('profile') : setQuestionIndex((index) => index - 1)}>Atrás</button><button className="button primary" onClick={nextQuestion}>{questionIndex === workQuestions.length - 1 ? 'Ver mis evaluaciones' : 'Continuar'}</button></div>
        </section>}

        {step === 'assessments' && <section className="form-page page assessment-page">
          <div className="assessment-heading"><div><p className="eyebrow">Paso 3 de 3</p><h1>Conoce tu forma de trabajar.</h1><p className="lede">Marca las evaluaciones que completaste. Por ahora son una simulación: después se conectarán con los tests del producto.</p></div><div className="completion-count"><strong>{completed.length}/{assessments.length}</strong><span>evaluaciones</span></div></div>
          <div className="assessment-list">{assessments.map((assessment, index) => <article className={`assessment ${completed.includes(assessment.id) ? 'done' : ''}`} key={assessment.id}><span className="assessment-number">0{index + 1}</span><div><h2>{assessment.title}</h2><p>{assessment.description}</p><small>{assessment.time}</small></div><button className={`button ${completed.includes(assessment.id) ? 'secondary' : 'primary'}`} onClick={() => toggleAssessment(assessment.id)}>{completed.includes(assessment.id) ? 'Completado' : 'Completar'}</button></article>)}</div>
          <div className="actions"><button className="button secondary" onClick={() => setStep('questions')}>Atrás</button><button className="button primary" onClick={() => setStep('results')}>Ver mi resultado preliminar</button></div>
        </section>}

        {step === 'results' && <section className="results page">
          <div className="result-hero"><p className="eyebrow">Tu perfil de trabajo</p><h1>Hola, {firstName}. Aquí hay un punto de partida.</h1><p>Este resultado es una muestra basada en datos de ejemplo. En la versión conectada, será generado con tus respuestas y evaluaciones.</p></div>
          <section className="insight"><div><p className="eyebrow">Lectura preliminar</p><h2>Podrías sentirte mejor en roles con autonomía, organización y metas claras.</h2></div><div className="preference-list"><span>Espacio para decidir cómo avanzar</span><span>Objetivos concretos y orden</span><span>Comunicación enfocada y práctica</span></div></section>
          <section className="jobs"><div className="section-heading"><div><p className="eyebrow">Oportunidades para explorar</p><h2>Vacantes que podrían interesarte</h2></div><span className="mock-label">Datos de ejemplo</span></div><div className="job-list">{mockJobs.map((job) => <article className="job" key={job.title}><div className="match"><strong>{job.match}%</strong><span>afinidad</span></div><div className="job-main"><h3>{job.title}</h3><p className="company">{job.company} · {job.location}</p><p>{job.description}</p><div className="tags">{job.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div><div className="job-meta"><span>{job.schedule}</span><small>Detalle disponible al conectar vacantes</small></div></article>)}</div></section>
          <div className="result-footer"><button className="button secondary" onClick={() => setStep('assessments')}>Volver a evaluaciones</button><button className="text-button" onClick={resetDemo}>Reiniciar demostración</button></div>
        </section>}

        {step === 'chat' && <OrientationExperience firstName={firstName} />}
      </main>
    </div>
  )
}

export default App
