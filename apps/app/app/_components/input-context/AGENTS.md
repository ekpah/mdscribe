# Shared Input Context Guidance

Scope: shared AIScribe/template audio, document, and text input controls in this directory.

- This directory owns high-level recorder, playback, file, and text-context UX. Pass behavior into design-system primitives through render props; do not move it into `packages/design-system`.
- The production AIScribe input is canonical; playground/admin inputs reuse it or a direct extraction rather than maintaining simplified copies.
- Keep orchestration/submission in `InputContextControls`; tab content stays in `audio-input.tsx`, `document-input.tsx`, and `text-input.tsx`.
- Register hotkeys once in `InputContextControls`: `Cmd/Ctrl+Shift+1` focuses main input, `Cmd/Ctrl+Shift+2` opens audio/toggles recording, and `Cmd/Ctrl+Enter` submits. Never use `Cmd/Ctrl+Shift+M`.
- Panels mount lazily on first open and remain CSS-hidden afterward so recordings survive switches. Do not mount audio eagerly because `MicSelector` requests permission on mount. Show a pulsing Solarized-red dot while recording.
- `LiveWaveform` owns the mic stream. Its stream effect depends only on active/device/audio config and reads callbacks through latest refs; `AudioInput` stream callbacks must remain identity-stable.
- Preserve original browser recordings plus truthful fallbacks. Firefox local blobs use Web Audio decoding/playback for reliable seeking; never fake MIME types.
- Sanitize unresolved duration/time before assigning `HTMLMediaElement.currentTime`; never seek with `NaN` or infinity.
- File drops anywhere on controls, toolbar, or portaled panels call `controller.addContextFiles`, with the highlight covering every accepting region.
- Avoid nested scrolling on desktop: panels have stable minimum height and content grows with the page. The main text entry owns its border/focus ring. Mobile text overlays remain height-constrained and scrollable so actions stay reachable.
