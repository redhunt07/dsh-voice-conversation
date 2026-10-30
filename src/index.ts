/** DSH Voice Conversation host. Derived from ZG2017 Voice Loop; see NOTICE.md. */
import type { Context } from '@deepseek-ai/cordis'
import { redactSecrets } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-system-prompt'
// Type-only: the Fiber.entry merge (the profile entry id Settings edits).
import type {} from '@deepseek-ai/dsh-config-editor'
import { VoiceModeConfigSchema, VoiceModeSettingsSchema, currentSettings } from './config-schema.ts'
import type { VoiceModeConfig, VoiceModeEndpointConfig, VoiceModeSettings } from './config-schema.ts'

// Local is the default; clients select an explicitly configured endpoint slot.
const STT_PROVIDER_DEFAULT = String(process.env.VOICE_MODE_STT_PROVIDER || 'local').trim()

function resolveSttProvider(headerValue: string | string[] | undefined): string {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  return trimmed === 'local' || trimmed === 'cloud' ? trimmed : STT_PROVIDER_DEFAULT
}

// The length hint is load-bearing, not decorative: this is now the ONLY
// mechanism keeping a voice-mode reply short enough to read aloud without
// turning into a monologue (see this file's own module comment for why the
// separate post-hoc rewrite pass was removed). Numeric guidance
// (characters/words, not just "brief") because plain "keep it short" alone
// under-constrained the model in practice - concrete numbers give it an
// actual target to write to.
const TASK_MODE_SPOKEN_LENGTH_HINT = 'a couple of short sentences - about 80-120 Chinese characters, or ~30-45 English words, whichever the language calls for'
const CHAT_MODE_SPOKEN_LENGTH_HINT = 'no more than 1-2 short sentences - about 40-60 Chinese characters, or ~15-20 English words, whichever the language calls for'

const VOICE_MODE_SECTION_BASE = 'You are currently in a live voice conversation with the user (voice mode: your reply will be read aloud, not displayed as text). '
  + 'Answer briefly and conversationally - no markdown lists, headings, tables, or code blocks; nothing that only makes sense written down. '
  + `Keep your reply to ${TASK_MODE_SPOKEN_LENGTH_HINT} - this is read aloud, not read on a screen, so length matters more than in text chat. `
  + 'Reply in the same language the user just spoke in.'

// Appended only in Chat preset mode (client.js's presetMode==='chat') - Task
// mode gets VOICE_MODE_SECTION_BASE alone, unchanged from before this preset
// split existed. Chat is meant for quick back-and-forth talk, not getting
// things done, so it steers away from the tool-heavy/thorough behavior the
// base agent defaults to - paired client-side with reasoningEffort 'off'
// (see client.js's presetMode handling).
const VOICE_MODE_CHAT_PRESET_ADDITION = ' You are in Chat preset mode: this is casual conversation, not task work. '
  + "Prioritize a fast, natural reply over thoroughness - answer from what you already know rather than reaching for tools, web search, file edits, or multi-step research unless the user's request genuinely can't be answered without one. "
  + `Keep replies especially short - ${CHAT_MODE_SPOKEN_LENGTH_HINT}, the length of a real spoken remark.`

function voiceModeSectionText(presetMode: 'chat' | 'task'): string {
  return presetMode === 'chat' ? VOICE_MODE_SECTION_BASE + VOICE_MODE_CHAT_PRESET_ADDITION : VOICE_MODE_SECTION_BASE
}

// SessionId -> whether voice mode is currently on, for this host process's
// lifetime only (see module comment above).
const activeSessions = new Map<string, boolean>()

// SessionId -> the client's last-reported preset mode (client.js's
// sharedVoiceModePrefs.presetMode - the same host-process-lifetime-only
// convention as activeSessions above, updated by the /toggle route below).
// Absent means 'task' (the default before any client has ever reported a
// mode - see the two lookups below, both `=== 'chat'` checks that treat
// anything else, including missing, as 'task').
const presetModeSessions = new Map<string, 'chat' | 'task'>()

export const name = 'voice-conversation'
export const inject = ['webServer', 'systemPrompt']
export const Config = VoiceModeConfigSchema

// Authentication failures include the settings location.
const AUTH_HINT = ' - check the API key in Settings → Plugins → Voice Mode'

