# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Design docs: check for a vector source before rendering

`design/*.dc.html` are design-canvas documents and need the bundled `design/support.js` to
render. Whether their artwork has a vector source varies **per document — check the one you
are working from** (`grep -c '<svg' 'design/<doc>.dc.html'`) before deciding how to extract it.

- `design/Redesign.dc.html` does contain real inline `<svg>`/`<path>` artwork (the icon set):
  export those elements, do not screenshot them.
- `design/App Icon.dc.html` and `design/Current Screens.dc.html` are CSS-only (zero `<svg>`,
  `<path>`, `<canvas>`). Use `design/icon-source/README.md` for production icon regeneration;
  it maps each Android PNG to its dedicated vector source. Render the actual local design-canvas
  document with `design/support.js` and `chrome-devtools-axi` only for canvas artwork or review
  evidence that has no exported vector source. Screenshot at or above the target resolution and
  then downscale — never upscale or transcribe the geometry into a standalone page.

## Screen layout system

All four game screens are built from the primitives in `src/components/ui.tsx`
(`Screen` / `ScreenTop` / `Hero` / `Section` / `SectionHeader` / `Unit` / `Rail`), with spacing
from `S` in `src/theme.ts`. The rules those encode: one hero per screen, full-bleed and
borderless; section headers sit on the midnight ground; a border means "this is one genuine
unit". There is no global chrome band — each screen's `ScreenTop` carries the day plus, when
available, that screen's single piece of telemetry. Mono is machine telemetry, sans is
human-authored text.
Add to these primitives rather than hand-rolling per-screen boxes.

## Running the app on the simulator

`npx expo run:ios --device <udid> --port <free port>` — a dev-client `.app` already installed on
a simulator may be a *release* build with the JS bundled in, so deep-linking it at a Metro server
silently does nothing. To exercise rich game states without grinding, overwrite the persisted
zustand blob (key `ramen-profitable-v1`) in the app container's
`Library/Application Support/<bundle id>/RCTAsyncLocalStorage_V1/manifest.json`, then relaunch.

## Emoji boundary

UI chrome uses the drawn icons in `src/components/icons.tsx`. Chirp post text remains user-style
content and may keep emoji; event notifications and Chirp copies are separated by `GameEvent.text`
and `GameEvent.chirpText` in `src/content/content.ts`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
