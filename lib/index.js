// src/index.ts
import { redactSecrets } from "@deepseek-ai/dsh-settings";

// src/config-schema.ts
import s from "@deepseek-ai/schemastery";
var DEFAULT_VOICE_MODE_SETTINGS = {
  sttLocal: {
    endpoint: "http://127.0.0.1:8766/v1/audio/transcriptions",
    model: "whisper-large-v3",
    apiKey: ""
  },
  sttCloud: {
    endpoint: "http://127.0.0.1:8766/v1/audio/transcriptions",
    model: "whisper-large-v3",
    apiKey: ""
  },
  ttsLocal: {
    endpoint: "http://127.0.0.1:8766/v1/audio/speech",
    model: "piper-it-en",
    apiKey: "",
    langCode: "it"
  },
  ttsCloud: { endpoint: "http://127.0.0.1:8766/v1/audio/speech", model: "piper-it-en", apiKey: "" }
};
var STT_CONTRACT_NOTE = 'Contract: POST multipart/form-data with fields "file" (the recorded audio) and "model"; must respond 200 with JSON {"text": string}. Any OpenAI-compatible /audio/transcriptions server satisfies this, not just Qwen3-ASR.';
var TTS_CONTRACT_NOTE = 'Contract: POST JSON {model, input, voice, lang_code, response_format:"mp3"}; must respond 200 with raw audio bytes (mp3). Any OpenAI-compatible /audio/speech server satisfies this, not just Qwen3-TTS.';
function endpointConfigSchema(defaults, apiKeyDescription) {
  return s.object({
    endpoint: s.string().default(defaults.endpoint).description("Full URL to POST to"),
    model: s.string().default(defaults.model).description("Model id sent in the request"),
    apiKey: s.string().role("secret").default(defaults.apiKey).description(apiKeyDescription)
  });
}
var VoiceModeSettingsSchema = s.object({
  sttLocal: endpointConfigSchema(DEFAULT_VOICE_MODE_SETTINGS.sttLocal, "Bearer token, if the server requires one").description(`Local speech-recognition backend (default: local Whisper). ${STT_CONTRACT_NOTE}`).collapse(),
  sttCloud: endpointConfigSchema(DEFAULT_VOICE_MODE_SETTINGS.sttCloud, "Bearer token, if the server requires one").description(`Cloud speech-recognition backend (default: local Whisper; configure a remote endpoint explicitly). ${STT_CONTRACT_NOTE}`).collapse(),
  ttsLocal: s.object({
    endpoint: s.string().default(DEFAULT_VOICE_MODE_SETTINGS.ttsLocal.endpoint).description("Full URL to POST to"),
    model: s.string().default(DEFAULT_VOICE_MODE_SETTINGS.ttsLocal.model).description("Model id sent in the request"),
    apiKey: s.string().role("secret").default(DEFAULT_VOICE_MODE_SETTINGS.ttsLocal.apiKey).description("Bearer token, if the server requires one"),
    langCode: s.string().default(DEFAULT_VOICE_MODE_SETTINGS.ttsLocal.langCode).description("lang_code field sent to the endpoint (a Qwen3-TTS-CustomVoice convention; other servers will just ignore it)")
  }).description(`Local speech-synthesis backend (default: local Piper). ${TTS_CONTRACT_NOTE}`).collapse(),
  ttsCloud: endpointConfigSchema(DEFAULT_VOICE_MODE_SETTINGS.ttsCloud, "Bearer token, if the server requires one").description(`Optional cloud speech-synthesis backend, same contract as ttsLocal. An endpoint must be configured explicitly. ${TTS_CONTRACT_NOTE}`).collapse()
});
var fields = VoiceModeSettingsSchema.dict;
var VoiceModeConfigSchema = s.object({
  sttLocal: fields.sttLocal.volatile(),
  sttCloud: fields.sttCloud.volatile(),
  ttsLocal: fields.ttsLocal.volatile(),
  ttsCloud: fields.ttsCloud.volatile()
});
function currentSettings(config) {
  return {
    sttLocal: { ...config.sttLocal.get() },
    sttCloud: { ...config.sttCloud.get() },
    ttsLocal: { ...config.ttsLocal.get() },
    ttsCloud: { ...config.ttsCloud.get() }
  };
}

