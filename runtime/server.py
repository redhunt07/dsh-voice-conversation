"""Local Italian/English speech backend for DSH Voice Loop. Audio stays in RAM."""
import asyncio
import io
import logging
import os
from pathlib import Path
import subprocess
import shutil
import threading
import time
import wave
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from huggingface_hub import snapshot_download
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio
import numpy as np
from piper import PiperVoice

ROOT = Path(os.environ.get('DSH_VOICE_DATA', Path.home() / '.local/share/dsh-voice-conversation')).expanduser()
DEVICE = os.environ.get('DSH_VOICE_DEVICE', 'cpu')
COMPUTE = os.environ.get('DSH_VOICE_COMPUTE', 'float16' if DEVICE == 'cuda' else 'int8')
MODEL = os.environ.get('DSH_VOICE_MODEL', 'Systran/faster-whisper-large-v3')
FFMPEG = os.environ.get('DSH_VOICE_FFMPEG') or shutil.which('ffmpeg')
MAX_AUDIO_BYTES = 12 * 1024 * 1024
MAX_AUDIO_SECONDS = 125
log = logging.getLogger('dsh-voice')
stt_lock = threading.Lock()
tts_lock = threading.Lock()
state = {'ready': False, 'device': None, 'transcriptions': 0, 'syntheses': 0, 'last_inference_seconds': None}
whisper = None
voices = {}

@asynccontextmanager
async def lifespan(app):
    global whisper
    if not FFMPEG:
        raise RuntimeError("ffmpeg is required on PATH")
    # Separate env: no changes to Python environments of other applications.
    model_path = MODEL if Path(MODEL).is_dir() else snapshot_download(MODEL, revision='edaa852ec7e145841d8ffdb056a99866b5f0a478', local_files_only=True)
    whisper = WhisperModel(model_path, device=DEVICE, compute_type=COMPUTE, cpu_threads=4, num_workers=1, local_files_only=True)
    voices['it'] = PiperVoice.load(str(ROOT / 'models/it_IT-paola-medium.onnx'))
    voices['en'] = PiperVoice.load(str(ROOT / 'models/en_US-lessac-medium.onnx'))
    # Force CUDA kernels to load before the first microphone utterance.
    segments, _ = whisper.transcribe(np.zeros(16000, dtype=np.float32), language='it', beam_size=1)
    list(segments)
    state.update(ready=True, device=f'{DEVICE}-{COMPUTE}')
    log.info('Ready: Local Whisper and Piper Italian/English loaded. No audio or transcript logging.')
    yield
    state['ready'] = False

app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)

@app.middleware('http')
async def host_and_origin(request: Request, call_next):
    if request.headers.get('host', '').split(':')[0] not in ('127.0.0.1', 'localhost'):
        return Response(status_code=403)
    # Only the local DSH host calls these endpoints; browser origins are unnecessary.
    if request.headers.get('origin'):
        return Response(status_code=403)
    try:
        if int(request.headers.get('content-length', '0')) > MAX_AUDIO_BYTES + 65536:
            return Response('Audio troppo lungo', status_code=413)
    except ValueError:
        return Response(status_code=400)
    return await call_next(request)

@app.get('/health')
def health():
    return {**state, 'stt_model': 'large-v3', 'languages': ['it', 'en'], 'tts': 'piper-local', 'audio_storage': 'none'}

def transcribe(data: bytes, requested_language: str):
    audio = decode_audio(io.BytesIO(data), sampling_rate=16000)
    if len(audio) > 16000 * MAX_AUDIO_SECONDS:
        raise ValueError('Una frase non può superare 125 secondi')
    if len(audio) < 4000 or float(np.sqrt(np.mean(audio * audio))) < 0.001:
        return {'text': '', 'language': 'it', 'duration': len(audio) / 16000}
    started = time.perf_counter()
    with stt_lock:
        if requested_language in ('it', 'en'):
            language = requested_language
        else:
            # Rank the two languages requested by the user; short commands must not
            # spuriously switch to Spanish or another language with a similar sound.
            _, _, probabilities = whisper.detect_language(audio=audio, vad_filter=True)
            choices = [(lang, score) for lang, score in probabilities if lang in ('it', 'en')]
            language = max(choices, key=lambda item: item[1])[0] if choices else 'it'
        segments, info = whisper.transcribe(audio, language=language, beam_size=3, temperature=0.0, condition_on_previous_text=False, vad_filter=True, vad_parameters={'min_silence_duration_ms': 350, 'speech_pad_ms': 250}, initial_prompt='DSH, DeepSeek, Zabbix, Codex, Linux, browser, workspace, plugin, GitHub.', no_speech_threshold=0.6)
        text = ' '.join(s.text.strip() for s in segments if s.no_speech_prob < 0.85).strip()
    elapsed = time.perf_counter() - started
    state['transcriptions'] += 1
    state['last_inference_seconds'] = round(elapsed, 3)
    return {'text': text, 'language': language, 'duration': round(info.duration, 3), 'inference_seconds': round(elapsed, 3)}

@app.post('/v1/audio/transcriptions')
async def audio_transcriptions(request: Request, file: UploadFile = File(...), model: str = Form('whisper-large-v3'), language: str = Form('auto')):
    data = await file.read(MAX_AUDIO_BYTES + 1)
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(413, 'Audio troppo lungo')
    language = request.query_params.get('language', language)
    try:
        return await asyncio.to_thread(transcribe, data, language)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    except Exception as error:
        log.exception('Transcription failed: %s', type(error).__name__)
        raise HTTPException(500, 'Trascrizione non riuscita; controllare il servizio dsh-voice') from error

def synthesize(text: str, language: str):
    buffer = io.BytesIO()
    with tts_lock:
        with wave.open(buffer, 'wb') as wav_file:
            voices[language].synthesize_wav(text, wav_file)
    result = subprocess.run([FFMPEG, '-nostdin', '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-f', 'mp3', '-b:a', '64k', 'pipe:1'], input=buffer.getvalue(), capture_output=True, timeout=60, check=True)
    state['syntheses'] += 1
    return result.stdout

@app.post('/v1/audio/speech')
async def audio_speech(request: Request):
    body = await request.json()
    text = str(body.get('input', '')).strip()
    if not text or len(text) > 12000:
        raise HTTPException(400, 'Testo vuoto o troppo lungo')
    voice = str(body.get('voice', '')).lower()
    lang = 'en' if voice in ('lessac', 'en', 'en-us-arianeural', 'en-us-avaneural') else 'it'
    audio = await asyncio.to_thread(synthesize, text, lang)
    return Response(audio, media_type='audio/mpeg', headers={'Cache-Control': 'no-store'})
