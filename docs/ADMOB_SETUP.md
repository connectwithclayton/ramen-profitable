# Catvertising: AdMob setup and release handoff

The Store's **Your phone / Catvertising** unit contains a real native AdMob 320×50 banner. It is part of the fictional phone, not a global banner. The creative is not scaled, clipped, overlaid with artwork, rewarded, or disguised as a game control. On widths that cannot fit 320 points intact, it stays empty. Go Indie removes advertising and retains the existing double offline earnings benefit.

## Captain setup

1. In AdMob, add an **iOS app** for `com.clayton.ramenprofitable`. Create one **Banner** ad unit for the phone billboard. Supply the app ID (`ca-app-pub-…~…`) and banner unit ID (`ca-app-pub-…/…`). These are public identifiers, not login credentials.
2. Set `ADMOB_IOS_APP_ID` and `ADMOB_IOS_BANNER_ID` in the EAS **preview and production environments** (and locally when making a release). [`config/admob.js`](../config/admob.js) is the single configuration point; development always selects its clearly marked Google sample IDs, even when real IDs exist in the environment. No component edits are needed.
3. In AdMob Privacy & messaging, configure and publish the required European regulations and applicable US state privacy messages for this app, with the approved public privacy-policy URL. Keep the IDFA/ATT explainer disabled. Use non-personalized serving, no mediation partners, and no tracking integrations. Review consent behavior for relevant regions using registered test devices before release. Do not infer production consent configuration from Google's sample account.
4. Confirm the production RevenueCat iOS key, current offering, lifetime product and `go_indie` entitlement. Missing/unavailable purchase configuration intentionally means **no ads**, because ownership cannot be checked safely. Verify a real purchase and fresh-install restore with the production catalog in Apple's test environment.
5. Update App Store Connect privacy answers below and publish the captain-approved policy before submission. Leave the App Store listing copy as-is; it already describes advertising and Go Indie removal.

## Official test identifiers

Looked up from Google's current documentation on 2026-09-10; these are development-only sample inventory, not our publisher account:

| Platform | App ID | Fixed-size banner unit ID |
| --- | --- | --- |
| iOS | `ca-app-pub-3940256099942544~1458002511` | `ca-app-pub-3940256099942544/2934735716` |
| Android | `ca-app-pub-3940256099942544~3347511713` | `ca-app-pub-3940256099942544/6300978111` |

