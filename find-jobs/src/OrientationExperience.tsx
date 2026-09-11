import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import './orientation.css'
import { API_URL } from './api'

type Section = 'identity' | 'work_style' | 'strengths' | 'interests' | 'energy' | 'sustainable_conditions' | 'goals' | 'non_negotiables'
type Status = 'empty' | 'exploring' | 'emerging' | 'provisional' | 'validated'
type InteractionType = 'voice_question' | 'text_question' | 'free_text' | 'single_choice' | 'multi_choice' | 'this_or_that' | 'ranking' | 'sorting' | 'scenario' | 'remove' | 'scale' | 'validation'
type Option = { id: string; label: string; description?: string }
type Interaction = { type: InteractionType; question: string; options?: Option[]; allowText?: boolean; allowVoice?: boolean }
type ProfileItem = { id: string; label: string; confidence: 'low' | 'medium' | 'high'; status: Status; evidence?: string }
type Profile = Record<Section, { label: string; icon: string; status: Status; items: ProfileItem[] }>
type Message = { role: 'user' | 'assistant'; content: string }
type StructuredResponse = { assistant?: { message?: string }; interaction?: Interaction; profileUpdates?: Array<{ section: Section; item: string; label: string; confidence?: 'low' | 'medium' | 'high'; status?: Status; evidence?: string }> }

type RecognitionResultLike = { transcript: string }
type RecognitionEventLike = { results: { length: number; [index: number]: { isFinal: boolean; length: number; [index: number]: RecognitionResultLike } } }
type RecognitionLike = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: RecognitionEventLike) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }
type RecognitionConstructor = new () => RecognitionLike

const storageKey = 'enfoca-orientation-v1'
const initialProfile: Profile = {
  identity: { label: 'Quién soy', icon: '◉', status: 'exploring', items: [] },
  work_style: { label: 'Cómo trabajo', icon: '⌁', status: 'empty', items: [] },
  strengths: { label: 'Fortalezas', icon: '✦', status: 'empty', items: [] },
  interests: { label: 'Intereses', icon: '♡', status: 'empty', items: [] },
  energy: { label: 'Energía', icon: 'ϟ', status: 'empty', items: [] },
  sustainable_conditions: { label: 'Necesidades', icon: '⌂', status: 'empty', items: [] },
  goals: { label: 'Objetivos', icon: '◎', status: 'empty', items: [] },
  non_negotiables: { label: 'No negociables', icon: '!', status: 'empty', items: [] },
}
const firstInteraction: Interaction = { type: 'free_text', question: 'Para empezar, ¿cómo te gusta que te llamen?', allowText: true, allowVoice: true }

function isInteraction(value: unknown): value is Interaction {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.type === 'string' && typeof item.question === 'string'
}

function profileFromUpdates(profile: Profile, updates: StructuredResponse['profileUpdates']) {
  if (!updates) return profile
  const next = structuredClone(profile) as Profile
  for (const update of updates) {
    if (!next[update.section]) continue
    const section = next[update.section]
    const item = { id: update.item, label: update.label, confidence: update.confidence ?? 'medium', status: update.status ?? 'emerging', evidence: update.evidence }
    const current = section.items.findIndex((entry) => entry.id === item.id)
    if (current >= 0) section.items[current] = item
    else section.items.push(item)
    section.status = item.status
  }
  return next
}

function iconForPiece(text: string) {
  const value = text.toLowerCase()
  if (/comunic|hablar|social|colabor/.test(value)) return '◌'
  if (/creativ|idea|diseñ|disen/.test(value)) return '✦'
  if (/anal|investig|problema/.test(value)) return '◇'
  if (/organiz|estruct/.test(value)) return '▦'
  if (/tecnolog|digital/.test(value)) return '⌘'
  if (/concentr|autonom|independ/.test(value)) return '◎'
  if (/energ|movimiento/.test(value)) return 'ϟ'
  return '◈'
}

