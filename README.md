# 🍜 Ramen Profitable

An idle game about being an indie app developer. Ship apps, survive App Review,
fight churn, quit your day job. Built for **Shipaton 2026**.

**Category targets:** Best Game · HAMM Award · Catvertising · #BuildInPublic
**Ship plan:** see `SHIPPLAN.md` — App Review submission deadline **Sept 10**.

## Run it (5 minutes)

```bash
npm install
npx expo install expo-haptics @react-native-async-storage/async-storage react-native-svg
npx expo start
```

Scan the QR with Expo Go on your phone. The game runs there, but a development
build is required for real RevenueCat Test Store purchases.

## Architecture

```
App.tsx                     root: custom dock nav (no react-navigation — deliberate)
src/state/gameStore.ts      zustand + AsyncStorage persist. ALL game logic lives here.
src/systems/useGameLoop.ts  ticks (500ms/5s/22s) + offline earnings via AppState
src/content/content.ts      every idea, event, rejection, upgrade — add content here
src/components/             ui primitives, notification stack, overlay host
src/screens/                Home / Code / Store / Chirp
src/monetization/purchases.ts  RevenueCat wrapper, graceful mock in Expo Go
```

Design decisions worth knowing:

- **State-first:** screens are dumb renderers of the zustand store. Balancing =
  editing numbers in `gameStore.ts` initial state and `content.ts`.
- **Persistence** partializes out `notifs`/`overlay` so you never rehydrate into
  a stale modal.
- **Offline earnings** are computed from `lastSeen` on foreground, capped at 8h.
- **RevenueCat** uses dynamic `require` and graceful mock fallback when the
  native module or environment key is unavailable.

## Week 3: going live with RevenueCat

1. RevenueCat dashboard → Test Store → copy its `test_` public SDK key into
   an untracked `.env.local` as `REVENUECAT_TEST_STORE_API_KEY`.
2. Configure Test Store products, attach them to an offering, and attach the
   product to the `go_indie` entitlement.
3. Rebuild and launch the development client with `npx expo run:ios`.

Release environments must instead provide the matching
`REVENUECAT_IOS_API_KEY` or `REVENUECAT_ANDROID_API_KEY`. Expo config injects
only Test Store keys into development builds and only validated platform keys
into release builds; it never falls back from a release build to the Test Store
variable.

## Balancing cheatsheet

| Knob | Where | Current |
|---|---|---|
| Tap power | `initial.tapPower` | 3 LOC |
| Project size | `newProject` | 250–500 LOC |
| Approval odds | `resolveReview` | 72% (cat QA → 86%) |
| App MRR roll | `resolveReview` | $40–200 base |
| Win condition | `MRR_GOAL` | $2,000 MRR |
| Day length | `slowTick` | ~30s real time |
