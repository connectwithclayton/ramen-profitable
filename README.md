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

Scan the QR with Expo Go on your phone. That's it — the game runs fully in
Expo Go for now (RevenueCat is in mock mode until Week 3).

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
- **RevenueCat** uses dynamic `require` so Expo Go never crashes; Week 3 adds
  API keys + an EAS dev build and the "Go Indie" paywall becomes real.

## Week 3: going live with RevenueCat

1. RevenueCat dashboard → new project → iOS app → copy `appl_` key into
   `src/monetization/purchases.ts`
2. Create entitlement `go_indie`, attach a $4.99/mo product + lifetime product
3. `npx eas build --profile development --platform ios`
4. Replace the mock branch in `presentGoIndiePaywall` with RC Paywalls UI if
   desired (`react-native-purchases-ui`)

## Balancing cheatsheet

| Knob | Where | Current |
|---|---|---|
| Tap power | `initial.tapPower` | 3 LOC |
| Project size | `newProject` | 250–500 LOC |
| Approval odds | `resolveReview` | 72% (cat QA → 86%) |
| App MRR roll | `resolveReview` | $40–200 base |
| Win condition | `MRR_GOAL` | $2,000 MRR |
| Day length | `slowTick` | ~30s real time |
