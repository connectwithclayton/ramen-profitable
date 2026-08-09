# Ramen Profitable — icon export

## What to use
`icon-master.svg` is the master. It is pure geometry (rects, one arc, four gradients),
so it re-renders lossless at any size. Regenerate PNGs from it rather than
scaling the PNGs.

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
Android foreground and monochrome are scaled to 68% to sit inside the
66% adaptive-icon safe circle.

## Palette — all from src/theme.ts
ground  #1D2338 → #0C0F1A   (C.card2 → C.midnight)
bowl    #F2A33C → #D8801F   (C.gold, shaded)
rim     #FFD79A → #F2A33C
foot    #B96C18
bars    #E9ECF5 @32% / @60%  (C.ink), lead bar #57D9A3 (C.mint)

Monochrome is a single fused white silhouette — rim and bowl overlap by 24px
so themed-icon mode cannot split it.
