const assert = require('node:assert/strict');
const test = require('node:test');

async function loadApprovedVerdictActions() {
  return import('../src/components/approvedVerdictActions.ts');
}

test('approved verdict can return Home without presenting the Go Indie paywall', async () => {
  const { handleApprovedVerdictAction } = await loadApprovedVerdictActions();
  let overlay = 'approved-verdict';
  let tab = 'code';
  let paywallPresentations = 0;

  const presentGoIndiePaywall = () => {
    paywallPresentations += 1;
  };

  handleApprovedVerdictAction('continue', {
    dismissOverlay: () => {
      overlay = null;
    },
    returnHome: () => {
      tab = 'home';
    },
    openGoIndiePaywall: presentGoIndiePaywall,
  });

  assert.equal(overlay, null);
  assert.equal(tab, 'home');
  assert.equal(paywallPresentations, 0);
});

test('approved verdict keeps Go Indie as an optional purchase path', async () => {
  const { handleApprovedVerdictAction } = await loadApprovedVerdictActions();
  let dismissals = 0;
  let homeReturns = 0;
  let paywallPresentations = 0;

  handleApprovedVerdictAction('go-indie', {
    dismissOverlay: () => {
      dismissals += 1;
    },
    returnHome: () => {
      homeReturns += 1;
    },
    openGoIndiePaywall: () => {
      paywallPresentations += 1;
    },
  });

  assert.equal(dismissals, 0);
  assert.equal(homeReturns, 0);
  assert.equal(paywallPresentations, 1);
});