Sources: [Google iOS setup](https://developers.google.com/admob/ios/quick-start), [Google iOS test ads](https://developers.google.com/admob/ios/test-ads), [Google Android setup](https://developers.google.com/admob/android/quick-start), [Google Android test ads](https://developers.google.com/admob/android/test-ads). The fixed-size banner IDs are deliberately different from the adaptive-banner IDs.

## Required build

**Expo Go cannot display these ads. Rebuild the native development client.** Installing the JS package or restarting Metro is insufficient. This repo uses Expo 57, React Native 0.86 and `react-native-google-mobile-ads`; both Google ads and RevenueCat need native modules. Read against the [versioned Expo 57 documentation](https://docs.expo.dev/versions/v57.0.0/), plus the [wrapper's installation guide](https://docs.page/invertase/react-native-google-mobile-ads).

For local testing, set the existing `REVENUECAT_TEST_STORE_API_KEY`, then run `npx expo run:ios --device <udid> --port <free-port>`. Use a Debug build, or the EAS `development` / `ios-simulator` profile. Preview/TestFlight/store builds are Release and require real AdMob IDs. Simulators get test ads even with real units; register physical test devices in AdMob before testing real IDs. Never click live ads.

## Release safeguards — include in the PR description

- Expo config rejects absent, malformed and Google's sample publisher IDs for preview, production, unknown EAS profiles, and `NODE_ENV=production`. Development mode cannot override these checks.
- The Expo safety plugin adds a **native Xcode build phase** and **Android Release-task guard**. They validate the IDs captured when native projects were generated, not whatever environment happens to be present at compile time. Thus a Debug prebuild later archived as Release still fails loudly. Regenerate native projects after changing IDs; do not manually edit generated native files.
- A release JavaScript bundle validates its embedded platform IDs at module import, even if a purchased user would hide the ad. Stale sample runtime config fails loudly before gameplay.
- There is no “allow test release” escape hatch. Debug/sample builds are for development only.

## Entitlements and consent

Ownership is unknown until RevenueCat returns CustomerInfo; unknown, offline failures, Expo Go and missing keys do not authorize ads. Purchase/restore calls hide existing banners while pending. Confirmed CustomerInfo from purchase or restore updates entitlement state before returning; a successful paywall result without a confirmed entitlement leaves ads disabled and ownership unresolved; the CustomerInfo listener also handles later changes. A delayed local save hydration cannot replace freshly resolved ownership.

UMP runs before Mobile Ads initialization. Errors and `canRequestAds=false` fail closed. A purchase arriving during consent/initialization cannot mount a late banner. Changing privacy choices first removes the current banner and checks UMP again afterward. Consent is refreshed on each application launch when a non-purchaser opens the Store. The Store exposes the privacy-options entry when UMP says it is required, including after purchase when UMP still requires the entry.

Every request uses `requestNonPersonalizedAdsOnly: true`. iOS disables publisher first-party ID at native startup, requests no IDFA permission, passes no purchase identity or custom targeting, and includes only Google's SKAdNetwork identifier. SKAdNetwork does not grant access to IDFA. Native background or game overlay states unmount the creative; load failure leaves a fictional empty billboard.

## App Store Connect privacy answers

**Change the existing RevenueCat-only disclosure before submitting this binary.** Data collection: **Yes** (including third-party SDK collection). For the configuration built here, use these categories/purposes. “Linked” is conservatively Yes for Google user/device-associated data: there is no verified pre-collection de-identification guarantee simply because the game has no login.

| Data type | Purposes to declare | Linked to identity | Used for tracking |
| --- | --- | --- | --- |
| Coarse Location (inferred from IP; no location permission) | Third-Party Advertising, Analytics | Yes | No |
| Device ID (app/device-scoped identifiers; no iOS IDFA authorization) | Third-Party Advertising, Analytics | Yes | No |
| Advertising Data | Third-Party Advertising, Analytics | Yes | No |
| Product Interaction | Third-Party Advertising, Analytics | Yes | No |
| Crash Data | App Functionality, Third-Party Advertising, Analytics | No for Google's non-user-related crash logs | No |
| Performance Data | App Functionality, Third-Party Advertising, Analytics | Yes | No |
| Purchase History (RevenueCat; retain existing disclosure) | App Functionality, Analytics | No under the existing anonymous RevenueCat configuration | No |

Do not add contact information, precise location, fictional Chirp content, or gameplay progress as remotely collected based on this change. No distinct User ID is passed to Google by the application. Reconcile the final Xcode archive's privacy report with the SDK manifests and actual RevenueCat/AdMob dashboard settings; if the report or enabled features introduce further categories or tracking, resolve the mismatch before submitting.

**ATT: not required and not requested for this iOS configuration.** The app does not perform cross-company tracking, request IDFA, send cross-company identifiers, or install mediation/attribution integrations. Non-personalized ads still collect data and still need applicable consent; NPA alone is not proof of no tracking. Enabling an IDFA message, tracking, mediation, or different ad personalization later invalidates these answers and requires review and appropriate ATT gating. Do not turn those on just to improve fill.

Disclosure sources: [Google SDK data disclosure](https://developers.google.com/admob/ios/privacy/data-disclosure), [Google privacy strategies and publisher first-party ID](https://developers.google.com/admob/ios/privacy/strategies), [Google non-personalized ads](https://support.google.com/admob/answer/7676680), [Google UMP](https://developers.google.com/admob/ios/privacy), [Apple App Privacy definitions](https://developer.apple.com/app-store/app-privacy-details/), and [RevenueCat Apple privacy guidance](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy).

## Validation evidence

`npm test` exercises the actual Store React tree, Zustand state, and public RevenueCat purchase/restore APIs, with native/network doubles. It checks initial unknown ownership, delayed consent, purchase/restore while visible, immediate removal, remount, fresh-install restore, no-fill, and consent withdrawal. Config tests execute the configuration consumer and native guard executable, including production-profile overrides and independently swapped sample app/banner IDs. These tests are not proof of real ad fill, App Store purchases, or dashboard setup.

The local iOS Debug simulator build succeeded with Google Mobile Ads 13.5.0 and UMP 3.1.0. A native SDK rehearsal reached the banner request but returned `googleMobileAds/network-error: The network connection was lost`; actual creative rendering is **unverified**. With no local RevenueCat test key, this ignored, temporary rehearsal entry explicitly supplied non-purchaser state; it did not validate RevenueCat purchases, and was removed afterward.

Signed release, actual Google fill, region-specific production consent, physical-device purchase and restore, and App Store Connect answers remain separate release evidence. See [the validation record](ADMOB_VALIDATION.md) for exact local checks and PR handoff.
