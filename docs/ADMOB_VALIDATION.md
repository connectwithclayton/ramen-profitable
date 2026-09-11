# AdMob implementation validation — 2026-09-10

## Local evidence

- `npx tsc --noEmit`: passed.
- `npm test`: 14 passing tests. Mounted Store tests use the real React components, Zustand store and purchase API implementation with native/network doubles. They cover purchase/restore and consent transitions, unknown ownership, delayed CustomerInfo and disk hydration, and no-fill. A paywall success without confirmed `go_indie` ownership keeps ads disabled.
- Removing the production entitlement predicate makes the mounted Store test fail. Removing production ID validation makes release tests fail. Both mutations were reverted before the final green run.
- The native-config test invokes Expo prebuild, parses its emitted Info.plist/Xcode project, and executes its emitted build phase: Debug succeeds with sample IDs; Release fails. Re-prebuilding with structurally valid synthetic production IDs updates that same phase and allows Release validation. These test fixtures are not real publisher IDs and are never app configuration.
- `npx pod-install ios`: passed. Resolved Google Mobile Ads 13.5.0, UMP 3.1.0.
- `xcodebuild -workspace ios/RamenProfitable.xcworkspace -scheme RamenProfitable -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath .expo/admob-build CODE_SIGNING_ALLOWED=NO`: **BUILD SUCCEEDED**. This compiles the native publisher-first-party-ID disablement and links the native SDK. It is not a signed distribution build.
- A separate, ignored development rehearsal entry mounted the actual Store on the Ramen iOS 18.4 simulator with explicitly supplied non-purchaser state. UMP/SDK setup reached a real banner request. Google returned `googleMobileAds/network-error: The network connection was lost`. No real creative rendering is claimed. The temporary entry was removed and its Metro server stopped. No production bypass was added.
- Android's guard executable is tested; Android native compilation is unverified.

## PR handoff

The Store now displays a real AdMob banner inside its fictional phone billboard, using Google's official sample app/banner IDs in Debug builds. Go Indie ownership suppresses the native view immediately; pending purchase/restore and unresolved ownership suppress all banner requests. RevenueCat's CustomerInfo is the entitlement authority, including restore and later updates.

**Test IDs cannot silently ship:** Expo config rejects missing/malformed/sample IDs in release contexts; native Xcode/Android release guards check IDs captured at prebuild so archiving a development prebuild fails; release JS validates embedded IDs at startup. There is no test-release bypass. The captain supplies `ADMOB_IOS_APP_ID` and `ADMOB_IOS_BANNER_ID` through the single `config/admob.js` environment configuration.

**App Store Connect must change:** add Coarse Location, Device ID, Advertising Data, Product Interaction, Crash Data and Performance Data with Third-Party Advertising/Analytics purposes (plus App Functionality for diagnostics). Treat Google device/user-associated categories as linked; Google's non-user crash logs as not linked. Retain Purchase History for RevenueCat, App Functionality/Analytics, not linked under the anonymous configuration. Tracking is No for the implemented iOS configuration. The [setup table](ADMOB_SETUP.md#app-store-connect-privacy-answers) contains the per-category answers and sources.

**ATT is not required/requested for this configuration:** non-personalized requests, publisher first-party ID disabled, no IDFA request, cross-company IDs, or mediation. Do not enable tracking/IDFA messages in AdMob without revisiting the implementation and disclosures. UMP still handles applicable consent before SDK initialization. The privacy draft now describes these advertising data flows; public-policy publication and dashboard submission remain captain-owned. App Store listing copy is untouched.

**Build and evidence limit:** rebuild an Expo native development client; Expo Go cannot render ads. Debug native compilation and simulated entitlement/consent behavior pass. Real creative rendering remains unverified because the simulator's Google request failed at the network boundary. Real IDs, production consent messages, App Store purchase/restore, and signed-archive/privacy-report verification remain release tasks.
