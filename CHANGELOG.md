# Changelog

## 0.1.1 — 2026-10-30

- Recover no-op submissions without depending on another session event.
- Respect durable turn completion and delayed final chat updates.
- Read same-turn continuations after approval without discarding them as old replies.
- Ignore old-source media events; report playback/synthesis failures; bound approval announcements.
- Extend audio request timeout through body consumption and cancel stale responses.
- Select Italian rather than English in alternate speech mode for Italian text.
- Optional local Kokoro Italian voices and punctuation/Markdown-aware speech text.
- Regression cases reproduced against the previous release.


## 0.1.0 — 2026-10-30

- Independent distribution derived from ZG2017 Voice Loop 0.3.0.
- Inline dock preserves native chat, tools and exposed Think output.
- Compatibility adapter for DSH 0.2.0-rc.2 session/chat snapshots.
- Continuous microphone, pause detection, automatic submission and spoken interruption.
- Listening recovery after replies, synthesis failure, interruption and terminal agent errors.
- Optional isolated Italian/English Whisper/Piper runtime with pinned model revisions.
- Local defaults, explicit remote endpoints, no implicit Edge fallback or ambient API-key lookup.
- Portable regression tests and release documentation.
