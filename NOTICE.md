# Attribution and third-party components

Maintained by **RedHunt07**.

Independent fork of [ZG2017/dsh-plugin-voice-loop](https://github.com/ZG2017/dsh-plugin-voice-loop), commit `8183183a858366c56a2c37dea3757ae8100efb8d` (version 0.3.0). Original author: ZG2017. The original MIT notice is preserved in LICENSE. Changes: inline dock, DSH snapshot adapter, Italian/English defaults, turn recovery, bounded media operations, local backend and distribution tooling. This is not an official DeepSeek product and is not distributed under the upstream npm namespace.

Plugin source and new integration scripts use the MIT terms in LICENSE. Dependencies and models retain their own licenses. Their binaries and weights are excluded from this archive. Optional backend setup downloads:

- [faster-whisper](https://github.com/SYSTRAN/faster-whisper), MIT, and [CTranslate2](https://github.com/OpenNMT/CTranslate2), MIT.
- [Piper](https://github.com/OHF-Voice/piper1-gpl), GPL-3.0. Installed as an optional backend dependency; this project does not relicense Piper as MIT.
- [Whisper large-v3 conversion](https://huggingface.co/Systran/faster-whisper-large-v3), revision `edaa852ec7e145841d8ffdb056a99866b5f0a478`. See its model card and the original [Whisper license](https://github.com/openai/whisper/blob/main/LICENSE).
- Piper voices from revision `5041a7a49ae5b3a0f30e6837769eb03fdbb231bd`: consult the [Paola model card](https://huggingface.co/rhasspy/piper-voices/blob/5041a7a49ae5b3a0f30e6837769eb03fdbb231bd/it/it_IT/paola/medium/MODEL_CARD) and [Lessac model card](https://huggingface.co/rhasspy/piper-voices/blob/5041a7a49ae5b3a0f30e6837769eb03fdbb231bd/en/en_US/lessac/medium/MODEL_CARD). Setup preserves both cards beside the models. Voice datasets and trained models may have different terms.
- Optional NVIDIA wheels remain subject to NVIDIA licenses. ffmpeg is a separately installed dependency, under the terms of the user's build.

Model weights and runtime environments are not covered by the plugin's MIT license. Each upstream distribution provides its complete notices and source.

Optional Kokoro backend added in 0.1.1: [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) is MIT; [Kokoro model weights](https://huggingface.co/hexgrad/Kokoro-82M) are Apache-2.0. [espeak-ng](https://github.com/espeak-ng/espeak-ng) data/library delivered through espeakng-loader remain subject to their own GPL terms. None of these binaries/weights are bundled in this npm package. Setup downloads the model and voice bank separately from the upstream model-files-v1.1 release and verifies pinned SHA-256 values. See upstream licenses and VOICES.md for voice information.
