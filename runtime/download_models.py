"""Download model files only when the user runs runtime setup."""
import argparse
from pathlib import Path
import shutil
import hashlib
import urllib.request
from huggingface_hub import hf_hub_download, snapshot_download

WHISPER_REVISION = 'edaa852ec7e145841d8ffdb056a99866b5f0a478'
KOKORO_ASSETS = [('kokoro-v1.0.onnx', 'beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a'), ('voices-v1.0.bin', 'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d')]
PIPER_REVISION = '5041a7a49ae5b3a0f30e6837769eb03fdbb231bd'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir',type=Path,required=True)
    parser.add_argument('--tts', choices=['piper', 'kokoro'], default='piper')
    args = parser.parse_args()
    print('Downloading Whisper large-v3 (~3 GB) and Piper voices (~127 MB). See NOTICE.md for model licenses.')
    snapshot_download('Systran/faster-whisper-large-v3',revision=WHISPER_REVISION,allow_patterns=['model.bin','config.json','tokenizer.json','vocabulary.json','preprocessor_config.json','README.md'])
    target = args.data_dir / 'models'
    target.mkdir(parents=True,exist_ok=True)
    for stem in ['it/it_IT/paola/medium/it_IT-paola-medium','en/en_US/lessac/medium/en_US-lessac-medium']:
        for extension in ['.onnx','.onnx.json']:
            downloaded = hf_hub_download('rhasspy/piper-voices',stem+extension,revision=PIPER_REVISION)
            shutil.copyfile(downloaded,target/(Path(stem).name+extension))
        card = hf_hub_download('rhasspy/piper-voices',str(Path(stem).parent/'MODEL_CARD'),revision=PIPER_REVISION)
        shutil.copyfile(card,target/(Path(stem).name+'-MODEL_CARD.txt'))
    if args.tts == 'kokoro':
        for name, expected in KOKORO_ASSETS:
            destination = target / name
            if destination.exists() and hashlib.sha256(destination.read_bytes()).hexdigest() == expected:
                continue
            temporary = destination.with_suffix(destination.suffix + '.part')
            try:
                urllib.request.urlretrieve('https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/' + name, temporary)
                if hashlib.sha256(temporary.read_bytes()).hexdigest() != expected:
                    raise RuntimeError('Model checksum mismatch: ' + name)
                temporary.replace(destination)
            finally:
                temporary.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
