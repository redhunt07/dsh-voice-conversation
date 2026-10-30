"""Download model files only when the user runs runtime setup."""
import argparse
from pathlib import Path
import shutil
from huggingface_hub import hf_hub_download, snapshot_download

WHISPER_REVISION = 'edaa852ec7e145841d8ffdb056a99866b5f0a478'
PIPER_REVISION = '5041a7a49ae5b3a0f30e6837769eb03fdbb231bd'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir',type=Path,required=True)
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

if __name__ == '__main__':
    main()
