export type ApprovedVerdictAction = 'continue' | 'go-indie';

type ApprovedVerdictActionHandlers = {
  dismissOverlay: () => void;
  returnHome: () => void;
  openGoIndiePaywall: () => void;
};

export function handleApprovedVerdictAction(
  action: ApprovedVerdictAction,
  handlers: ApprovedVerdictActionHandlers,
) {
  if (action === 'continue') {
    handlers.dismissOverlay();
    handlers.returnHome();
    return;
  }

  handlers.openGoIndiePaywall();
}
