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
src/state/gameStore.ts      zustand store actions and AsyncStorage persist wiring
src/state/experience.ts     offline settlement, Home reactions, paywall receipts, persist allowlist
src/systems/useGameLoop.ts  ticks (500ms/5s/22s) + offline earnings via AppState
src/content/content.ts      every idea, event, rejection, upgrade — add content here
src/components/             ui primitives, notification stack, overlay host
src/screens/                Home / Code / Store / Chirp
src/monetization/purchases.ts  RevenueCat wrapper, graceful mock in Expo Go
```

Design decisions worth knowing:

- **State-first:** screens render the zustand store. Home measures visible
  reaction exposure in memory and commits only at focus, occlusion, or expiry
  boundaries. Balancing = numbers in `gameStore.ts` initial state and
  `content.ts`; reaction copy and offline settlement live in `experience.ts`.
- **Persistence** is the allowlist in `selectPersistedState`
  (`src/state/experience.ts`). Transient notifications, overlays, unresolved
  entitlement flags, and in-flight Home priority timers stay out of storage so
  you never rehydrate into a stale modal or a covered countdown.
- **Offline earnings** credit the base interval from `lastSeen` immediately on
  foreground, capped at 8h. A remembered Go Indie owner's unconfirmed remainder
  settles exactly once when entitlement is known; the rate-split and lastSeen
  contracts live in [`docs/ADMOB_SETUP.md`](docs/ADMOB_SETUP.md#entitlements-and-consent).
- **Go Indie** opens the remotely configured RevenueCat Paywall only after a
  deliberate Go Indie tap from the approved-app affordance or Store. There is
  no launch paywall. The lifetime unlock doubles offline earnings only after
  the `go_indie` entitlement is known active; Restore Purchases is available in
  Store.
- **RevenueCat** uses the SDK's `CURRENT` offering without hardcoded product
  identifiers or prices. Dynamic `require` preserves graceful mock fallback
  in Expo Go and development when the native module or Test Store key is
  unavailable. iOS release configuration fails before bundling when its
  production key is missing or malformed, while runtime service failures still
  fail closed for advertising without blocking launch or base offline earnings.

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

### Captain path: physical iPhone development build

The captain must run `eas login` in a real terminal, then provision the
development Test Store variable in the EAS **development** environment as
described above. For Apple credentials, create an App Store Connect API key
with the **Admin** role, keep its `.p8` file outside this repository, and use
the captain-provided key only through the EAS credential flow. Choose the
**Individual** team type and provide the non-secret Key ID, Issuer ID, and
Apple Team ID when EAS requests them. Do not commit or share the `.p8` file or
any credential values.

Run `npx eas build --profile development --platform ios`. In the EAS Website
device-registration flow, open the registration page on the captain's iPhone,
register that device, select it for the build, and install the resulting
development build from its EAS build link. The device must launch the app and
render it before physical-device validation is claimed. Keep Metro running with
`npx expo start --dev-client` and report the device-side RevenueCat state plainly:
`[purchases] RevenueCat configured for test-store.` means Test Store is
configured; `[purchases] ... mock mode.` means the native module or key is
unavailable and real purchases were not configured.

After dependency changes, run `npm ci` in the clone that actually runs Metro;
otherwise Metro can fail with `Unable to resolve module` even when this clone
is installed correctly. Do not claim RevenueCat configuration from app launch
alone; use the Metro evidence above.

Apple Developer or App Store Connect approval is not required for RevenueCat
Test Store purchases; the physical iPhone EAS build still requires the Apple
credentials and device registration described above.

Release environments must instead provide the matching
`REVENUECAT_IOS_API_KEY` or `REVENUECAT_ANDROID_API_KEY`. An iOS release refuses
to configure unless `REVENUECAT_IOS_API_KEY` is a non-empty `appl_` public SDK
key. Set it in each selected EAS preview or production environment with Plain
text or Sensitive visibility, not Secret visibility, so Expo can read it while
resolving dynamic app config. Expo config injects only Test Store keys into
development builds and only validated platform keys into release builds; it
never falls back from a release build to the Test Store variable.

## Balancing cheatsheet

| Knob | Where | Current |
|---|---|---|
| Tap power | `initial.tapPower` | 3 LOC |
| Project size | `newProject` | 250–500 LOC |
| Approval odds | `resolveReview` | 72% (cat QA → 86%) |
| App MRR roll | `resolveReview` | $40–200 base |
| Win condition | `MRR_GOAL` | $2,000 MRR |
| Day length | `slowTick` | ~30s real time |

## Catvertising advertising

On iPhone and iPad, the Store contains a real AdMob banner inside its fictional phone; Go Indie removes it. Android contains no advertising. See [AdMob setup, release guards, and privacy handoff](docs/ADMOB_SETUP.md). Ads require a rebuilt native development client and resolved RevenueCat ownership. The general-audience integration sends no child or under-age treatment signals and requests only non-personalized banners.
