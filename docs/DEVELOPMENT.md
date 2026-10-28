# Development guide

How to run, validate, and configure Ramen Profitable. "Captain" in these docs is
[firstmate](https://github.com/kunchenguid/firstmate)'s name for the human who
owns the project: steps marked for the captain need personal accounts or
credentials and are never done by an agent.

## Run it (5 minutes)

```bash
npm install
npx expo start
```

Scan the QR with Expo Go on your phone. The game runs there, but a development
build is required for real RevenueCat Test Store purchases.

## Validate changes

Pull requests and pushes to `main` run the same lockfile-strict Linux checks as:

```bash
npm ci --no-audit --no-fund
npm run typecheck
npm test
```

CI does not build native apps, deploy, or require release credentials.

## RevenueCat setup

Steps for a Test Store purchase:

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

### Physical iPhone development build

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

### Release keys

Release environments must instead provide the matching
`REVENUECAT_IOS_API_KEY` or `REVENUECAT_ANDROID_API_KEY`. An iOS release refuses
to configure unless `REVENUECAT_IOS_API_KEY` is a usable `appl_` public SDK
key, not missing, wrong-type, or prefix-only. Set it in each selected EAS
preview or production environment with Plain text or Sensitive visibility,
not Secret visibility, so Expo can read it while resolving dynamic app
config. Expo config injects only Test Store keys into development builds and
only validated platform keys into release builds; it never falls back from a
release build to the Test Store variable.

## Advertising

AdMob identifiers, release guards, and consent configuration are in
[AdMob setup](ADMOB_SETUP.md).
