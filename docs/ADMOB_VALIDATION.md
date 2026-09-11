# AdMob implementation validation — 2026-09-10

The full-suite and native-build evidence below was recorded before the subsequent review-fix round. The outer validation pipeline owns renewed full-suite, typecheck, and native-build evidence for the resulting head.

## Local evidence

- `npx tsc --noEmit`: passed.
- `npm test`: 14 passing tests. Mounted Store tests use the real React components, Zustand store and purchase API implementation with native/network doubles. They cover purchase/restore and consent transitions, unknown ownership, delayed CustomerInfo and disk hydration, and no-fill. A paywall success without confirmed `go_indie` ownership keeps ads disabled.
- Removing the production entitlement predicate makes the mounted Store test fail. Removing the shared iOS production-ID validator makes release tests fail. Both mutations were reverted before the final green run.
- The native-config test invokes Expo prebuild, parses its emitted Info.plist/Xcode project, and executes its emitted build phase: Debug succeeds with sample IDs; Release fails. Re-prebuilding with structurally valid synthetic production IDs updates that same phase and allows Release validation. These test fixtures are not real publisher IDs and are never app configuration.
- `npx pod-install ios`: passed. Resolved Google Mobile Ads 13.5.0, UMP 3.1.0.
- `xcodebuild -workspace ios/RamenProfitable.xcworkspace -scheme RamenProfitable -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath .expo/admob-build CODE_SIGNING_ALLOWED=NO`: **BUILD SUCCEEDED**. This links the native SDK. It is not a signed distribution build.
- A separate, ignored development rehearsal entry mounted the actual Store on the Ramen iOS 18.4 simulator with explicitly supplied non-purchaser state. UMP/SDK setup reached a real banner request. Google returned `googleMobileAds/network-error: The network connection was lost`. No real creative rendering is claimed. The temporary entry was removed and its Metro server stopped. No production bypass was added.

## PR handoff

The Store now displays a real AdMob banner inside its fictional phone billboard, using Google's official sample app/banner IDs in Debug builds. Go Indie ownership suppresses the native view immediately; unresolved ownership suppresses all banner requests. RevenueCat's CustomerInfo is the entitlement authority, including restore and later updates.

**Test IDs cannot silently ship on iOS:** the native Xcode release guard rejects missing, malformed, and sample IDs captured at prebuild, so archiving a development prebuild fails; release JavaScript validates embedded IDs at startup. Platform-neutral Expo config does not gate non-iOS releases on iOS identifiers. Valid production IDs pass. There is no test-release bypass. The captain supplies `ADMOB_IOS_APP_ID` and `ADMOB_IOS_BANNER_ID` through the single `config/admob.js` identifier configuration. Catvertising is not linked into Android builds.

**App Store Connect must change:** add Coarse Location, Device ID, Advertising Data, Product Interaction, Crash Data and Performance Data with Third-Party Advertising/Analytics purposes (plus App Functionality for diagnostics). Treat Google device/user-associated categories as linked; Google's non-user crash logs as not linked. Retain Purchase History for RevenueCat, App Functionality/Analytics, not linked under the anonymous configuration. Google-related tracking answers remain pending the dashboard and signed-archive review. The [setup table](ADMOB_SETUP.md#app-store-connect-privacy-answers) contains the per-category handoff and sources.

**Audience and serving policy:** this is a general-audience implementation. It collects no age, sends no child-directed or under-age-of-consent treatment signal, and requests only non-personalized banners. UMP exposes no supported way to tell whether a prior consent record exists before starting its required session update, so the app attempts one UMP refresh per launch for everyone, including Go Indie owners. Owners do not receive the automatic consent form, initialize Mobile Ads, or request a banner. ATT is not requested by this implementation, which does not settle the tracking answer by itself. Public-policy publication and dashboard submission remain captain-owned. The stale repository metadata draft is retired; the captain-owned listing must retain its advertising and Go Indie removal claims.

**Build and evidence limit:** rebuild an Expo native development client; Expo Go cannot render ads. Debug native compilation and simulated entitlement/consent behavior pass. Real creative rendering remains unverified because the simulator's Google request failed at the network boundary. Real IDs, production consent messages, app-ads.txt verification, AdMob **Ready** status, App Store purchase/restore, and signed-archive/privacy-report verification remain release tasks.
