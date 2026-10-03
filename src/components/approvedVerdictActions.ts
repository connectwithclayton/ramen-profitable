export type ApprovedVerdictAction = 'set-up-paywall' | 'continue' | 'go-indie';

type ApprovedVerdictActionHandlers = {
  dismissOverlay: () => void;
  returnHome: () => void;
  openGoIndiePaywall: () => void;
  setUpPaywall: () => void;
};

export function handleApprovedVerdictAction(
  action: ApprovedVerdictAction,
  handlers: ApprovedVerdictActionHandlers,
) {
  if (action === 'set-up-paywall') {
    handlers.returnHome();
    handlers.setUpPaywall();
    return;
  }

  if (action === 'continue') {
    handlers.dismissOverlay();
    handlers.returnHome();
    return;
  }

  handlers.openGoIndiePaywall();
}
