# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Design docs: check for a vector source before rendering

`design/*.dc.html` are design-canvas documents and need the bundled `design/support.js` to
render. Whether their artwork has a vector source varies **per document — check the one you
are working from** (`grep -c '<svg' 'design/<doc>.dc.html'`) before deciding how to extract it.

- `design/Redesign.dc.html` does contain real inline `<svg>`/`<path>` artwork (the icon set):
  export those elements, do not screenshot them.
- `design/App Icon.dc.html` and `design/Current Screens.dc.html` are CSS-only (zero `<svg>`,
  `<path>`, `<canvas>`), so their artwork must be rendered from the actual local document with
  its bundled `design/support.js` using `chrome-devtools-axi`; screenshot at or above the target
  resolution then downscale — never upscale or transcribe the geometry into a standalone page.

Browser screenshots carry no alpha channel. For an asset that must be transparent
(`android-icon-foreground.png`, `android-icon-monochrome.png`), capture the same page twice —
once over black, once over white — and recover alpha per pixel with `a = 1 - (white - black)`,
`color = black / a`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
