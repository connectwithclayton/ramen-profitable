import type { PaywallTransaction } from '../state/experience';

const lines = (...value: string[]) => value.join('\n');

/** Hand-authored source for every app in APP_IDEAS. The joke should follow the project, not the mechanic. */
export const PROJECT_CODE: Readonly<Record<string, string>> = {
  PlantParent: lines(
    'let thirst = soil.daysSinceWatered',
    'let dramatic = plant.name == "Fernie"',
    'if thirst > plant.tolerance {',
    '  notify("water me, coward")',
    '}',
    'plant.alive = confidence > 0.12',
  ),
  DogNal: lines(
    'let thought = await transcribe(bark)',
    'let mood = tail.wags > 3 ? "deep" : "snack"',
    'journal.append(.init(',
    '  author: dog.name, mood: mood,',
    '  body: thought ?? "mailman again"',
    '))',
  ),
  GrudgeList: lines(
    'let offense = Grudge("liked, no reply")',
    'offense.severity = .historical',
    'offense.remindAt = everyThanksgiving',
    'backlog.insert(offense, at: 0)',
    'sort(by: { $0.pettiness > $1.pettiness })',
    'forgiveButton.isHidden = true',
  ),
  SleepShame: lines(
    'let snoozes = alarm.snoozeCount + 1',
    'if snoozes >= 2 {',
    '  groupChat.post(',
    '    "still in bed", photo: frontCamera',
    '  )',
    '}',
  ),
  Fridgely: lines(
    'let yogurt = fridge.scan("back left")',
    'let date = yogurt.expiry ?? .yesterday',
    'if date < today {',
    '  confidence = 0.41',
    '  notify("probably time to smell it")',
    '}',
  ),
  GymGhost: lines(
    'let absence = today - lastCheckIn',
    'streakLabel.text = "day \\(absence)"',
    'if absence > .weeks(3) {',
    '  status = .payingForTheIdeaOfFitness',
    '}',
    'chart.render(data: [oneJanuaryWorkout])',
  ),
  LoreKeeper: lines(
    'let npc = campaign.npc(named: "Garth")',
    'npc.aliases += ["Gorth", "Greg?"]',
    'npc.secret = "betrays party in act 3"',
    'notes.link(npc, to: tavernFire)',
    'players.markAsUnread(npc.backstory)',
    'dm.sigh(volume: 0.8)',
  ),
  Caffiend: lines(
    'let shots = coffees.reduce(0, +)',
    'let verdict = shots < 3 ? "civilian" : "concern"',
    'log.append(.espresso(shots: shots))',
    'heartRate.estimate(from: shots)',
    'widget.render(verdict.uppercased())',
    'sleep.schedule = .optimistic',
  ),
  Splitsies: lines(
    'let receipt = scan(blurryPhoto)',
    'let fries = assignToEveryone(receipt.fries)',
    'let debt = total / friends.count',
    'groupChat.send("you each owe $\\(debt)")',
    'friendship.health -= disputedGuac',
    'venmo.request(roundUp: true)',
  ),
  ZenNudge: lines(
    'breath.inhale(for: 4)',
    'breath.hold(for: 7)',
    'breath.exhale(for: 8)',
    'if notifications.ignored > 2 {',
    '  audio.play("passive_aggressive_sigh")',
    '}',
  ),
  Regrets: lines(
    'let archive = photos.filter {',
    '  $0.year < 2016 && $0.haircut.isQuestionable',
    '}',
    'memory.title = "you chose this"',
    'memory.images = archive.shuffled()',
    'shareButton.label = "absolutely not"',
  ),
  InboxZeroHero: lines(
    'let unread = inbox.messages.count',
    'inbox.archive(all: true)',
    'ambition.archive(all: true)',
    'badge.value = 0',
    'confetti.fire(duration: 0.6)',
    'assert(inbox.messages.count > 12000)',
  ),
  Tabsy: lines(
    'let tabs = browser.windows.flatMap(\\.tabs)',
    'vault.save(tabs)',
    'browser.close(tabs)',
    'badge.text = "\\(tabs.count) saved"',
    'vault.lastOpened = nil',
    'problem.status = .relocated',
  ),
  Subscript: lines(
    'let charges = bank.findRecurring()',
    'let forgotten = charges.filter(\\.feelsUnfamiliar)',
    'report.total = forgotten.sum(\\.monthlyCost)',
    'report.add(ourPlan: "$4.99/mo")',
    'cancelFlow.steps = 11',
    'irony = .recurring',
  ),
  Focusly: lines(
    'let blocked = ["Chirp", "Shorts", "Mail"]',
    'focus.block(blocked)',
    'escape.title = "just 5 more minutes"',
    'escape.onTap = { focus.pause(minutes: 5) }',
    'escape.tapCount += 1',
    'productivity = max(0, intent - escape.tapCount)',
  ),
  Wordlike: lines(
    'let answer = dictionary.dailyWord(length: 5)',
    'let guesses = Array(repeating: "", count: 6)',
    'grid.colors = [.gray, .yellow, .greenish]',
    'shareResult(useSquares: true)',
    'legal.review(name: "legally distinct")',
    'streak.resetIf(timezoneChanged: true)',
  ),
  Standupp: lines(
    'let commits = git.log(since: .yesterday)',
    'let impressive = commits.map(rewriteAsImpact)',
    'update.yesterday = impressive.joined()',
    'update.today = "continue implementation"',
    'update.blockers = "none"',
    'slack.post(update, at: "09:01")',
  ),
  Reciply: lines(
    'let page = await fetch(recipeURL)',
    'let lifeStory = page.text.before("Ingredients")',
    'page.remove(lifeStory)',
    'page.remove(popups: 7)',
    'return page.section(named: "Ingredients")',
    '// grandmother safely omitted',
  ),
  Gratitud: lines(
    'let entry = JournalEntry(date: today)',
    'entry.goodThings = prompt(count: 3)',
    'if lastEntry.month == .march {',
    '  streak.label = "welcome back"',
    '}',
    'cloud.sync(entry, eventually: true)',
  ),
  Bookshelfie: lines(
    'let owned = shelf.scanAll()',
    'let finished = owned.filter(\\.didActuallyFinish)',
    'stats.ratio = finished.count / owned.count',
    'stats.hideIfEmbarrassing = true',
    'wishlist.append(anotherHardcover)',
    'shelf.spaceRemaining = 0',
  ),
  MacroMate: lines(
    'let burrito = Meal("lunch")',
    'burrito.add(.tortilla)',
    'burrito.add(.rice, .beans, .salsa)',
    'burrito.add(.cheese, .guac)',
    'assert(burrito.ingredients.count == 6)',
    'macros.recalculate(times: 4)',
  ),
  NoiseFloor: lines(
    'let sounds = Library.rain(count: 11)',
    'sounds += [.fan, .cafe, .brownNoise]',
    'mixer.play(sounds[3], volume: 0.42)',
    'timer.fadeOut(after: .hours(8))',
    'premium.lock(theGoodThunder)',
    'sleep = .maybe',
  ),
  NomadRank: lines(
    'let ranked = cities.sorted { a, b in',
    '  if a.wifiSpeed != b.wifiSpeed {',
    '    return a.wifiSpeed > b.wifiSpeed',
    '  } else if a.rent != b.rent {',
    '    return a.rent < b.rent',
    '  }',
    '  return a.visaLength > b.visaLength',
    '}',
  ),
  Unread: lines(
    'let queue = podcasts.filter(\\.subscribed)',
    'let unplayed = queue.flatMap(\\.episodes)',
    'badge.text = "\\(unplayed.count) unheard"',
    'queue.sort(by: oldestFirst)',
    'recommend(threeMoreShows)',
    'listeningTime.available = 0',
  ),
};

