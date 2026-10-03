# Paywall discovery validation

Validated using Astra, the real Expo Debug client, and a task-owned iPhone SE (3rd generation) simulator on iOS 26.5. Viewport: 375 x 667 points. Images are native 2x screenshots exported from XCUITest attachments, not browser mockups.

## Reproduction and result

Before: approval offered only Continue to Home and Go Indie. The fictional app's setup action was a small PAYWALL label below the fold in Your apps.

After: approval offers **Set up paywall**, explicitly described as free in-game design. Continue to Home and Go Indie remain available. Home shows a next-step card for the first live app without a paywall, including after relaunch or cancellation. Shipping the paywall removes that app's reminder. No tutorial flag, persistence migration, purchase SDK change, or new game mechanic was added.

| Native evidence | What it demonstrates |
| --- | --- |
| [Before approval](evidence/paywall-discovery/before-approval.png) / [before portfolio](evidence/paywall-discovery/before-portfolio.png) | Original missing cue and buried action |
| [Approval](evidence/paywall-discovery/approval.png) | Setup, Continue and Go Indie fit on the small iPhone |
| [Returning Home](evidence/paywall-discovery/returning-home.png) | Persistent, above-the-fold setup action after a cold relaunch |
| [Designer ready](evidence/paywall-discovery/designer-ready.png) | Existing four-axis designer reached and completed through the new action |
| [Completed Home](evidence/paywall-discovery/completed-home.png) | Reminder disappears after shipping |
| [Large approval actions](evidence/paywall-discovery/large-approval-actions.png) / [large Home](evidence/paywall-discovery/large-home.png) | Scrollable actions and wrapping with accessibility-large Dynamic Type and a long app name |

## Checks

- `npm test`: 98 passing tests.
- `npm run typecheck`: passes.
- `git diff --check`: passes.
- `tests/paywall-discovery.test.js` renders the real Home, OverlayHost and Designer against the real Zustand store, mocking native APIs. Covers exact app ID routing with duplicate names, free setup at zero cash, cancellation, Continue, save rehydration, multiple pending apps, shipping/reminder removal, rejected/new players, unchanged $75 A/B tests, button roles/states, and the separate deliberate Go Indie purchase boundary.
- Task-scoped XCUITest runs passed for before-change reproduction; approval -> setup -> cancel -> Home -> terminate/relaunch -> setup -> all four choices -> ship; long-name approval/setup/cancellation; and returning-player large-text layout.
- Native setup controls were located through their accessibility button labels, checked for a minimum 44-point height, and tapped on the simulator. Large-text controls remained within the 375-point width and reachable by scrolling. Approval now contains its accessibility focus and scrolls instead of overflowing; shared multiline buttons and adjacent Home labels wrap.

Native fixtures seeded a completed PlantParent project and `rejectShield: 0` in the existing `ramen-profitable-v1` save, then used the actual Submit to App Review button and timed review. The extended-text fixture used `PlantParent With A Very Long App Name` and `simctl ui <task-udid> content_size accessibility-large`. These fixture settings were not added to the app.

Scope: simulator accessibility hierarchy and Dynamic Type were tested, not a manual VoiceOver listening session or a real-money transaction. Code-ring, achievement mechanics and advertising integration were left unchanged.
