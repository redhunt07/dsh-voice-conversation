# DSH Voice Conversation 0.1.1

Maintained by **RedHunt07**, under **MIT**. Independent fork of ZG2017 Voice Loop, with original notices preserved.

Continuous Italian/English voice conversations for the DSH web profile:

- Automatic prompt submission after 1.7 seconds of silence.
- Persistent microphone and return to listening after final replies.
- Inline dock preserving native chat, tool activity and exposed Think output.
- Spoken interruption, synthesis-error recovery and playback watchdog.
- Optional local Whisper large-v3 / Piper backend with an isolated Python environment.
- Local defaults; remote speech endpoints require explicit configuration.

Tested with **DSH 0.2.0-rc.2**, Node.js 22+ and Linux. Automated microphone/media simulations cover repeated turns and failure recovery. A second local backend passed synthetic Italian/English speech round-trips. Real-room microphone acceptance and other DSH/OS versions still need validation. Initial release, not a claim of universal compatibility.

See README.md / README.it.md for installation, runtime setup and privacy details. Models and runtime environments are downloaded separately and retain their own licenses; see NOTICE.md.
