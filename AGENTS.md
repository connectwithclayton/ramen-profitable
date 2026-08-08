# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Design docs are rendered, not exported

`design/*.dc.html` are design-canvas documents: they need the bundled `design/support.js`,
and the artwork inside them is drawn in **HTML/CSS divs — there is no SVG, no `<path>`, no
`<canvas>`**. To turn any of that artwork into an image asset, open the doc (or a standalone
page transcribing its geometry) in a headless browser and screenshot it; render at or above
the target resolution and downscale, never upscale.

Browser screenshots carry no alpha channel. For an asset that must be transparent
(`android-icon-foreground.png`, `android-icon-monochrome.png`), capture the same page twice —
once over black, once over white — and recover alpha per pixel with `a = 1 - (white - black)`,
`color = black / a`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
