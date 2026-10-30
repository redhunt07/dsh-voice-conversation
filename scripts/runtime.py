#!/usr/bin/env python3
"""Explicit, isolated runtime setup. No npm install lifecycle hooks or services."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request

PACKAGE = Path(__file__).resolve().parent.parent
DEFAULT_DATA = Path(os.environ.get('DSH_VOICE_DATA', Path.home() / '.local/share/dsh-voice-conversation')).expanduser()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['setup', 'start', 'doctor'])
    parser.add_argument('--data-dir', type=Path, default=DEFAULT_DATA)
    parser.add_argument('--device', choices=['cpu', 'cuda'], default=None)
    parser.add_argument('--port', type=int, default=8766)
    parser.add_argument('--tts', choices=['piper','kokoro'], default=None)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('port must be between 1 and 65535')
    data = args.data_dir.expanduser().resolve()
    python = data / 'venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    config_file = data / 'config.json'
    config = json.loads(config_file.read_text()) if config_file.exists() else {}
    device = args.device or config.get('device', 'cpu')
    tts = args.tts or config.get('tts', 'piper')
    if args.action == 'doctor':
        checks = {'data_dir': str(data), 'python_environment': python.is_file(), 'ffmpeg': bool(shutil.which('ffmpeg')), 'uv': bool(shutil.which('uv')), 'configured': bool(config), 'device': device, 'tts': tts}
        for name in ['it_IT-paola-medium.onnx','en_US-lessac-medium.onnx']:
            checks[name] = (data / 'models' / name).is_file() and (data / 'models' / (name+'.json')).is_file()
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{args.port}/health', timeout=2) as reply:
                checks['service'] = json.load(reply)
        except Exception:
            checks['service'] = 'not reachable'
        if tts == 'kokoro':
            checks['kokoro_models'] = all((data/'models'/name).is_file() for name in ['kokoro-v1.0.onnx','voices-v1.0.bin'])
        print(json.dumps(checks, indent=2))
        return 0 if checks['python_environment'] and checks['ffmpeg'] and checks['configured'] and checks.get('kokoro_models', True) and all(checks[n] for n in ['it_IT-paola-medium.onnx','en_US-lessac-medium.onnx']) else 1
    if args.action == 'setup':
        uv = shutil.which('uv')
        if not uv:
            parser.error('Install uv first (https://docs.astral.sh/uv/getting-started/installation/). No global tools are installed by this script.')
        if not shutil.which('ffmpeg'):
            parser.error('Install ffmpeg and put it on PATH before setup.')
        data.mkdir(parents=True, exist_ok=True)
        if not python.exists():
            subprocess.run([uv,'venv','--python','3.12',str(data/'venv')],check=True)
        requirements = 'requirements-cuda.lock' if device == 'cuda' else 'requirements.lock'
        install = [uv,'pip','sync','--python',str(python),str(PACKAGE/'runtime'/requirements)]
        if tts == 'kokoro': install.append(str(PACKAGE/'runtime/requirements-kokoro.lock'))
        subprocess.run(install,check=True)
        subprocess.run([str(python),str(PACKAGE/'runtime/download_models.py'),'--data-dir',str(data),'--tts',tts],check=True)
        config_file.write_text(json.dumps({'device':device, 'tts':tts},indent=2)+'\n')
        print('Ready. Start with: python3 scripts/runtime.py start --data-dir '+str(data))
        return 0
    if not python.exists() or not config:
        parser.error('Run setup first, or select an existing --data-dir.')
    env = dict(os.environ, DSH_VOICE_DATA=str(data), DSH_VOICE_DEVICE=device, DSH_VOICE_PORT=str(args.port), DSH_VOICE_TTS=tts, HF_HUB_OFFLINE='1')
    return subprocess.call([str(python),str(PACKAGE/'runtime/run.py')],env=env)

if __name__ == '__main__':
    sys.exit(main())