function InteractionRenderer({ interaction, onAnswer, disabled, onListen, onStopListening, listening, transcript, voiceSupported, hideQuestion = false }: { interaction: Interaction; onAnswer: (answer: string) => void; disabled: boolean; onListen: () => void; onStopListening: () => void; listening: boolean; transcript: string; voiceSupported: boolean; hideQuestion?: boolean }) {
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [showText, setShowText] = useState(false)
  const options = interaction.options ?? []
  useEffect(() => { setText(''); setSelected([]); setShowText(false) }, [interaction])
  const submit = (event: FormEvent) => { event.preventDefault(); const answer = text.trim() || selected.map((id) => options.find((option) => option.id === id)?.label ?? id).join(', '); if (answer) onAnswer(answer) }
  const toggle = (id: string) => setSelected((items) => interaction.type === 'multi_choice' || interaction.type === 'sorting' ? (items.includes(id) ? items.filter((item) => item !== id) : [...items, id]) : [id])
  const choose = (option: Option) => { if (interaction.type === 'single_choice' || interaction.type === 'this_or_that' || interaction.type === 'scenario' || interaction.type === 'remove' || interaction.type === 'validation' || interaction.type === 'scale') onAnswer(option.label); else toggle(option.id) }
  const ranked = interaction.type === 'ranking'
  return <form className="interaction" onSubmit={submit}>
    {!hideQuestion && <p className="interaction-question">{interaction.question}</p>}
    {false && options.length > 0 && <div className={`interaction-options ${interaction.type} ${ranked ? 'ranking-list' : ''}`}>
      {options.map((option, index) => <button type="button" key={option.id} className={selected.includes(option.id) ? 'selected' : ''} disabled={disabled} onClick={() => choose(option)}>
        {ranked && <span className="rank">{index + 1}</span>}<span>{option.label}</span>{option.description && <small>{option.description}</small>}
      </button>)}
    </div>}
    {interaction.allowVoice && <div className={`voice-answer ${listening ? 'listening' : ''}`}><button className="voice-answer-button" type="button" onClick={listening ? onStopListening : onListen} disabled={disabled || !voiceSupported} aria-label={listening ? 'Terminar y enviar respuesta de voz' : 'Responder por voz'}><i aria-hidden="true">◉</i><span>{listening ? 'Terminar' : 'Hablar'}</span></button><p>{listening ? transcript || 'Puedes hablar con calma. Cuando termines, pulsa “Terminar”.' : voiceSupported ? 'También puedes responder en voz alta.' : 'El dictado no está disponible en este navegador.'}</p></div>}
    {(showText || !interaction.allowVoice) && <><label className="visually-hidden" htmlFor="orientation-answer">Tu respuesta</label><textarea id="orientation-answer" value={text} onChange={(event) => setText(event.target.value)} disabled={disabled} rows={3} placeholder="Escribe con tus propias palabras…" /><div className="interaction-actions"><button className="button primary" disabled={disabled || !text.trim()}>Enviar respuesta</button></div></>}
    {!showText && interaction.allowVoice && <button type="button" className="text-answer-toggle" onClick={() => setShowText(true)}>Prefiero escribir</button>}
    {showText && <button type="button" className="text-answer-toggle" onClick={() => setShowText(false)}>Volver a voz</button>}
  </form>
}

