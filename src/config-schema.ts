/** Live endpoint configuration; defaults use the optional local backend. */
import type { Volatile } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'

/** One swappable STT or TTS endpoint: where to call, which model, and how to authenticate. */
export interface VoiceModeEndpointConfig {
  endpoint: string
  model: string
  apiKey: string
}

export interface VoiceModeSettings {
  sttLocal: VoiceModeEndpointConfig
  sttCloud: VoiceModeEndpointConfig
  ttsLocal: VoiceModeEndpointConfig & { langCode: string }
  ttsCloud: VoiceModeEndpointConfig
}

export const DEFAULT_VOICE_MODE_SETTINGS: VoiceModeSettings = {
  sttLocal: {
    endpoint: 'http://127.0.0.1:8766/v1/audio/transcriptions',
    model: 'whisper-large-v3',
    apiKey: '',
  },
  sttCloud: {
    endpoint: 'http://127.0.0.1:8766/v1/audio/transcriptions',
    model: 'whisper-large-v3',
    apiKey: '',
  },
  ttsLocal: {
    endpoint: 'http://127.0.0.1:8766/v1/audio/speech',
    model: 'piper-it-en',
    apiKey: '',
    langCode: 'it',
  },
  ttsCloud: { endpoint: 'http://127.0.0.1:8766/v1/audio/speech', model: 'piper-it-en', apiKey: '' },
}

const STT_CONTRACT_NOTE = 'Contract: POST multipart/form-data with fields "file" (the recorded audio) and "model"; must respond 200 with JSON {"text": string}. '
  + 'Any OpenAI-compatible /audio/transcriptions server satisfies this, not just Qwen3-ASR.'

const TTS_CONTRACT_NOTE = 'Contract: POST JSON {model, input, voice, lang_code, response_format:"mp3"}; must respond 200 with raw audio bytes (mp3). '
  + 'Any OpenAI-compatible /audio/speech server satisfies this, not just Qwen3-TTS.'

function endpointConfigSchema(defaults: VoiceModeEndpointConfig, apiKeyDescription: string) {
  return s.object({
    endpoint: s.string().default(defaults.endpoint).description('Full URL to POST to'),
    model: s.string().default(defaults.model).description('Model id sent in the request'),
    apiKey: s.string().role('secret').default(defaults.apiKey).description(apiKeyDescription),
  })
}

export const VoiceModeSettingsSchema: s<VoiceModeSettings> = s.object({
  sttLocal: endpointConfigSchema(DEFAULT_VOICE_MODE_SETTINGS.sttLocal, 'Bearer token, if the server requires one')
    .description(`Local speech-recognition backend (default: local Whisper). ${STT_CONTRACT_NOTE}`)
    .collapse(),
  sttCloud: endpointConfigSchema(DEFAULT_VOICE_MODE_SETTINGS.sttCloud, 'Bearer token, if the server requires one')
    .description(`Cloud speech-recognition backend (default: local Whisper; configure a remote endpoint explicitly). ${STT_CONTRACT_NOTE}`)
    .collapse(),
  ttsLocal: s.object({
    endpoint: s.string().default(DEFAULT_VOICE_MODE_SETTINGS.ttsLocal.endpoint).description('Full URL to POST to'),
    model: s.string().default(DEFAULT_VOICE_MODE_SETTINGS.ttsLocal.model).description('Model id sent in the request'),
    apiKey: s.string().role('secret').default(DEFAULT_VOICE_MODE_SETTINGS.ttsLocal.apiKey).description('Bearer token, if the server requires one'),
    langCode: s.string().default(DEFAULT_VOICE_MODE_SETTINGS.ttsLocal.langCode)
      .description('lang_code field sent to the endpoint (a Qwen3-TTS-CustomVoice convention; other servers will just ignore it)'),
  })
    .description(`Local speech-synthesis backend (default: local Piper). ${TTS_CONTRACT_NOTE}`)
    .collapse(),
  ttsCloud: endpointConfigSchema(DEFAULT_VOICE_MODE_SETTINGS.ttsCloud, 'Bearer token, if the server requires one')
    .description(`Optional cloud speech-synthesis backend, same contract as ttsLocal. An endpoint must be configured explicitly. ${TTS_CONTRACT_NOTE}`)
    .collapse(),
})

/** The plugin Config: every endpoint block is live-editable through Settings. */
export interface VoiceModeConfig {
  sttLocal: Volatile<VoiceModeSettings['sttLocal']>
  sttCloud: Volatile<VoiceModeSettings['sttCloud']>
  ttsLocal: Volatile<VoiceModeSettings['ttsLocal']>
  ttsCloud: Volatile<VoiceModeSettings['ttsCloud']>
}

const fields = VoiceModeSettingsSchema.dict as { [K in keyof VoiceModeSettings]: s<VoiceModeSettings[K]> }

export const VoiceModeConfigSchema = s.object({
  sttLocal: fields.sttLocal.volatile(),
  sttCloud: fields.sttCloud.volatile(),
  ttsLocal: fields.ttsLocal.volatile(),
  ttsCloud: fields.ttsCloud.volatile(),
})

/**
 * Read the current settings as one plain snapshot.
 * @param config - the plugin's live Config references.
 * @returns the four endpoint blocks as of this call.
 */
export function currentSettings(config: VoiceModeConfig): VoiceModeSettings {
  return {
    sttLocal: { ...config.sttLocal.get() },
    sttCloud: { ...config.sttCloud.get() },
    ttsLocal: { ...config.ttsLocal.get() },
    ttsCloud: { ...config.ttsCloud.get() },
  }
}