// src/index.ts
var STT_PROVIDER_DEFAULT = String(process.env.VOICE_MODE_STT_PROVIDER || "local").trim();
function resolveSttProvider(headerValue) {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed === "local" || trimmed === "cloud" ? trimmed : STT_PROVIDER_DEFAULT;
}
var TASK_MODE_SPOKEN_LENGTH_HINT = "a couple of short sentences - about 80-120 Chinese characters, or ~30-45 English words, whichever the language calls for";
var CHAT_MODE_SPOKEN_LENGTH_HINT = "no more than 1-2 short sentences - about 40-60 Chinese characters, or ~15-20 English words, whichever the language calls for";
var VOICE_MODE_SECTION_BASE = `You are currently in a live voice conversation with the user (voice mode: your reply will be read aloud, not displayed as text). Answer briefly and conversationally - no markdown lists, headings, tables, or code blocks; nothing that only makes sense written down. Keep your reply to ${TASK_MODE_SPOKEN_LENGTH_HINT} - this is read aloud, not read on a screen, so length matters more than in text chat. Reply in the same language the user just spoke in.`;
var VOICE_MODE_CHAT_PRESET_ADDITION = ` You are in Chat preset mode: this is casual conversation, not task work. Prioritize a fast, natural reply over thoroughness - answer from what you already know rather than reaching for tools, web search, file edits, or multi-step research unless the user's request genuinely can't be answered without one. Keep replies especially short - ${CHAT_MODE_SPOKEN_LENGTH_HINT}, the length of a real spoken remark.`;
function voiceModeSectionText(presetMode) {
  return presetMode === "chat" ? VOICE_MODE_SECTION_BASE + VOICE_MODE_CHAT_PRESET_ADDITION : VOICE_MODE_SECTION_BASE;
}
var activeSessions = /* @__PURE__ */ new Map();
var presetModeSessions = /* @__PURE__ */ new Map();
var name = "voice-conversation";
var inject = ["webServer", "systemPrompt"];
var Config = VoiceModeConfigSchema;
var AUTH_HINT = " - check the API key in Settings \u2192 Plugins \u2192 Voice Mode";
async function transcribeGeneric(audio, mime, cfg, label) {
  if (audio.byteLength === 0) throw new Error("voice-mode: recorded audio is empty");
  if (!cfg.endpoint) throw new Error(`voice-mode: ${label} STT endpoint is not configured - set one in Settings \u2192 Plugins \u2192 Voice Mode`);
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(audio)], { type: mime || "audio/wav" }), "audio.wav");
  form.set("model", cfg.model);
  const headers = {};
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  let response;
  try {
    response = await fetch(cfg.endpoint, { method: "POST", headers, body: form, signal: AbortSignal.timeout(85e3) });
  } catch (err) {
    throw new Error(`voice-mode: ${label} STT request failed: ` + (err instanceof Error ? err.message : String(err)));
  }
  const body = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`voice-mode: ${label} STT returned non-JSON response (HTTP ${String(response.status)})`);
  }
  if (!response.ok) {
    const hint = response.status === 401 || response.status === 403 ? AUTH_HINT : "";
    throw new Error(`voice-mode: ${label} STT request failed (HTTP ${String(response.status)}): ${body.slice(0, 300)}${hint}`);
  }
  if (typeof parsed !== "object" || parsed === null || typeof parsed.text !== "string") {
    throw new Error(`voice-mode: ${label} STT returned no transcript`);
  }
  return parsed.text.trim();
}
async function transcribeLocal(audio, mime, settings) {
  return transcribeGeneric(audio, mime, settings.sttLocal, "local");
}
async function transcribeCloud(audio, mime, settings) {
  return transcribeGeneric(audio, mime, settings.sttCloud, "cloud");
}
async function synthesizeOpenAiCompatibleTts(text, cfg, voice, label) {
  if (!cfg.endpoint) throw new Error(`voice-mode: ${label} TTS endpoint is not configured - set one in Settings \u2192 Plugins \u2192 Voice Mode`);
  const headers = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  let response;
  try {
    response = await fetch(cfg.endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(85e3),
      headers,
      body: JSON.stringify({
        model: cfg.model,
        input: text,
        voice,
        lang_code: cfg.langCode,
        response_format: "mp3"
      })
    });
  } catch (err) {
    throw new Error(`voice-mode: ${label} TTS request failed: ` + (err instanceof Error ? err.message : String(err)));
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const hint = response.status === 401 || response.status === 403 ? AUTH_HINT : "";
    throw new Error(`voice-mode: ${label} TTS returned HTTP ${String(response.status)}: ${detail.slice(0, 300)}${hint}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
var LOCAL_TTS_FALLBACK_VOICE = "paola";
function writeJson(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}
function apply(ctx, config) {
  const webServer = ctx.get("webServer");
  if (!webServer) return;
  const settingsDisposer = webServer.register({
    kind: "exact",
    path: "/dsh-voice-mode-api/settings",
    async handler(req, res) {
      try {
        if (req.method === "POST") {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const patch = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const settingsForms = ctx.get("settings");
          const entryId = ctx.fiber.entry?.options.id;
          if (settingsForms === void 0 || entryId === void 0) throw new Error("voice-mode: settings are not editable in this deployment");
          await settingsForms.update(entryId, patch);
          writeJson(res, 200, { ok: true });
          return;
        }
        writeJson(res, 200, redactSecrets(VoiceModeSettingsSchema, currentSettings(config)));
      } catch (err) {
        writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
    }
  });
  ctx.effect(() => settingsDisposer, "voice-mode: settings route");
  const disposer = webServer.register({
    kind: "exact",
    path: "/dsh-voice-mode-api/transcribe",
    async handler(req, res) {
      try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        const contentType = req.headers["content-type"];
        const mime = typeof contentType === "string" ? contentType : "audio/wav";
        const sttProvider = resolveSttProvider(req.headers["x-voice-mode-stt-provider"]);
        const settings = currentSettings(config);
        const text = sttProvider === "cloud" ? await transcribeCloud(body, mime, settings) : await transcribeLocal(body, mime, settings);
        writeJson(res, 200, { text });
      } catch (err) {
        writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
    }
  });
  ctx.effect(() => disposer, "voice-mode: transcribe route");
  const toggleDisposer = webServer.register({
    kind: "exact",
    path: "/dsh-voice-mode-api/toggle",
    async handler(req, res) {
      try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId : "";
        if (!sessionId) {
          writeJson(res, 400, { error: "sessionId is required" });
          return;
        }
        if (parsed.active) activeSessions.set(sessionId, true);
        else activeSessions.delete(sessionId);
        if (parsed.presetMode === "chat" || parsed.presetMode === "task") presetModeSessions.set(sessionId, parsed.presetMode);
        writeJson(res, 200, { ok: true });
      } catch (err) {
        writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
    }
  });
  ctx.effect(() => toggleDisposer, "voice-mode: toggle route");
  const speakDisposer = webServer.register({
    kind: "exact",
    path: "/dsh-voice-mode-api/speak",
    async handler(req, res) {
      try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
        if (!text) {
          writeJson(res, 400, { error: "text is required" });
          return;
        }
        const voice = typeof parsed.voice === "string" && parsed.voice ? parsed.voice : "en-US-AvaNeural";
        const localVoice = typeof parsed.localVoice === "string" && parsed.localVoice ? parsed.localVoice : LOCAL_TTS_FALLBACK_VOICE;
        const useLocal = parsed.provider === "local";
        const settings = currentSettings(config);
        let audio;
        if (useLocal) {
          audio = await synthesizeOpenAiCompatibleTts(text, settings.ttsLocal, localVoice, "local");
        } else if (settings.ttsCloud.endpoint) {
          audio = await synthesizeOpenAiCompatibleTts(text, settings.ttsCloud, voice, "cloud");
        } else {
          throw new Error("Configure a speech endpoint in Settings \u2192 Plugins \u2192 Voice Mode");
        }
        res.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Length": String(audio.length) });
        res.end(audio);
      } catch (err) {
        writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
    }
  });
  ctx.effect(() => speakDisposer, "voice-mode: speak route");
  const sectionDisposer = ctx.systemPrompt.section({
    name: "voice-mode:instructions",
    order: 150,
    text: (context) => {
      if (context.agent === void 0) return "";
      const sessionId = context.agent.session.id;
      if (!activeSessions.get(sessionId)) return "";
      return voiceModeSectionText(presetModeSessions.get(sessionId) === "chat" ? "chat" : "task");
    }
  });
  ctx.effect(() => sectionDisposer, "voice-mode: system-prompt section");
}
export {
  Config,
  apply,
  inject,
  name
};
