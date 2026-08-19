# Ramen Profitable App Store text metadata draft

> **DRAFT — UNPUBLISHED AND NOT SUBMITTED.** This copy is grounded in freshly fetched `origin/main` at `b7d39848e7d830bcb8d2ab31ff562293fc60151c`. It has not been entered in App Store Connect and does not imply that the app, production purchase configuration, privacy policy, or listing is approved or live. The privacy draft's effective date remains a captain-approved placeholder to fill at publication.
>
> The privacy policy remains behind captain decision `approve-ramen-profitable-privacy-policy`. Approval means the captain has read and approved the exact public-policy copy in [`PRIVACY_POLICY_DRAFT.md`](./PRIVACY_POLICY_DRAFT.md), including its operator/contact/date and RevenueCat disclosures, before any publication or App Store privacy-policy use. Do not close that decision without the captain's answer.

## Subtitle

```text
Ship Apps. Quit Your Day Job.
```

29 characters; Apple's current limit is 30 characters.

## Keywords

```text
idle,indie developer,studio,incremental,simulation,startup,tycoon,clicker,paywall,business
```

90 UTF-8 bytes; Apple's current limit is 100 bytes. The list does not repeat the app name or another company/app name.

## Description

```text
Your day job pays the bills. Your midnight apps might buy your freedom.

Ramen Profitable is an idle game about the messy, funny climb from first line of code to enough fictional monthly recurring revenue to quit.

WRITE AND SHIP
Start a fictional app, tap to write lines of code, manage energy, and submit it to a simulated App Review. Approval is never guaranteed.

BUILD A PORTFOLIO
Earn simulated cash and MRR from live apps. Buy in-game upgrades for faster coding, stronger energy, better review odds, and broader reach. Earnings continue while you're away, capped at eight hours.

DESIGN THE PAYWALLS
Choose the fictional price, trial, headline, and close button for each app. Chase conversion, resist dark patterns—or deal with the consequences in your stats and Chirp feed.

SURVIVE THE INTERNET
Rejections, churn, surprise events, achievements, and a fully fictional social feed turn the climb into its own indie-developer story.

QUIT THE DAY JOB
Reach $2,000 in fictional MRR, send the resignation email, and become ramen profitable.

OPTIONAL ONE-TIME UNLOCK
Go Indie is an optional one-time in-app purchase, not a subscription. It permanently doubles your character's offline earnings. Purchases can be restored from the Store screen.

Ramen Profitable is a game. All apps, revenue, reviews, posts, and business results shown in the game are fictional.
```

The description is below Apple's 4,000-character limit and uses plain text only.

## What's New

**Version 1.0.0:** no What's New text should be entered. Apple's current App Store Connect reference says the field is unavailable for an app's first version and required only for subsequent versions. Draft truthful value:

```text
Not applicable for the first App Store version.
```

Do not paste that sentence into another metadata field. Draft fresh What's New copy from the actual diff when a subsequent version exists.

## Claim audit

| Listing claim | Shipped implementation evidence |
| --- | --- |
| Tap to build apps, manage energy, and submit to simulated review. | [`src/screens/CodeScreen.tsx`](../src/screens/CodeScreen.tsx#L103-L229) exposes the build loop; [`src/state/gameStore.ts`](../src/state/gameStore.ts#L154-L211) implements project creation, coding, submission, rejection, and approval. |
| Build a portfolio, buy upgrades, and reach $2,000 fictional MRR. | [`src/state/gameStore.ts`](../src/state/gameStore.ts#L223-L268) implements upgrades, earnings, achievements, and the quit condition; [`src/content/content.ts`](../src/content/content.ts#L73-L89) defines the shipped upgrades; [`src/content/content.ts`](../src/content/content.ts#L120) sets the $2,000 goal. |
| Design fictional paywalls and face conversion/heat consequences. | [`src/components/PaywallDesigner.tsx`](../src/components/PaywallDesigner.tsx#L10-L87) provides the minigame UI; [`src/content/content.ts`](../src/content/content.ts#L122-L180) defines its choices and events; [`src/state/gameStore.ts`](../src/state/gameStore.ts#L283-L326) applies the results. |
| Fictional Chirp feed, events, and achievements. | [`src/state/gameStore.ts`](../src/state/gameStore.ts#L135-L152) generates and mutates local posts; [`src/content/content.ts`](../src/content/content.ts#L46-L71) defines events; [`src/content/content.ts`](../src/content/content.ts#L183-L199) defines achievements. |
| Offline earnings are capped at eight hours. | [`src/state/gameStore.ts`](../src/state/gameStore.ts#L337-L348) implements the cap and earnings calculation. |
| Go Indie is an optional one-time unlock that doubles offline earnings and can be restored. | [`src/monetization/purchases.ts`](../src/monetization/purchases.ts#L1-L8) identifies the non-consumable unlock; [`README.md`](../README.md#L38-L47) records the lifetime entitlement; [`src/state/gameStore.ts`](../src/state/gameStore.ts#L337-L348) implements the 2× benefit; [`src/screens/StoreScreen.tsx`](../src/screens/StoreScreen.tsx#L36-L57) implements restore. |

## Explicit exclusions and release boundary

- No monthly-subscription claim appears in the listing. Monthly prices and subscribers inside gameplay are fictional simulation content, not Ramen Profitable purchase terms.
- No ad-removal claim appears. The current app has no ad SDK or shipped real-ad feature; roadmap references are not represented as shipped functionality.
- No claim says Chirp is an online network or that game revenue is real.
- No price is hardcoded because the app displays RevenueCat's remotely configured current offering.
- Screenshots are sponsor-perk scope and were not created, modified, audited for submission, or submitted in this task.
- App Store Connect, RevenueCat dashboards, production credentials, and captain-owned purchase configuration were not accessed. The captain must confirm that the actual released product and paywall remain a one-time Go Indie unlock before using this copy.

## Store-reference checks

- [Apple App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information): subtitle limit and required privacy-policy URL.
- [Apple Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information): description, keyword, and What's New limits and first-version availability.
