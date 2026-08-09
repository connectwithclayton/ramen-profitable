# Ramen Profitable — icon export

## Production source mapping

The committed PNGs are the approved production exports. When a new export is approved,
render it at its target resolution from the mapped SVG; never scale an existing PNG.

| Production asset | Durable vector source | Export size |
|---|---|---|
| `assets/icon.png` | `design/icon-source/icon-master.svg` | 1024×1024 |
| `assets/splash-icon.png` | `design/icon-source/icon-master.svg` | 1024×1024 |
| `assets/favicon.png` | `design/icon-source/icon-master.svg` | 96×96 |
| `assets/android-icon-foreground.png` | `design/icon-source/android-icon-foreground.svg` | 1024×1024 |
| `assets/android-icon-background.png` | `design/icon-source/android-icon-background.svg` | 1024×1024 |
| `assets/android-icon-monochrome.png` | `design/icon-source/android-icon-monochrome.svg` | 1024×1024 |

Do not render either Android foreground asset from `icon-master.svg`: the full master includes
the colored ground and does not contain the adaptive-icon safe-circle correction.

## Drop-in for app.json
| File | Goes to | app.json key |
|---|---|---|
| icon.png (1024²) | assets/icon.png | expo.icon |
| splash-icon.png (1024²) | assets/splash-icon.png | splash |
| favicon.png (96²) | assets/favicon.png | expo.web.favicon |
| android-icon-foreground.png (1024²) | assets/ | android.adaptiveIcon.foregroundImage |
| android-icon-background.png (1024²) | assets/ | android.adaptiveIcon.backgroundImage |
| android-icon-monochrome.png (1024²) | assets/ | android.adaptiveIcon.monochromeImage |

One `app.json` change is needed: `android.adaptiveIcon.backgroundColor` is
currently `#E6F4FE` (Expo default light blue). Set it to `#0C0F1A` so the
themed fallback matches the ground.

## Geometry
1024² artboard, no corner rounding — iOS and Android apply their own mask.
Mark spans y 128–896, so 128px of clear margin top and bottom.
Android foreground and monochrome keep transparent surroundings. Their maximum alpha-visible
radius is at most 312.9px on the 1024px artboard (ratio ≤0.3056), inside the 66dp/108dp
guaranteed-safe circle. The monochrome source is pure white, and its rim overlaps the bowl by
24px so the themed-icon silhouette remains fused.

## Palette — all from src/theme.ts
ground  #1D2338 → #0C0F1A   (C.card2 → C.midnight)
bowl    #F2A33C → #D8801F   (C.gold, shaded)
rim     #FFD79A → #F2A33C
foot    #B96C18
bars    #E9ECF5 @32% / @60%  (C.ink), lead bar #57D9A3 (C.mint)

Monochrome is a single fused white silhouette — rim and bowl overlap by 24px
so themed-icon mode cannot split it.