async function transcribeGeneric(audio: Uint8Array, mime: string, cfg: VoiceModeEndpointConfig, label: string): Promise<string> {
  if (audio.byteLength === 0) throw new Error('voice-mode: recorded audio is empty')
  if (!cfg.endpoint) throw new Error(`voice-mode: ${label} STT endpoint is not configured - set one in Settings → Plugins → Voice Mode`)
  const form = new FormData()
  form.set('file', new Blob([new Uint8Array(audio)], { type: mime || 'audio/wav' }), 'audio.wav')
  form.set('model', cfg.model)
  const headers: Record<string, string> = {}
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`
  let response: Response
  try {
    response = await fetch(cfg.endpoint, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(85000) })
  } catch (err) {
    throw new Error(`voice-mode: ${label} STT request failed: ` + (err instanceof Error ? err.message : String(err)))
  }
  const body = await response.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error(`voice-mode: ${label} STT returned non-JSON response (HTTP ${String(response.status)})`)
  }
  if (!response.ok) {
    const hint = response.status === 401 || response.status === 403 ? AUTH_HINT : ''
    throw new Error(`voice-mode: ${label} STT request failed (HTTP ${String(response.status)}): ${body.slice(0, 300)}${hint}`)
  }
  if (typeof parsed !== 'object' || parsed === null || typeof (parsed as { text?: unknown }).text !== 'string') {
    throw new Error(`voice-mode: ${label} STT returned no transcript`)
  }
  return (parsed as { text: string }).text.trim()
}

async function transcribeLocal(audio: Uint8Array, mime: string, settings: VoiceModeSettings): Promise<string> {
  return transcribeGeneric(audio, mime, settings.sttLocal, 'local')
}

async function transcribeCloud(audio: Uint8Array, mime: string, settings: VoiceModeSettings): Promise<string> {
  return transcribeGeneric(audio, mime, settings.sttCloud, 'cloud')
}

async function synthesizeOpenAiCompatibleTts(text: string, cfg: VoiceModeEndpointConfig & { langCode?: string }, voice: string, label: string): Promise<Buffer> {
  if (!cfg.endpoint) throw new Error(`voice-mode: ${label} TTS endpoint is not configured - set one in Settings → Plugins → Voice Mode`)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`
  let response: Response
  try {
    response = await fetch(cfg.endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(85000),
      headers,
      body: JSON.stringify({
        model: cfg.model,
        input: text,
        voice,
        lang_code: cfg.langCode,
        response_format: 'mp3',
      }),
    })
  } catch (err) {
    throw new Error(`voice-mode: ${label} TTS request failed: ` + (err instanceof Error ? err.message : String(err)))
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    const hint = response.status === 401 || response.status === 403 ? AUTH_HINT : ''
    throw new Error(`voice-mode: ${label} TTS returned HTTP ${String(response.status)}: ${detail.slice(0, 300)}${hint}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

// Default voice supplied by the optional Piper runtime.
const LOCAL_TTS_FALLBACK_VOICE = 'paola'

function writeJson(res: { writeHead: (code: number, headers: Record<string, string>) => void, end: (body: string) => void }, status: number, value: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(value))
}

export function apply(ctx: Context, config: VoiceModeConfig): void {
  const webServer = ctx.get('webServer') as { register: (route: unknown) => () => void } | undefined
  if (!webServer) return


  // Plain HTTP settings read/write for the client's own Settings > Plugins >
  // Voice Mode tab (client.js's VoiceModeEndpointSettings) - same
  // webServer.register() convention as every other route in this file, no
  // Typert (see this file's own module comment for why). GET returns the
  // current settings with role('secret') fields (apiKey) redacted, plus a
  // `secrets` sidecar recording which ones are currently set, so the form
  // can render a write-only placeholder without ever receiving the key
  // itself. POST accepts a partial patch merged into the stored settings
  // (deep-merged per key - see @deepseek-ai/dsh-settings's mergeLayers) -
  // callers must omit an apiKey field entirely to leave it unchanged, never
  // resend the redacted placeholder.
  const settingsDisposer = webServer.register({
    kind: 'exact',
    path: '/dsh-voice-mode-api/settings',
    async handler(req: AsyncIterable<Buffer> & { method?: string }, res: Parameters<typeof writeJson>[0]) {
      try {
        if (req.method === 'POST') {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk)
          const patch = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Partial<VoiceModeSettings>
          const settingsForms = ctx.get('settings')
          const entryId = ctx.fiber.entry?.options.id
          if (settingsForms === undefined || entryId === undefined) throw new Error('voice-mode: settings are not editable in this deployment')
          await settingsForms.update(entryId, patch)
          writeJson(res, 200, { ok: true })
          return
        }
        writeJson(res, 200, redactSecrets(VoiceModeSettingsSchema as never, currentSettings(config)))
      } catch (err) {
        writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
      }
    },
  })
  ctx.effect(() => settingsDisposer, 'voice-mode: settings route')

  const disposer = webServer.register({
    kind: 'exact',
    path: '/dsh-voice-mode-api/transcribe',
    async handler(req: AsyncIterable<Buffer> & { headers: Record<string, string | string[] | undefined> }, res: Parameters<typeof writeJson>[0]) {
      try {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk)
        const body = Buffer.concat(chunks)
        const contentType = req.headers['content-type']
        const mime = typeof contentType === 'string' ? contentType : 'audio/wav'
        const sttProvider = resolveSttProvider(req.headers['x-voice-mode-stt-provider'])
        const settings = currentSettings(config)
        const text = sttProvider === 'cloud' ? await transcribeCloud(body, mime, settings) : await transcribeLocal(body, mime, settings)
        writeJson(res, 200, { text })
      } catch (err) {
        writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
      }
    },
  })
  ctx.effect(() => disposer, 'voice-mode: transcribe route')

  const toggleDisposer = webServer.register({
    kind: 'exact',
    path: '/dsh-voice-mode-api/toggle',
    async handler(req: AsyncIterable<Buffer>, res: Parameters<typeof writeJson>[0]) {
      try {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk)
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { sessionId?: unknown, active?: unknown, presetMode?: unknown }
        const sessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId : ''
        if (!sessionId) { writeJson(res, 400, { error: 'sessionId is required' }); return }
        if (parsed.active) activeSessions.set(sessionId, true)
        else activeSessions.delete(sessionId)
        if (parsed.presetMode === 'chat' || parsed.presetMode === 'task') presetModeSessions.set(sessionId, parsed.presetMode)
        writeJson(res, 200, { ok: true })
      } catch (err) {
        writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
      }
    },
  })
  ctx.effect(() => toggleDisposer, 'voice-mode: toggle route')

  const speakDisposer = webServer.register({
    kind: 'exact',
    path: '/dsh-voice-mode-api/speak',
    async handler(req: AsyncIterable<Buffer>, res: Parameters<typeof writeJson>[0] & { end: (body: Buffer | string) => void }) {
      try {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk)
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { text?: unknown, voice?: unknown, provider?: unknown, localVoice?: unknown }
        const text = typeof parsed.text === 'string' ? parsed.text.trim() : ''
        if (!text) { writeJson(res, 400, { error: 'text is required' }); return }
        const voice = typeof parsed.voice === 'string' && parsed.voice ? parsed.voice : 'en-US-AvaNeural'
        const localVoice = typeof parsed.localVoice === 'string' && parsed.localVoice ? parsed.localVoice : LOCAL_TTS_FALLBACK_VOICE
        const useLocal = parsed.provider === 'local'
        const settings = currentSettings(config)
        let audio: Buffer
        if (useLocal) {
          audio = await synthesizeOpenAiCompatibleTts(text, settings.ttsLocal, localVoice, 'local')
        } else if (settings.ttsCloud.endpoint) {
          audio = await synthesizeOpenAiCompatibleTts(text, settings.ttsCloud, voice, 'cloud')
        } else {
          throw new Error('Configure a speech endpoint in Settings → Plugins → Voice Mode')
        }
        res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': String(audio.length) })
        res.end(audio)
      } catch (err) {
        writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
      }
    },
  })
  ctx.effect(() => speakDisposer, 'voice-mode: speak route')

  const sectionDisposer = ctx.systemPrompt.section({
    name: 'voice-mode:instructions',
    order: 150,
    text: (context) => {
      if (context.agent === undefined) return ''
      const sessionId = context.agent.session.id
      if (!activeSessions.get(sessionId)) return ''
      return voiceModeSectionText(presetModeSessions.get(sessionId) === 'chat' ? 'chat' : 'task')
    },
  })
  ctx.effect(() => sectionDisposer, 'voice-mode: system-prompt section')
}
