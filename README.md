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
- **Go Indie** opens the remotely configured RevenueCat Paywall only after a
  deliberate Go Indie tap from the approved-app affordance or Store. There is
  no launch paywall. The lifetime unlock doubles offline earnings only after
  the `go_indie` entitlement is known active; Restore Purchases is available in
  Store.
- **RevenueCat** uses the SDK's `CURRENT` offering without hardcoded product
  identifiers or prices. Dynamic `require` preserves graceful mock fallback
  when the native module or environment key is unavailable, and unavailable
  RevenueCat never blocks launch or base offline earnings.

## Week 3: going live with RevenueCat

Remaining captain steps for a Test Store purchase:

1. Create a RevenueCat account and create a project for Ramen Profitable.
2. In **Apps & Providers**, create a **Test Store** app/provider for the
   project.
3. In **Product Catalog**, define the Test Store lifetime product and the
   `go_indie_lifetime` package, create the offering, connect the package to
   that offering, and create the `go_indie` entitlement with the product
   attached. Publish a Paywall/workflow on that same offering; the app reads
   the SDK's `CURRENT` offering and its remotely configured packages and prices.
   Confirm the published workflow assembles without a no-workflow error.
4. In **Project Settings → API keys**, copy the Test Store public SDK key. It
   must start with `test_`.
5. For local development, put the exact variable
   `REVENUECAT_TEST_STORE_API_KEY=test_...` in the untracked `.env.local`.
   For an EAS development build, add that same variable and value to the
   project's **development** environment with
   `eas env:create --name REVENUECAT_TEST_STORE_API_KEY --value test_... --environment development --visibility plaintext`,
   or add it in **Project settings → Environment variables**. The
   `development` profile already selects that environment.
6. Build the simulator development client with
   `npx eas build --profile ios-simulator --platform ios`, install it in the
   iOS Simulator, and start the bundler with `npx expo start --dev-client`.
   For a local native rebuild, use `npx expo run:ios`.

Apple Developer approval and App Store Connect are not required for RevenueCat
Test Store purchases.

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
