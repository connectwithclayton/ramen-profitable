# Ramen Profitable privacy policy publication source

> **Publication source:** This document is the source text to be published on the Ramen Profitable privacy page under <https://ramen.clayj.app> before App Store submission. This repository does not publish the public site. Do not enter a Privacy Policy URL in App Store Connect until the matching policy is live and its exact public URL has been verified.
>
> **Captain confirmation required before publication:** Confirm the operator name, support email, and effective date in the public copy below. The proposed operator and contact are retained from the existing draft, but they are product and legal decisions rather than facts enforced by the app. Also confirm that the submitted binary and the captain-controlled AdMob, UMP, RevenueCat, and App Store configurations match the implementation evidence in this document.

## Public policy copy

# Privacy Policy for Ramen Profitable

**Operator:** Clayton Johnson [CAPTAIN TO CONFIRM]

**Effective date:** [CAPTAIN TO INSERT PUBLICATION DATE]

**Privacy contact:** ramenprofitablegame@gmail.com [CAPTAIN TO CONFIRM]

Ramen Profitable is an idle game about building fictional apps. This policy explains how the app stores game progress and how its advertising and purchase providers process information when their services are used.

## Game progress stored on your device

Ramen Profitable stores game progress on your device. Stored progress includes game values, upgrades, projects and fictional apps, fictional Chirp posts and reactions, achievements, Go Indie status, and timing information used to calculate offline earnings.

The app's own code does not send this game progress to a developer-operated server or to a separate general-purpose analytics service. Deleting the app or clearing its app data removes the copy stored by the app on that device.

## Purchases

Ramen Profitable offers an optional Go Indie in-app purchase. The app uses RevenueCat and Apple's in-app purchase services to show the current offer, process or restore a purchase, and determine whether the Go Indie entitlement is active.

The app configures RevenueCat with its public platform SDK key. It does not pass RevenueCat a custom account identifier, name, email address, phone number, game progress, or advertising identifier. RevenueCat and Apple may process purchase, device, and diagnostic information needed to provide their services under their own policies. RevenueCat's practices are described in its [privacy policy](https://www.revenuecat.com/privacy) and [data and compliance documentation](https://www.revenuecat.com/docs/welcome/set-up-revenuecat/data-and-compliance).

## Advertising and consent

On iPhone and iPad, Ramen Profitable displays a banner advertisement supplied by Google AdMob. Go Indie removes the advertisement. The Android build does not include the Google Mobile Ads native module.

Every banner request made by the app sets `requestNonPersonalizedAdsOnly` to `true`. The app does not request Apple's App Tracking Transparency permission and does not provide Google with game progress, fictional Chirp content, or RevenueCat purchase identity for ad targeting.

The app uses Google's User Messaging Platform to update consent information when the app launches. Before an eligible banner can be requested, the app asks UMP to show a consent message when one is required and checks that ads may be requested. The AdMob account has active European regulations and US state regulations consent messages. If consent cannot be established or the advertising service is unavailable, the app continues without requesting the banner.

