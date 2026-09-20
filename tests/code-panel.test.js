const assert = require('node:assert/strict');
const test = require('node:test');

async function loadCodePanel() {
  return import('../src/content/codePanel.ts');
}

async function loadContent() {
  return import('../src/content/content.ts');
}

test('manual taps reveal more current-project source without a second progress clock', async () => {
  const { projectCodeView } = await loadCodePanel();
  const untouched = projectCodeView({ name: 'Caffiend', idea: 'coffee', loc: 0, need: 300 });
  const firstTap = projectCodeView({ name: 'Caffiend', idea: 'coffee', loc: 3, need: 300 });
  const later = projectCodeView({ name: 'Caffiend', idea: 'coffee', loc: 90, need: 300 });

  assert.equal(untouched.source, '');
  assert.ok(firstTap.source.length >= 18);
  assert.ok(later.source.length > firstTap.source.length);
  assert.match(later.source, /shots|coffee/);
});

test('every catalog app has authored source and project changes replace the panel', async () => {
  const { APP_IDEAS } = await loadContent();
  const { PROJECT_CODE, projectCodeView } = await loadCodePanel();

  for (const [name] of APP_IDEAS) {
    assert.equal(typeof PROJECT_CODE[name], 'string', `${name} needs authored source`);
    assert.ok(PROJECT_CODE[name].split('\n').length >= 5, `${name} needs a readable code joke`);
  }

  const plant = projectCodeView({ name: 'PlantParent', idea: 'plants', loc: 100, need: 100 });
  const dog = projectCodeView({ name: 'DogNal', idea: 'dogs', loc: 100, need: 100 });
  assert.notEqual(plant.source, dog.source);
  assert.match(plant.source, /soil|plant/);
  assert.match(dog.source, /bark|dog/);
});

test('NomadRank visibly preserves wifi, rent, then visa ranking order', async () => {
  const { PROJECT_CODE } = await loadCodePanel();
  const source = PROJECT_CODE.NomadRank;

  assert.ok(source.indexOf('wifiSpeed') < source.indexOf('rent'));
  assert.ok(source.indexOf('rent') < source.indexOf('visaLength'));
});

test('depletion hands focus to buffered code and completion reveals the whole file', async () => {
  const { codePanelMode, codePanelStatus, projectCodeView, PROJECT_CODE } = await loadCodePanel();

  assert.equal(codePanelMode({ done: false, energy: 0.2, autoCode: 0 }), 'depleted');
  assert.equal(codePanelStatus('depleted'), 'ENERGY EMPTY · CODE BUFFER');

  const complete = projectCodeView({ name: 'Tabsy', idea: 'tabs', loc: 400, need: 400 });
  assert.equal(complete.complete, true);
  assert.equal(complete.source, PROJECT_CODE.Tabsy);
  assert.equal(codePanelMode({ done: true, energy: 0, autoCode: 6 }), 'complete');
});

test('Claude takeover makes automation the lead and lands the reviewer joke', async () => {
  const { automationReviewerLine, codePanelMode, codePanelStatus, projectCodeView } = await loadCodePanel();
  const before = projectCodeView({ name: 'Standupp', idea: 'standups', loc: 60, need: 300 });
  const afterTick = projectCodeView({ name: 'Standupp', idea: 'standups', loc: 63, need: 300 });

  assert.equal(codePanelMode({ done: false, energy: 50, autoCode: 6 }), 'automated');
  assert.equal(codePanelStatus('automated', 6), 'AUTO-WRITING · 6 LOC/S');
  assert.equal(automationReviewerLine(6), '6 LOC/sec. You have been promoted to code reviewer.');
  assert.ok(afterTick.source.length > before.source.length);
});

test('paywall reveal mirrors committed choices and cynical choices produce worse code', async () => {
  const { paywallCodeView } = await loadCodePanel();
  const clean = paywallCodeView({
    mult: 1,
    dark: 0,
    delta: { before: 100, after: 100 },
    choices: { price: 'mid', trial: 'week', headline: 'honest', close: 'big' },
  });
  const hostile = paywallCodeView({
    mult: 2,
    dark: 8,
    delta: { before: 100, after: 200 },
    choices: { price: 'confident', trial: 'forget', headline: 'unhinged', close: 'delayed' },
  });

  assert.equal(clean.quality, 'clean');
  assert.match(clean.source, /accessibleDismissButton/);
  assert.match(clean.source, /size=\{44\} alwaysVisible/);
  assert.equal(hostile.quality, 'hostile');
  assert.match(hostile.source, /\/mo omitted/);
  assert.match(hostile.source, /hope they forget/);
  assert.match(hostile.source, /LAST CHANCE/);
  assert.match(hostile.source, /5000/);
  assert.match(hostile.source, /tests\.disable/);
});