export type CodePanelMode = 'manual' | 'depleted' | 'automated' | 'complete';

export function automationReviewerLine(rate: number) {
  return `${rate} LOC/sec. You have been promoted to code reviewer.`;
}

export function codePanelStatus(mode: CodePanelMode, automationRate = 0) {
  switch (mode) {
    case 'depleted': return 'ENERGY EMPTY · CODE BUFFER';
    case 'automated': return `AUTO-WRITING · ${automationRate} LOC/S`;
    case 'complete': return 'BUILD PASSED';
    default: return 'LOCAL CHANGES';
  }
}

export function codePanelMode({
  done,
  energy,
  autoCode,
}: {
  done: boolean;
  energy: number;
  autoCode: number;
}): CodePanelMode {
  if (done) return 'complete';
  if (autoCode > 0) return 'automated';
  if (energy < 1) return 'depleted';
  return 'manual';
}

export function projectSource(name: string, idea: string) {
  return PROJECT_CODE[name] ?? lines(
    `let app = Project(name: ${JSON.stringify(name)})`,
    `app.promise = ${JSON.stringify(idea)}`,
    'app.scope = .probablyTooLarge',
    'ship(app)',
  );
}

/** Source is derived from durable project progress, so there is no second progress clock to persist. */
export function projectCodeView({
  name,
  idea,
  loc,
  need,
}: {
  name: string;
  idea: string;
  loc: number;
  need: number;
}) {
  const source = projectSource(name, idea);
  const progress = need > 0 ? Math.max(0, Math.min(1, loc / need)) : 1;
  const visibleCharacters = Math.min(source.length, Math.ceil(source.length * progress));
  return {
    source: source.slice(0, visibleCharacters),
    complete: progress >= 1,
    progress,
  };
}

const PAYWALL_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  price: {
    cheap: 'const price = "$2.99/mo";',
    mid: 'const price = "$6.99/mo";',
    confident: 'const price = "$99.99/yr"; // /mo omitted',
  },
  trial: {
    none: 'const trialDays = 0;',
    week: 'const trialDays = 7;',
    forget: 'const trialHours = 72; // hope they forget',
  },
  headline: {
    honest: 'headline = "Unlock all features";',
    aspire: 'headline = "Become your best self";',
    unhinged: 'headline = "YOUR LAST CHANCE";',
  },
  close: {
    big: '<CloseButton size={44} alwaysVisible />',
    tiny: '<CloseButton size={12} opacity={0.18} />',
    delayed: 'setTimeout(showCloseButton, 5000);',
  },
};

export function paywallCodeView(transaction: PaywallTransaction) {
  const choices = transaction.choices ?? {};
  const sourceLines = ['function shipPaywall() {'];
  for (const axis of ['price', 'trial', 'headline', 'close']) {
    const choice = choices[axis];
    sourceLines.push(`  ${PAYWALL_LABELS[axis]?.[choice] ?? `// ${axis}: unset`}`);
  }
  sourceLines.push(
    transaction.dark >= 5
      ? '  tests.disable("hurts conversion");'
      : transaction.dark >= 3
        ? '  // TODO: ask legal after launch'
        : '  assert(accessibleDismissButton);',
  );
  sourceLines.push('}');
  return {
    source: sourceLines.join('\n'),
    quality: transaction.dark >= 5 ? 'hostile' : transaction.dark >= 3 ? 'questionable' : 'clean',
  } as const;
}