Non-personalized advertising still requires communication with Google. Google may process technical, advertising, consent, and diagnostic information according to its service configuration and policies. See [Google's privacy policy](https://policies.google.com/privacy) and [how Google uses information from apps that use its services](https://policies.google.com/technologies/partner-sites).

## Device permissions and features

The current app configuration does not request access to the camera, microphone, contacts, photos, media library, device location, or tracking permission. The app uses haptic feedback and an internet connection for purchase services, consent messages, and advertising.

## Retention and privacy requests

Game progress remains in the app's local storage until the app or its app data is removed. Apple, Google, and RevenueCat control retention of information they process through their services under their own policies and legal obligations.

To ask a privacy question or make a request concerning Ramen Profitable, email **ramenprofitablegame@gmail.com** [CAPTAIN TO CONFIRM]. Because the app has no user account and does not send the operator a custom RevenueCat user identifier, the operator may need information from an app-store purchase record to investigate a purchase-related request.

## Changes to this policy

If Ramen Profitable's data practices change, this policy will be updated. The effective date above identifies the published version.

---

## Implementation evidence for publication review

This section is not part of the public policy copy.

- Local game persistence is implemented with AsyncStorage in [`src/state/gameStore.ts`](../src/state/gameStore.ts), using the allowlist in [`src/state/experience.ts`](../src/state/experience.ts). The app source contains no developer-operated network client or general-purpose analytics integration.
- RevenueCat is configured in [`src/monetization/purchases.ts`](../src/monetization/purchases.ts) with only an API key. The app reads `CustomerInfo`, presents a RevenueCat paywall, purchases, and restores purchases. It does not call RevenueCat login, identity, attribute, email, phone, or attribution APIs.
- AdMob and UMP are initialized and gated in [`src/monetization/ads.ts`](../src/monetization/ads.ts). [`src/components/PhoneBillboard.tsx`](../src/components/PhoneBillboard.tsx) sets `requestNonPersonalizedAdsOnly: true` on every banner request.
- [`app.config.js`](../app.config.js) and [`plugins/with-admob-safety.js`](../plugins/with-admob-safety.js) configure AdMob for iOS. [`package.json`](../package.json) excludes the ads module from Android autolinking. The app does not configure `NSUserTrackingUsageDescription` or install an ATT request library.
- [`App.tsx`](../App.tsx) starts RevenueCat and the UMP consent-information refresh after local state hydration.
- The active European regulations and US state regulations messages, and the disabled automatic banner refresh setting, are captain-controlled AdMob console facts verified on 2026-09-19. They cannot be proven from this repository.

## App Store Connect App Privacy worksheet

**This worksheet is for the captain. It is not a completed App Privacy declaration and does not supply answers on the captain's behalf.** For every question, the captain must compare the evidence below with the final signed archive, Apple's definitions, current Google and RevenueCat disclosures, and the live dashboard configuration. A dependency's presence is evidence to investigate, not proof that every data type it can process is collected in this app's configuration.

1. **Does this app or any third-party partner collect data from the app?**
   - Code evidence: the app invokes Google Mobile Ads and UMP in [`src/monetization/ads.ts`](../src/monetization/ads.ts) and RevenueCat in [`src/monetization/purchases.ts`](../src/monetization/purchases.ts). Local game state is persisted with AsyncStorage.
   - Captain review: determine the declaration from the providers' current disclosures, the final privacy report, and production dashboard settings.

2. **Contact Info: name, email address, phone number, physical address, or other contact information?**
   - Code evidence: there is no account, profile, contact form, or RevenueCat identity/attribute call in the app source. The support email is displayed in this policy, not collected by the app.
   - Captain review: account for support communications and any provider-side configuration outside the app before answering.

3. **Health & Fitness: health or fitness data?**
   - Code evidence: no HealthKit, fitness API, permission, or health/fitness field appears in the app configuration or source.
   - Captain review: verify the final archive has no additional integration.

4. **Financial Info: payment information, credit information, or other financial information?**
   - Code evidence: purchases are initiated through RevenueCat and Apple's store APIs in [`src/monetization/purchases.ts`](../src/monetization/purchases.ts); the app has no payment-card input or storage.
   - Captain review: apply Apple's distinction between payment information and purchase history using current provider disclosures.

5. **Location: precise location or coarse location?**
   - Code evidence: the app requests no location permission and calls no location API. Google Mobile Ads is a network SDK, so provider documentation and the signed archive bear on whether IP-derived coarse location must be declared.
   - Captain review: decide each location subtype from the actual provider behavior and configuration.

6. **Sensitive Info?**
   - Code evidence: the game has no account profile or fields for racial or ethnic data, sexual orientation, pregnancy, disability, religion, political affiliation, trade-union membership, genetic information, or biometric identifiers.
   - Captain review: verify no provider or external support workflow changes this evidence.

7. **Contacts: the user's address book, phone contacts, or social graph?**
   - Code evidence: there is no contacts permission or contacts API. Chirp is generated fictional content stored in local game state.
   - Captain review: verify the final archive has no additional integration.

8. **User Content: emails or text messages, photos or videos, audio, gameplay content, customer support, or other user content?**
   - Code evidence: the app has no free-text composer, media picker, recorder, upload path, or developer server. Projects and Chirp posts are generated game state stored through AsyncStorage.
   - Captain review: separately consider information a user may voluntarily send through the external support email.

9. **Browsing History?**
   - Code evidence: the app has no browser-history API or in-app browsing-history store. Ad destinations are controlled by the Google banner SDK.
   - Captain review: check Google's current disclosure for the configured ad product rather than inferring an answer from the application UI.

10. **Search History?**
    - Code evidence: the app provides no search feature and stores no search terms.
    - Captain review: verify the final archive and provider configuration.

11. **Identifiers: user ID or device ID?**
    - Code evidence: RevenueCat is configured without a custom app user ID, while the RevenueCat SDK may create its own anonymous identifier. The app does not request IDFA access. Google Mobile Ads remains a device/network SDK even though each request is non-personalized.
    - Captain review: determine each identifier subtype from current RevenueCat and Google disclosures, the final archive, and dashboard settings.

12. **Purchases: purchase history or purchase tendencies?**
    - Code evidence: [`src/monetization/purchases.ts`](../src/monetization/purchases.ts) receives RevenueCat `CustomerInfo`, offering, purchase, restore, and entitlement results. Go Indie status is also persisted locally.
    - Captain review: determine what RevenueCat and Apple transmit or retain and which Apple data subtype applies.

13. **Usage Data: product interaction, advertising data, or other usage data?**
    - Code evidence: AdMob renders a banner and reports load, open, close, and failure callbacks to the app in [`src/components/PhoneBillboard.tsx`](../src/components/PhoneBillboard.tsx). The app does not send gameplay interaction to a developer analytics service.
    - Captain review: use Google's current disclosure and actual dashboard features to decide each subtype.

14. **Diagnostics: crash data, performance data, or other diagnostic data?**
    - Code evidence: there is no separate crash-reporting SDK. Google Mobile Ads, UMP, and RevenueCat are native network SDKs that may perform their own diagnostics.
    - Captain review: inspect each bundled SDK privacy manifest and the final Xcode privacy report, then compare them with provider documentation.

15. **Surroundings: environment scanning?**
    - Code evidence: there is no camera, scene, lidar, augmented-reality, or environment-scanning integration.
    - Captain review: verify the final archive has no additional integration.

16. **Body: hands, head, or other body data?**
    - Code evidence: there is no motion/body tracking, Vision Pro body API, camera permission, or related dependency in the app.
    - Captain review: verify the final archive has no additional integration.

17. **Other Data: any type not listed above?**
    - Code evidence: local game fields are enumerated by `persistedStateKeys` in [`src/state/experience.ts`](../src/state/experience.ts); third-party integrations are limited to the services identified above.
    - Captain review: check the signed archive and production services for anything not represented in the source audit.

18. **For every data type the captain decides is collected, what is each purpose?** Apple asks about third-party advertising, developer advertising or marketing, analytics, product personalization, app functionality, and other purposes.
    - Code evidence: AdMob is used only for the in-game banner; RevenueCat is used for offering, purchase, restore, and entitlement functionality. The app has no developer marketing or gameplay analytics integration.
    - Captain review: assign purposes using Apple's definitions and provider behavior. Do not copy a purpose solely because an SDK supports it.

19. **For every collected data type, is it linked to the user's identity?**
    - Code evidence: the app creates no account, sends no custom identifier to RevenueCat, and sends no purchase identity to AdMob. SDK-generated or app/device-scoped identifiers may still fall under Apple's linked-data definition.
    - Captain review: make this determination using Apple's definition and current provider disclosures.

20. **For every collected data type, is it used for tracking?**
    - Code evidence: every app-originated banner request is non-personalized, no ATT prompt is requested, and no IDFA explainer or `NSUserTrackingUsageDescription` exists. The code does not integrate cross-company tracking or attribution APIs.
    - Captain review: answer the declaration personally after checking the final signed archive and all AdMob and RevenueCat dashboard features. Do not create an ATT prompt or IDFA explainer to make a declaration fit.

21. **Does the Privacy Policy URL point to the live policy that matches the submitted app?**
    - Code evidence: this file is only the publication source and the site lives in another repository.
    - Captain review: approve the final text, replace all confirmation markers, publish it on the privacy page under <https://ramen.clayj.app>, verify the exact public URL, and only then enter that URL in App Store Connect.

Useful references for the captain's review: [Apple App Privacy details](https://developer.apple.com/app-store/app-privacy-details/), [Google Mobile Ads data disclosure](https://developers.google.com/admob/ios/privacy/data-disclosure), [Google UMP](https://developers.google.com/admob/ios/privacy), and [RevenueCat Apple privacy guidance](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy).
