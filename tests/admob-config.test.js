const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const { TEST_IDS, resolveAdMob } = require('../config/admob');
const production = { appId: 'ca-app-pub-1111111111111111~2222222222', bannerId: 'ca-app-pub-1111111111111111/3333333333' };

test('development always resolves the official sample inventory', () => {
  assert.deepEqual(resolveAdMob(true, { ADMOB_IOS_APP_ID: production.appId }), TEST_IDS);
});
test('release resolution carries iOS inventory without global validation', () => {
  assert.deepEqual(
    resolveAdMob(false, { ADMOB_IOS_APP_ID: production.appId, ADMOB_IOS_BANNER_ID: production.bannerId }),
    { ios: production },
  );
  assert.deepEqual(resolveAdMob(false, {}), {
    ios: { appId: undefined, bannerId: undefined },
  });
});
test('native build executable rejects missing and test inventory regardless of environment', () => {
  const missing = spawnSync(process.execPath, ['scripts/check-admob-release.js', '', ''], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /AdMob RELEASE BLOCKED/);
  const result = spawnSync(process.execPath, ['scripts/check-admob-release.js', TEST_IDS.ios.appId, TEST_IDS.ios.bannerId], { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'development', EAS_BUILD_PROFILE: 'development' } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AdMob RELEASE BLOCKED/);
  assert.equal(spawnSync(process.execPath, ['scripts/check-admob-release.js', production.appId, production.bannerId]).status, 0);
});
test('Expo config consumer permits release evaluation without iOS IDs', () => {
  for (const mode of [{ EAS_BUILD_PROFILE: 'preview' }, { EAS_BUILD_PROFILE: 'production' }, { NODE_ENV: 'production' }]) {
    const result = spawnSync(process.execPath, ['-e', "process.stdout.write(JSON.stringify(require('./app.config')({config:{}}).extra.admob))"], { encoding: 'utf8', env: { ...process.env, REVENUECAT_BUILD_MODE: '', EAS_BUILD_PROFILE: '', NODE_ENV: '', ADMOB_IOS_APP_ID: '', ADMOB_IOS_BANNER_ID: '', ...mode } });
    assert.equal(result.status, 0, result.stderr || JSON.stringify(mode));
    assert.deepEqual(JSON.parse(result.stdout), {
      ios: { appId: '', bannerId: '' },
    });
  }
});
test('Expo config consumer rejects undeclared EAS profiles before monetization selection', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./app.config')({config:{}})"], { encoding: 'utf8', env: { ...process.env, REVENUECAT_BUILD_MODE: '', EAS_BUILD_PROFILE: 'custom-store', NODE_ENV: '' } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported EAS_BUILD_PROFILE="custom-store"/);
});
test('declared development profiles use sample inventory regardless of NODE_ENV', () => {
  const result = spawnSync(process.execPath, ['-e', "process.stdout.write(JSON.stringify(require('./app.config')({config:{}}).extra.admob))"], { encoding: 'utf8', env: { ...process.env, REVENUECAT_BUILD_MODE: '', EAS_BUILD_PROFILE: 'development', NODE_ENV: 'production', ADMOB_IOS_APP_ID: '', ADMOB_IOS_BANNER_ID: '' } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), TEST_IDS);
});
