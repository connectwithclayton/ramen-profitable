export type StoryDelta = {
  metric: 'mrr' | 'cash';
  before: number;
  after: number;
};

type PaywallChoice = { id: string; mult: number; dark: number };
type PaywallAxis = { id: string; choices: PaywallChoice[] };

export type PaywallTransaction = {
  mult: number;
  dark: number;
  beforeMrr: number;
  afterMrr: number;
  delta: StoryDelta;
};

export const BETA_TESTER = ['Burnt Out Beta Tester', '@testflight_gremlin'] as const;
export const PLAYER = ['You', '@buildinpublic'] as const;

export function projectMilestoneId(projectId: string, milestone: string) {
  return `project:${projectId}:${milestone}`;
}

/** Project callbacks belong to one run of one project, even when an app name is reused. */
export function milestonesForProject(
  milestones: Record<string, boolean>,
  projectId: string,
): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(milestones).filter(([key]) => !key.startsWith('project:') || key.startsWith(`project:${projectId}:`)),
  );
}

export function secondsUntilNextLine(energy: number, energyRegen: number) {
  if (energy >= 1 || energyRegen <= 0) return 0;
  return Math.max(1, Math.ceil((1 - energy) / (energyRegen * 2)));
}

export function selectHomeReaction<T extends { id: string }>(
  chirps: T[],
  pinnedId: string | undefined,
  secondsLeft: number,
) {
  return (secondsLeft > 0 && chirps.find(chirp => chirp.id === pinnedId)) || chirps[0];
}

export function calculatePaywallTransaction({
  totalMrr,
  mrrMult,
  baseMrr,
  previousMult,
  picks,
  axes,
}: {
  totalMrr: number;
  mrrMult: number;
  baseMrr: number;
  previousMult: number;
  picks: Record<string, string>;
  axes: PaywallAxis[];
}): PaywallTransaction {
  let mult = 1;
  let dark = 0;
  for (const axis of axes) {
    const choice = axis.choices.find(candidate => candidate.id === picks[axis.id]);
    if (choice) {
      mult *= choice.mult;
      dark += choice.dark;
    }
  }
  mult = Math.round(mult * 100) / 100;

  const previousContribution = baseMrr * previousMult * mrrMult;
  const nextContribution = baseMrr * mult * mrrMult;
  const afterMrr = Math.max(0, totalMrr - previousContribution + nextContribution);

  return {
    mult,
    dark,
    beforeMrr: totalMrr,
    afterMrr,
    delta: { metric: 'mrr', before: totalMrr, after: afterMrr },
  };
}

export function paywallReaction(appName: string, transaction: PaywallTransaction, picks: Record<string, string>) {
  if (transaction.dark === 0) {
    return `shoutout to ${appName} for the most ethical paywall i've ever closed without paying`;
  }
  if (transaction.dark >= 5 && picks.close === 'delayed') {
    return `just saw the new ${appName} paywall... the X appears AFTER FIVE SECONDS?? screenshot saved.`;
  }
  if (transaction.dark >= 5) {
    return `just saw the new ${appName} paywall. growth found the heat slider and kept going.`;
  }
  return `I came for ${appName}. I stayed to find the close button.`;
}

export function financialDeltas(
  before: { mrr: number; cash: number },
  patch: { mrr?: number; cash?: number },
): StoryDelta[] {
  const deltas: StoryDelta[] = [];
  if (typeof patch.mrr === 'number' && patch.mrr !== before.mrr) {
    deltas.push({ metric: 'mrr', before: before.mrr, after: patch.mrr });
  }
  if (typeof patch.cash === 'number' && patch.cash !== before.cash) {
    deltas.push({ metric: 'cash', before: before.cash, after: patch.cash });
  }
  return deltas;
}
