const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const { TEST_IDS, resolveAdMob } = require('../config/admob');
const production = { appId: 'ca-app-pub-1111111111111111~2222222222', bannerId: 'ca-app-pub-1111111111111111/3333333333' };

test('development always resolves the official sample inventory', () => {
  assert.deepEqual(resolveAdMob(true, 'ios', { ADMOB_IOS_APP_ID: production.appId }), TEST_IDS);
});
test('release rejects absent, malformed, sample app, and sample banner IDs', () => {
  for (const ids of [{}, TEST_IDS.ios, { ...production, appId: TEST_IDS.ios.appId }, { ...production, bannerId: TEST_IDS.ios.bannerId }, { ...production, appId: 'invalid' }]) {
    assert.throws(() => resolveAdMob(false, 'ios', { ADMOB_IOS_APP_ID: ids.appId, ADMOB_IOS_BANNER_ID: ids.bannerId }), /AdMob RELEASE BLOCKED/);
  }
  assert.deepEqual(resolveAdMob(false, 'ios', { ADMOB_IOS_APP_ID: production.appId, ADMOB_IOS_BANNER_ID: production.bannerId }).ios, production);
});
test('native build executable rejects test inventory regardless of environment', () => {
  for (const platform of ['ios', 'android']) {
    const result = spawnSync(process.execPath, ['scripts/check-admob-release.js', platform, TEST_IDS[platform].appId, TEST_IDS[platform].bannerId], { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'development', EAS_BUILD_PROFILE: 'development' } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /AdMob RELEASE BLOCKED/);
  }
  assert.equal(spawnSync(process.execPath, ['scripts/check-admob-release.js', 'ios', production.appId, production.bannerId]).status, 0);
});
test('Expo config consumer refuses preview, production, unknown EAS, and local production builds without live IDs', () => {
  for (const mode of [{ EAS_BUILD_PROFILE: 'preview' }, { EAS_BUILD_PROFILE: 'production' }, { EAS_BUILD_PROFILE: 'custom-store' }, { NODE_ENV: 'production' }, { NODE_ENV: 'production', EAS_BUILD_PROFILE: 'development' }]) {
    const result = spawnSync(process.execPath, ['-e', "require('./app.config')({config:{}})"], { encoding: 'utf8', env: { ...process.env, REVENUECAT_BUILD_MODE: '', EAS_BUILD_PROFILE: '', NODE_ENV: '', ADMOB_IOS_APP_ID: '', ADMOB_IOS_BANNER_ID: '', ...mode } });
    assert.equal(result.status, 1, JSON.stringify(mode));
    assert.match(result.stderr, /AdMob RELEASE BLOCKED/);
  }
});
