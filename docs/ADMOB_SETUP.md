# Catvertising: AdMob setup and release handoff

The Store's **Your phone / Catvertising** unit contains a real native AdMob 320×50 banner. It is part of the fictional phone, not a global banner. The creative is not scaled, clipped, overlaid with artwork, rewarded, or disguised as a game control. On widths that cannot fit 320 points intact, it stays empty. Go Indie removes advertising and retains the existing double offline earnings benefit.

## Captain setup

1. In AdMob, add an **iOS app** for `com.clayton.ramenprofitable`; choose unpublished if its App Store page is not public yet. Create one **Banner** ad unit for the phone billboard. Supply the app ID (`ca-app-pub-…~…`) and banner unit ID (`ca-app-pub-…/…`). These are public identifiers, not login credentials.
2. Keep the approved **general-audience** policy intact: do not add an age question or state, mark requests as child-directed, or tag users as under age of consent. Every banner request must remain non-personalized only.
3. Set `ADMOB_IOS_APP_ID` and `ADMOB_IOS_BANNER_ID` in the EAS **preview and production environments** (and locally when making a release). [`config/admob.js`](../config/admob.js) is the single identifier configuration point; development always selects its clearly marked Google sample IDs, even when real IDs exist in the environment. No component edits are needed.
4. In AdMob Privacy & messaging, configure and publish the required European regulations and applicable US state privacy messages for this app, with the approved public privacy-policy URL. Configure the dashboard for the general-audience, non-personalized-only implementation, review consent behavior for relevant regions using registered test devices, and record any enabled mediation or tracking features for the final privacy review. Do not infer production consent configuration from Google's sample account.
5. Confirm the production RevenueCat iOS key, current offering, lifetime product and `go_indie` entitlement. Missing/unavailable purchase configuration intentionally means **no ads**, because ownership cannot be checked safely. Verify a real purchase and fresh-install restore with the production catalog in Apple's test environment.
6. Establish a developer website that can serve a file at its root, add that site to the App Store listing's **Marketing URL**, and confirm the public App Store page shows **Developer Website**. Publish AdMob's personalized seller record unchanged at `https://<developer-host>/app-ads.txt`; do not invent the publisher ID or copy another app's record. [Google's app-ads.txt setup](https://support.google.com/admob/answer/9363762) explains the required store-to-domain link.
7. Once the app is publicly available, link its live App Store listing and store ID to the AdMob app. In **App settings → Verify app**, choose **Check for updates** and confirm the app-ads.txt file is found and verified. Then wait for the app-readiness status to reach **Ready**; full serving can remain limited beforehand. Resolve **Needs attention**, and complete AdMob account verification if the app remains **Getting ready**. See [app verification](https://support.google.com/admob/answer/14538460) and [app readiness](https://support.google.com/admob/answer/10564477).
8. Update App Store Connect privacy answers below and publish the captain-approved policy before submission. Leave the App Store listing's advertising and Go Indie removal copy as-is.

## Official test identifiers

Looked up from Google's current documentation on 2026-09-10; these are development-only sample inventory, not our publisher account:

| Platform | App ID | Fixed-size banner unit ID |
| --- | --- | --- |
| iOS | `ca-app-pub-3940256099942544~1458002511` | `ca-app-pub-3940256099942544/2934735716` |

Sources: [Google iOS setup](https://developers.google.com/admob/ios/quick-start) and [Google iOS test ads](https://developers.google.com/admob/ios/test-ads). The fixed-size banner ID is deliberately different from the adaptive-banner ID.

## Required build

**Expo Go cannot display these ads. Rebuild the native development client.** Installing the JS package or restarting Metro is insufficient. This repo uses Expo 57, React Native 0.86 and `react-native-google-mobile-ads`; both Google ads and RevenueCat need native modules. Read against the [versioned Expo 57 documentation](https://docs.expo.dev/versions/v57.0.0/), plus the [wrapper's installation guide](https://docs.page/invertase/react-native-google-mobile-ads).

For local testing, set the existing `REVENUECAT_TEST_STORE_API_KEY`, then run `npx expo run:ios --device <udid> --port <free-port>`. Use a Debug build, or the EAS `development` / `ios-simulator` profile. iOS Preview/TestFlight/store builds are Release and require real iOS AdMob IDs. Simulators get test ads even with real units; register physical test devices in AdMob before testing real IDs. Never click live ads.

## Release safeguards — include in the PR description

- Expo config rejects undeclared EAS profiles. It carries iOS identifiers without validating them so non-iOS release configuration remains independent of `ADMOB_IOS_*`; the iOS-only guards below enforce them.
- The Expo safety plugin adds a **native Xcode build phase** that validates the IDs captured when native projects were generated, not whatever environment happens to be present at compile time. Thus a Debug prebuild later archived as Release still fails loudly. Regenerate the iOS native project after changing IDs; do not manually edit generated native files.
- A release JavaScript bundle validates its embedded iOS IDs at module import, even if a purchased user would hide the ad.
- There is no “allow test release” escape hatch. Debug/sample builds are for development only.

## Entitlements and consent

Ownership is unknown until RevenueCat returns CustomerInfo; unknown, offline failures, Expo Go and missing keys do not authorize ads. Confirmed CustomerInfo from purchase or restore updates entitlement state before returning; a successful paywall result without a confirmed entitlement leaves ads disabled and ownership unresolved; the CustomerInfo listener also handles later changes. A delayed local save hydration cannot replace freshly resolved ownership.

UMP refreshes consent information once at each application launch before Mobile Ads initialization. Its public API cannot distinguish a prior consent record from a user who has never contacted UMP before initiating that refresh, so the refresh is attempted for every user, including Go Indie owners. Owners do not receive the automatic consent form, initialize Mobile Ads, or request a banner; the refresh only preserves a required privacy-options entry. Errors and `canRequestAds=false` fail closed for ads. A purchase arriving during consent or initialization cannot mount a late banner. Changing privacy choices first removes the current banner and re-checks UMP state afterward.

The app is configured for a general audience. Debug and release builds call UMP without an under-age tag and do not set a Mobile Ads child-directed or age-restricted treatment. The app collects no age, requests no IDFA or tracking permission, and passes no purchase identity or custom targeting. Every banner request explicitly asks for non-personalized ads only. Native background or game overlay states unmount the creative; load failure leaves a fictional empty billboard.

## App Store Connect privacy answers

**Change the existing RevenueCat-only disclosure before submitting this binary.** Data collection: **Yes** (including third-party SDK collection). The categories, purposes, and linked answers below are the current conservative handoff. Google-related tracking answers remain pending until the AdMob dashboard and signed archive are reviewed together; do not submit a guessed Yes or No.

| Data type | Purposes to declare | Linked to identity | Used for tracking |
| --- | --- | --- | --- |
| Coarse Location (inferred from IP; no location permission) | Third-Party Advertising, Analytics | Yes | Pending final review |
| Device ID (app/device-scoped identifiers; no iOS IDFA authorization) | Third-Party Advertising, Analytics | Yes | Pending final review |
| Advertising Data | Third-Party Advertising, Analytics | Yes | Pending final review |
| Product Interaction | Third-Party Advertising, Analytics | Yes | Pending final review |
| Crash Data | App Functionality, Third-Party Advertising, Analytics | No for Google's non-user-related crash logs | Pending final review |
| Performance Data | App Functionality, Third-Party Advertising, Analytics | Yes | Pending final review |
| Purchase History (RevenueCat; retain existing disclosure) | App Functionality, Analytics | No under the existing anonymous RevenueCat configuration | No |

Do not add contact information, precise location, fictional Chirp content, or gameplay progress as remotely collected based on this change. No distinct User ID is passed to Google by the application. Reconcile the final Xcode archive's privacy report with the SDK manifests and actual RevenueCat/AdMob dashboard settings; if the report or enabled features introduce further categories or tracking, resolve the mismatch before submitting.

**ATT is not requested by the current implementation.** That fact alone does not establish a **Tracking: No** answer. Reconcile the final AdMob dashboard and signed archive before submission; if they introduce tracking, block release until the implementation, ATT handling, and disclosures are reviewed together.

Disclosure sources: [Google SDK data disclosure](https://developers.google.com/admob/ios/privacy/data-disclosure), [Google age treatment](https://developers.google.com/admob/ios/targeting#set_the_age_treatment), [Google UMP](https://developers.google.com/admob/ios/privacy), [Apple App Privacy definitions](https://developer.apple.com/app-store/app-privacy-details/), and [RevenueCat Apple privacy guidance](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy).

## Validation evidence

`npm test` exercises the application root and Store React tree, Zustand state, and public RevenueCat purchase/restore APIs, with native/network doubles. It checks initial unknown ownership, one untagged UMP refresh per launch, the paid-user privacy entry, non-personalized banner requests, delayed consent, confirmed purchase and restore removal, remount, fresh-install restore, no-fill, and consent withdrawal. Config tests execute platform-neutral release configuration without iOS IDs and the native identifier guard with missing, sample, and valid IDs; ads tests execute the valid release JavaScript path. These tests are not proof of real ad fill, App Store purchases, or dashboard setup.

The local iOS Debug simulator build succeeded with Google Mobile Ads 13.5.0 and UMP 3.1.0. A native SDK rehearsal reached the banner request but returned `googleMobileAds/network-error: The network connection was lost`; actual creative rendering is **unverified**. With no local RevenueCat test key, this ignored, temporary rehearsal entry explicitly supplied non-purchaser state; it did not validate RevenueCat purchases, and was removed afterward.

Signed release, actual Google fill, app-ads.txt verification, AdMob **Ready** status, region-specific production consent, physical-device purchase and restore, and App Store Connect answers remain separate release evidence. See [the validation record](ADMOB_VALIDATION.md) for exact local checks and PR handoff.