export default function OrientationExperience({ firstName }: { firstName: string }) {
  const saved = useMemo(() => { try { return JSON.parse(localStorage.getItem(storageKey) ?? '{}') as { messages?: Message[]; profile?: Profile; interaction?: Interaction } } catch { return {} } }, [])
  const [messages, setMessages] = useState<Message[]>(saved.messages ?? [{ role: 'assistant', content: 'Vamos a platicar. No es un examen y no hay respuestas correctas.' }])
  const [profile, setProfile] = useState<Profile>(saved.profile ?? initialProfile)
  const [interaction, setInteraction] = useState<Interaction>(saved.interaction ?? firstInteraction)
  const [activeSection, setActiveSection] = useState<Section>('identity')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<'welcome' | 'presenting' | 'opening' | 'consultation'>('welcome')
  const [voiceOn, setVoiceOn] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const recognitionRef = useRef<RecognitionLike | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const transcriptRef = useRef('')
  const submittingVoiceRef = useRef(false)
  const browserSpeech = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  const voiceSupported = typeof window !== 'undefined' && Boolean(browserSpeech.SpeechRecognition ?? browserSpeech.webkitSpeechRecognition)
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant')?.content ?? ''
  const towerPieces = (Object.keys(profile) as Section[]).flatMap((section) => profile[section].items.map((item) => ({ ...item, section })))

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify({ messages, profile, interaction })) }, [messages, profile, interaction])
  function speak(text: string) {
    if (!voiceOn || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-MX'; utterance.rate = .94
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }
  function beginExperience() {
    setPhase('presenting')
    speak(`Hola${firstName !== 'tu' ? `, ${firstName}` : ''}. Soy Enfoca. Estoy aquí para ayudarte a construir una forma de trabajo que te dé más bienestar, autonomía y conexión con oportunidades reales. No es un examen; iremos a tu ritmo.`)
    window.setTimeout(() => { setPhase('opening'); window.setTimeout(() => { setPhase('consultation'); speak(firstInteraction.question) }, 1150) }, 4100)
  }
  async function listen() {
    if (listening || loading) return
    if (!navigator.mediaDevices?.getUserMedia) { setVoiceError('Este navegador no permite acceder al micrófono. Puedes responder escribiendo.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      const Recognition = browserSpeech.SpeechRecognition ?? browserSpeech.webkitSpeechRecognition
      if (Recognition) {
        stream.getTracks().forEach((track) => track.stop())
        beginBrowserRecognition(Recognition)
        return
      }
      if (typeof MediaRecorder === 'undefined') {
        stream.getTracks().forEach((track) => track.stop())
        setVoiceError('Este navegador no puede grabar audio. Puedes responder escribiendo.')
        return
      }
      microphoneStreamRef.current = stream
      audioChunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        microphoneStreamRef.current = null; recorderRef.current = null
        const audio = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (audio.size > 0) void transcribeAudio(audio)
      }
      recorder.start(250)
      setListening(true); setTranscript(''); transcriptRef.current = ''; submittingVoiceRef.current = false; setVoiceError('')
      return
    } catch {
      setVoiceError('No pude acceder al micrófono. Revisa el permiso de micrófono para esta aplicación y vuelve a intentarlo.')
      return
    }
  }
  function beginBrowserRecognition(Recognition: RecognitionConstructor) {
    window.speechSynthesis?.cancel(); setSpeaking(false); setTranscript(''); transcriptRef.current = ''; submittingVoiceRef.current = false; setVoiceError('')
    const recognition = new Recognition(); recognition.lang = 'es-MX'; recognition.continuous = false; recognition.interimResults = true
    recognitionRef.current = recognition
    recognition.onresult = (event) => {
      let finalText = ''; let interimText = ''
      for (let index = 0; index < event.results.length; index += 1) { const result = event.results[index]; const text = result[0]?.transcript ?? ''; if (result.isFinal) finalText += text; else interimText += text }
      const heard = (finalText || interimText).trim()
      transcriptRef.current = heard; setTranscript(heard)
      if (finalText.trim()) { submittingVoiceRef.current = true; recognition.stop(); setListening(false); void answer(finalText) }
    }
    recognition.onerror = () => { setListening(false); setVoiceError('No pude escuchar con claridad. Puedes intentarlo otra vez o escribir tu respuesta.') }
    recognition.onend = () => { if (recognitionRef.current === recognition) recognitionRef.current = null; setListening(false) }
    try { recognition.start(); setListening(true) } catch { setListening(false); setVoiceError('No pude iniciar el micrófono. Revisa el permiso e inténtalo de nuevo.') }
  }
  async function transcribeAudio(audio: Blob) {
    try {
      const bytes = new Uint8Array(await audio.arrayBuffer())
      let binary = ''
      for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
      const response = await fetch(`${API_URL}/api/transcribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio: btoa(binary), mimeType: audio.type }) })
      const payload = await response.json() as { text?: string; error?: string }
      if (!response.ok || !payload.text?.trim()) throw new Error(payload.error ?? 'No pude transcribir el audio.')
      setTranscript(payload.text); transcriptRef.current = payload.text
      await answer(payload.text)
    } catch { setVoiceError('No pude convertir tu voz en texto. Inténtalo de nuevo o usa la opción de escribir.') }
  }
  function stopListeningAndSubmit() {
    if (recorderRef.current?.state === 'recording') { recorderRef.current.stop(); setListening(false); return }
    const spoken = transcriptRef.current.trim()
    recognitionRef.current?.stop(); recognitionRef.current = null; setListening(false)
    if (!spoken || submittingVoiceRef.current) { if (!spoken) setVoiceError('No alcancé a escuchar una respuesta. Puedes intentarlo otra vez o escribirla.'); return }
    submittingVoiceRef.current = true; void answer(spoken)
  }
  async function answer(content: string) {
    if (loading) return
    const nextMessages = [...messages, { role: 'user' as const, content }]
    setMessages(nextMessages); setLoading(true); setError('')
    try {
      const response = await fetch(`${API_URL}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: nextMessages }) })
      const payload = await response.json() as StructuredResponse & { message?: string; error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'No pude procesar esa respuesta.')
      const structured = typeof payload.assistant === 'object' ? payload : undefined
      const message = structured?.assistant?.message ?? payload.message
      if (typeof message !== 'string') throw new Error('No pude procesar esa respuesta.')
      setMessages((items) => [...items, { role: 'assistant', content: message }])
      if (structured?.profileUpdates) setProfile((current) => profileFromUpdates(current, structured.profileUpdates))
      const nextInteraction = isInteraction(structured?.interaction) ? structured.interaction : { type: 'free_text' as const, question: 'Cuéntame un poco más, con el detalle que te resulte cómodo.', allowText: true, allowVoice: true }
      setInteraction(nextInteraction)
      speak(`${message} ${nextInteraction.question}`)
    } catch (requestError) { setError(requestError instanceof Error ? 'No pude procesar esa respuesta. Vamos a intentarlo de nuevo.' : 'No pude procesar esa respuesta. Vamos a intentarlo de nuevo.') }
    finally { setLoading(false) }
  }
  if (phase !== 'consultation') return <section className={`orientation-entrance ${phase}`} aria-label="Inicio de la orientación profesional">
    <div className="entrance-copy"><span className="entrance-kicker">Enfoca · tu mapa profesional</span><h1>Tu forma de estar en el trabajo también importa.</h1><p>Construiremos una ruta que te ayude a vivir mejor, reconocer tu valor y conectar con la comunidad empresarial desde lo que realmente necesitas.</p><button className="button primary entrance-cta" onClick={beginExperience} disabled={phase !== 'welcome'}>{phase === 'welcome' ? 'Iniciar mi consulta' : phase === 'presenting' ? 'Enfoca te está recibiendo…' : 'Abriendo tu mapa…'}</button><small>No es un examen. Puedes hacer pausas y responder a tu manera.</small></div>
    <div className="cube-scene" aria-hidden="true"><div className="cube"><i className="cube-top" /><i className="cube-front" /><i className="cube-side" /><b className="cube-light" /></div><div className="cube-shadow" /></div>
  </section>
  return <section className="consultation-scene" aria-label="Consulta de orientación profesional">
    <header className="scene-header"><span>ENFOCA · CONSULTA PERSONAL</span><button type="button" className="voice-toggle" onClick={() => { setVoiceOn((active) => !active); window.speechSynthesis?.cancel(); setSpeaking(false) }} aria-pressed={voiceOn}>{voiceOn ? 'Sonido activo' : 'Activar sonido'}</button></header>
    <main className="bot-consultation"><div className={`bot-figure ${speaking ? 'speaking' : ''} ${listening ? 'listening' : ''}`} aria-hidden="true"><div className="bot-halo" /><div className="bot-head"><i className="bot-eye left" /><i className="bot-eye right" /><i className="bot-mouth" /></div><div className="bot-body" /></div><div className="agent-words" aria-live="polite"><span>{speaking ? 'Enfoca está hablando' : loading ? 'Enfoca está procesando' : 'Enfoca'}</span><p>{interaction.question || latestAssistantMessage}</p></div>{(error || voiceError) && <div className="orientation-error" role="alert">{error || voiceError}<button type="button" className="text-button" onClick={() => { setError(''); setVoiceError('') }}>Entendido</button></div>}<InteractionRenderer interaction={interaction} onAnswer={answer} disabled={loading} onListen={listen} onStopListening={stopListeningAndSubmit} listening={listening} transcript={transcript} voiceSupported={voiceSupported} hideQuestion /><section className="tower-stage" aria-label="Tu torre de perfil se construye durante la consulta"><div className="tower-caption"><span>Tu perfil se está construyendo</span><p>{towerPieces.length ? 'Seguimos reuniendo las piezas de tu historia profesional.' : 'Las piezas aparecerán mientras conversamos.'}</p></div><div className="tower-build">{towerPieces.map((piece) => <div key={`${piece.section}-${piece.id}`} className="profile-piece" aria-label={piece.label}><i>{iconForPiece(`${piece.id} ${piece.label}`)}</i><strong>{piece.label}</strong></div>)}{!towerPieces.length && <div className="tower-base"><i /><i /><i /></div>}</div></section></main>
  </section>
}
