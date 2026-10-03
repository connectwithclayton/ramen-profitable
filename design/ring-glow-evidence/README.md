# Code ring glow validation

Native iPhone SE (3rd generation), iOS 26.5, 375 x 667 points. These are actual Debug app screenshots, downscaled from 750 x 1334 pixels, not design mockups.

- [Ring states](iphone-se-states.png): untried pulse at two brightness levels, first successful tap, process relaunch, then exhausted energy. The ring remains a 248 x 248-point tap target. The normal startup notification is visible in the relaunch capture.
- [Reduced Motion](reduced-motion.png): enabled through iOS Settings, then a static first-use cue and a much fainter static discovered cue. Two captures taken two seconds apart had pixel-identical ring regions. The setting was restored afterward.

## Checks

- `npm run typecheck`: passed.
- `npm test`: 101 passed, including eight targeted tests in `tests/code-ring-glow.test.js`.
- Native iOS Debug build: passed with Expo Battery linked. Rebuild development clients after installing this dependency.
- Native XCTest journey: actual Code tab and ring presses; first press writes 3 LOC, restart preserves 3 LOC and the quiet cue, two more presses exhaust the fixture's 3 energy, and an exhausted press does not write code. Ring dimensions and the scrollable code panel were checked on the SE.
- Component/store tests cover fractional unusable energy, regeneration, automation, completed/absent projects, overlays, legacy saves, low-power changes, failed/stale preference reads, backgrounding and listener/animation cleanup. Game ticks and taps do not restart the pulse.

The journey fixture freezes regeneration to capture depletion reliably. Only the dedicated simulator's Ramen AsyncStorage was seeded, backed up and restored byte-for-byte. No production test bypass was added. Native test artifacts remain under ignored `.expo/ring-glow/`.

Low Power Mode uses Expo Battery's native state and change listener, with the same static treatment as Reduced Motion. Its contract is covered by component tests; physical-device low-power behavior and Android visuals were not exercised.
