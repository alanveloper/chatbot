import { FormEvent, useEffect, useRef, useState } from 'react'
import './chat-test.css'
import MicrophoneIcon from './icons/microphone';
import VolumeIcon from './icons/volume';
import NoVolumeIcon from './icons/volume-off';

type Message = { role: 'user' | 'assistant'; content: string }
type ChatResponse = { message: string; responseId: string }

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export default function ChatTest({ firstName }: { firstName: string }) {
  const initialMessage: Message = {
    role: 'assistant',
    content: `Hola, ${firstName}. Vamos a conocer lo que buscas en un trabajo. ¿Qué tipo de tarea te hace perder la noción del tiempo?`,
  }
  const [messages, setMessages] = useState<Message[]>(() => [initialMessage])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isVoiceDetected, setIsVoiceDetected] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [voiceRecordingSupported] = useState(() => typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined')
  const messagesRef = useRef(messages)
  const loadingRef = useRef(false)
  const mutedRef = useRef(false)
  const avatarStageRef = useRef<HTMLDivElement | null>(null)
  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const microphoneContextRef = useRef<AudioContext | null>(null)
  const microphoneFrameRef = useRef<number | null>(null)
  const microphoneMeterRequestRef = useRef(0)
  const voiceDetectedRef = useRef(false)
  const responseAudioRef = useRef<HTMLAudioElement | null>(null)
  const responseAudioUrlRef = useRef<string | null>(null)
  const responseContextRef = useRef<AudioContext | null>(null)
  const responseFrameRef = useRef<number | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<Blob[]>([])
  const shouldTranscribeRef = useRef(false)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    mutedRef.current = isMuted
  }, [isMuted])

  function stopMicrophoneMeter() {
    microphoneMeterRequestRef.current += 1
    if (microphoneFrameRef.current !== null) window.cancelAnimationFrame(microphoneFrameRef.current)
    microphoneFrameRef.current = null
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop())
    microphoneStreamRef.current = null
    if (microphoneContextRef.current) void microphoneContextRef.current.close()
    microphoneContextRef.current = null
    voiceDetectedRef.current = false
    setIsVoiceDetected(false)
    avatarStageRef.current?.style.setProperty('--voice-level', '0')
  }

  function startMicrophoneMeter(stream: MediaStream) {
    if (!window.AudioContext) return
    const requestId = microphoneMeterRequestRef.current
    const context = new AudioContext()
    const source = context.createMediaStreamSource(stream)
    const filter = context.createBiquadFilter()
    const analyser = context.createAnalyser()
    filter.type = 'highpass'
    filter.frequency.value = 110
    filter.Q.value = 0.7
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.72
    source.connect(filter)
    filter.connect(analyser)
    void context.resume()
    microphoneContextRef.current = context

    const samples = new Uint8Array(analyser.fftSize)
    let noiseFloor = 0.012
    let calibrationTotal = 0
    let calibrationSamples = 0
    const calibrationEndsAt = performance.now() + 450
    const readLevel = () => {
      if (requestId !== microphoneMeterRequestRef.current) return
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const sample of samples) {
        const amplitude = (sample - 128) / 128
        sum += amplitude * amplitude
      }
      const now = performance.now()
      const rms = Math.sqrt(sum / samples.length)
      if (now < calibrationEndsAt) {
        calibrationTotal += rms
        calibrationSamples += 1
        noiseFloor = calibrationTotal / calibrationSamples
      }
      const threshold = Math.max(0.025, noiseFloor + 0.016, noiseFloor * 2.4)
      const detected = now >= calibrationEndsAt && rms > threshold
      if (!detected) noiseFloor = (noiseFloor * 0.97) + (rms * 0.03)
      else noiseFloor = (noiseFloor * 0.995) + (rms * 0.005)

      const level = detected ? Math.min(1, (rms - threshold) * 24) : 0
      avatarStageRef.current?.style.setProperty('--voice-level', level.toFixed(2))
      if (detected !== voiceDetectedRef.current) {
        voiceDetectedRef.current = detected
        setIsVoiceDetected(detected)
      }
      microphoneFrameRef.current = window.requestAnimationFrame(readLevel)
    }
    readLevel()
  }

  function stopResponseAudio() {
    if (responseFrameRef.current !== null) window.cancelAnimationFrame(responseFrameRef.current)
    responseFrameRef.current = null
    if (responseContextRef.current) void responseContextRef.current.close()
    responseContextRef.current = null
    if (responseAudioRef.current) {
      responseAudioRef.current.onended = null
      responseAudioRef.current.onerror = null
      responseAudioRef.current.pause()
      responseAudioRef.current = null
    }
    if (responseAudioUrlRef.current) URL.revokeObjectURL(responseAudioUrlRef.current)
    responseAudioUrlRef.current = null
    avatarStageRef.current?.style.setProperty('--speech-mouth-scale', '1')
    avatarStageRef.current?.style.setProperty('--speech-avatar-shift', '0px')
  }

  function startResponseMeter(audio: HTMLAudioElement) {
    if (!window.AudioContext) return
    const context = new AudioContext()
    const source = context.createMediaElementSource(audio)
    const analyser = context.createAnalyser()
    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.76
    source.connect(analyser)
    analyser.connect(context.destination)
    void context.resume()
    responseContextRef.current = context
    const samples = new Uint8Array(analyser.frequencyBinCount)

    const animateMouth = () => {
      analyser.getByteFrequencyData(samples)
      const average = samples.reduce((total, sample) => total + sample, 0) / samples.length
      const level = Math.min(1, average / 100)
      avatarStageRef.current?.style.setProperty('--speech-mouth-scale', (1 + (level * 1.15)).toFixed(2))
      avatarStageRef.current?.style.setProperty('--speech-avatar-shift', `${(level * 3).toFixed(1)}px`)
      responseFrameRef.current = window.requestAnimationFrame(animateMouth)
    }
    animateMouth()
  }

  async function speak(text: string, afterSpeaking?: () => void) {
    if (mutedRef.current) {
      afterSpeaking?.()
      return
    }
    stopResponseAudio()
    setIsSpeaking(true)
    try {
      const response = await fetch(`${API_URL}/api/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'No fue posible generar la voz.' })) as { error?: string }
        throw new Error(data.error ?? 'No fue posible generar la voz.')
      }

      const url = URL.createObjectURL(await response.blob())
      const audio = new Audio(url)
      audio.preload = 'auto'
      responseAudioRef.current = audio
      responseAudioUrlRef.current = url
      const finish = () => {
        if (responseAudioRef.current !== audio) return
        stopResponseAudio()
        setIsSpeaking(false)
        afterSpeaking?.()
      }
      audio.onended = finish
      audio.onerror = finish
      startResponseMeter(audio)
      await audio.play()
    } catch (speechError) {
      setIsSpeaking(false)
      setError(speechError instanceof Error ? speechError.message : 'No fue posible reproducir la voz de Enfoca.')
      afterSpeaking?.()
    }
  }

  function stopListening(shouldTranscribe = true) {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      shouldTranscribeRef.current = shouldTranscribe
      recorder.stop()
      setIsListening(false)
      return
    }
    recorderRef.current = null
    stopMicrophoneMeter()
    setIsListening(false)
  }

  async function sendContent(rawContent: string) {
    const content = rawContent.trim()
    if (!content || loadingRef.current) return

    const previousMessages = messagesRef.current
    const nextMessages: Message[] = [...previousMessages, { role: 'user', content }]
    messagesRef.current = nextMessages
    setMessages(nextMessages)
    setInput('')
    setError('')
    loadingRef.current = true
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })
      const data = await response.json() as Partial<ChatResponse> & { error?: string }
      if (!response.ok || typeof data.message !== 'string') throw new Error(data.error ?? 'No fue posible obtener una respuesta.')

      const updatedMessages = [...nextMessages, { role: 'assistant' as const, content: data.message }]
      messagesRef.current = updatedMessages
      setMessages(updatedMessages)
      if (!mutedRef.current) void speak(data.message)
    } catch (requestError) {
      messagesRef.current = previousMessages
      setMessages(previousMessages)
      setError(requestError instanceof Error ? requestError.message : 'Error de conexión con el backend.')
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  async function transcribeAudio(audio: Blob) {
    if (audio.size < 800) {
      setError('No detectamos suficiente audio. Intenta dictar de nuevo y habla cerca del micrófono.')
      return
    }
    setIsTranscribing(true)
    try {
      const response = await fetch(`${API_URL}/api/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': audio.type || 'audio/webm' },
        body: audio,
      })
      const data = await response.json() as { text?: string; error?: string }
      if (!response.ok || typeof data.text !== 'string') throw new Error(data.error ?? 'No fue posible transcribir el audio.')
      setInput(data.text)
    } catch (transcriptionError) {
      setError(transcriptionError instanceof Error ? transcriptionError.message : 'No fue posible transcribir el audio.')
    } finally {
      setIsTranscribing(false)
    }
  }

  async function startListening() {
    if (loadingRef.current || isSpeaking || isListening || isTranscribing) return
    if (!voiceRecordingSupported) {
      setError('La grabación de voz no está disponible en este navegador. Puedes escribir tu respuesta.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { autoGainControl: true, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      const supportedType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, supportedType ? { mimeType: supportedType } : undefined)
      recordChunksRef.current = []
      shouldTranscribeRef.current = true
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const audio = new Blob(recordChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const shouldTranscribe = shouldTranscribeRef.current
        recorderRef.current = null
        stopMicrophoneMeter()
        setIsListening(false)
        if (shouldTranscribe) void transcribeAudio(audio)
      }
      recorderRef.current = recorder
      microphoneStreamRef.current = stream
      startMicrophoneMeter(stream)
      recorder.start(250)
      setInput('')
      setError('')
      setIsListening(true)
    } catch {
      setError('Necesitamos permiso para usar el micrófono. Revísalo en los ajustes del navegador.')
      setIsListening(false)
    }
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendContent(input)
  }

  function clearChat() {
    stopListening(false)
    stopResponseAudio()
    setIsSpeaking(false)
    messagesRef.current = [initialMessage]
    setMessages([initialMessage])
    setInput('')
    setError('')
  }

  function toggleMute() {
    if (!isMuted) {
      stopResponseAudio()
      setIsSpeaking(false)
    }
    setIsMuted((muted) => !muted)
  }

  useEffect(() => () => {
    stopListening(false)
    stopResponseAudio()
  }, [])

  const latestAssistantIndex = messages.map((message) => message.role).lastIndexOf('assistant')
  const avatarState = isSpeaking ? 'speaking' : isListening ? 'listening' : loading ? 'thinking' : 'ready'
  const voiceStatus = isListening
    ? isVoiceDetected ? 'Detectamos tu voz. Cuando termines, pulsa “Terminar dictado”.' : 'Te estamos escuchando. Habla cuando quieras.'
    : isTranscribing
      ? 'Estamos escribiendo tu dictado…'
      : isSpeaking
        ? 'Enfoca está hablando. Puedes silenciar la voz cuando quieras.'
        : isMuted
          ? 'La voz de Enfoca está silenciada.'
          : 'Puedes escribir o dictar tu respuesta.'

  return (
    <section className="chat-test page">
      <div className="chat-header"><div><p className="eyebrow">Tu conversación</p><h1>Vamos a tu ritmo, {firstName}.</h1><p className="lede">Responde una pregunta a la vez. Puedes pausar, escribir o hablar cuando prefieras.</p></div><button className="button secondary" onClick={clearChat}>Limpiar chat</button></div>
      <div className="chat-notice"><strong>Tu conversación construye un punto de partida</strong><span>Comparte solo lo que te resulte útil. Más adelante podrás revisar cómo se traduce en preferencias profesionales.</span></div>
      <div className="chat-window" aria-live="polite">{messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
        {message.role === 'assistant' && <div className={`chat-avatar-stage ${index === latestAssistantIndex ? avatarState : 'ready'} ${index === latestAssistantIndex && isVoiceDetected ? 'voice-detected' : ''}`} ref={index === latestAssistantIndex ? avatarStageRef : undefined} aria-hidden="true"><div className="avatar-halo" /><div className="assistant-avatar"><span className="avatar-face"><i className="avatar-eye avatar-eye-left" /><i className="avatar-eye avatar-eye-right" /><i className="avatar-mouth" /></span></div><div className="avatar-sound avatar-sound-right"><i /><i /><i /></div></div>}
        <div className="chat-message-content"><span className="chat-role">{message.role === 'user' ? 'Tú' : index === latestAssistantIndex && isSpeaking ? 'Enfoca · hablando' : 'Enfoca'}</span><div className="chat-bubble">{message.content}</div></div>
      </div>)}{loading && <div className="chat-message assistant"><div className="chat-avatar-stage thinking" ref={avatarStageRef} aria-hidden="true"><div className="avatar-halo" /><div className="assistant-avatar"><span className="avatar-face"><i className="avatar-eye avatar-eye-left" /><i className="avatar-eye avatar-eye-right" /><i className="avatar-mouth" /></span></div></div><div className="chat-message-content"><span className="chat-role">Enfoca</span><div className="chat-bubble typing">Pensando…</div></div></div>}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form className="chat-form" onSubmit={sendMessage}><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Escribe o dicta tu respuesta…" rows={3} disabled={loading || isTranscribing} /><div className="chat-composer-actions"><button title='Dictar' className={`chat-voice-button ${isListening ? 'listening' : ''}`} type="button" onClick={() => { if (isListening) stopListening(); else void startListening() }} disabled={!voiceRecordingSupported || loading || isSpeaking || isTranscribing}>{isListening ? 'Terminar dictado' : isTranscribing ? 'Transcribiendo…' : <MicrophoneIcon />}</button><button className="chat-mute-button" type="button" title={isMuted ? "Activar voz" : "Silenciar voz"} onClick={toggleMute} aria-pressed={isMuted}>{isMuted ? <NoVolumeIcon/> : <VolumeIcon />}</button><button className="button primary" type="submit" disabled={loading || isTranscribing || isListening || !input.trim()}>{loading ? 'Enviando…' : 'Enviar respuesta'}</button></div></form>
      <p className="voice-compose-status" role="status">{voiceStatus}</p>
      {!voiceRecordingSupported && <p className="voice-help">La grabación funciona en navegadores modernos que permiten usar el micrófono.</p>}
    </section>
  )
}
