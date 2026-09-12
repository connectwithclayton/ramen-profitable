const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const { TEST_IDS, resolveAdMob } = require('../config/admob');
const production = { appId: 'ca-app-pub-1111111111111111~2222222222', bannerId: 'ca-app-pub-1111111111111111/3333333333' };
const adaptiveSample = {
  ios: {
    appId: 'ca-app-pub-3940256099942544~1458002511',
    bannerId: 'ca-app-pub-3940256099942544/2435281174',
  },
};

test('development always resolves the official sample inventory', () => {
  assert.deepEqual(TEST_IDS, adaptiveSample);
  assert.deepEqual(resolveAdMob(true, { ADMOB_IOS_APP_ID: production.appId }), adaptiveSample);
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
test('native build executable independently validates both identifiers', () => {
  const environment = { ...process.env, NODE_ENV: 'development', EAS_BUILD_PROFILE: 'development' };
  const invalid = [
    ['appId', '', production.bannerId],
    ['appId', TEST_IDS.ios.appId, production.bannerId],
    ['appId', 'ca-app-pub-1111111111111111/2222222222', production.bannerId],
    ['bannerId', production.appId, ''],
    ['bannerId', production.appId, TEST_IDS.ios.bannerId],
    ['bannerId', production.appId, 'ca-app-pub-1111111111111111~3333333333'],
  ];
  for (const [key, appId, bannerId] of invalid) {
    const result = spawnSync(process.execPath, ['scripts/check-admob-release.js', appId, bannerId], { encoding: 'utf8', env: environment });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, key === 'appId' ? /iOS appId/ : /iOS bannerId/);
  }
  assert.equal(spawnSync(process.execPath, ['scripts/check-admob-release.js', production.appId, production.bannerId], { env: environment }).status, 0);
});
test('Expo config consumer permits release evaluation without iOS IDs', () => {
  for (const mode of [{ EAS_BUILD_PROFILE: 'preview' }, { EAS_BUILD_PROFILE: 'production' }]) {
    const result = spawnSync(process.execPath, ['-e', "process.stdout.write(JSON.stringify(require('./app.config')({config:{}}).extra.admob))"], { encoding: 'utf8', env: { ...process.env, REVENUECAT_BUILD_MODE: '', EAS_BUILD_PROFILE: '', CONFIGURATION: '', NODE_ENV: '', ADMOB_IOS_APP_ID: '', ADMOB_IOS_BANNER_ID: '', ...mode } });
    assert.equal(result.status, 0, result.stderr || JSON.stringify(mode));
    assert.deepEqual(JSON.parse(result.stdout), {
      ios: { appId: '', bannerId: '' },
    });
  }
});
test('Expo 57 development manifest uses sample inventory despite inherited NODE_ENV', () => {
  const result = spawnSync(
    process.execPath,
    [require.resolve('expo/bin/cli'), 'config', '--type', 'public', '--json'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        EXPO_NO_DOTENV: '1',
        REVENUECAT_BUILD_MODE: '',
        EAS_BUILD_PROFILE: '',
        CONFIGURATION: '',
        NODE_ENV: 'production',
        ADMOB_IOS_APP_ID: production.appId,
        ADMOB_IOS_BANNER_ID: production.bannerId,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).extra.admob, TEST_IDS);
});
test('declared development profiles use sample inventory regardless of NODE_ENV', () => {
  const result = spawnSync(process.execPath, ['-e', "process.stdout.write(JSON.stringify(require('./app.config')({config:{}}).extra.admob))"], { encoding: 'utf8', env: { ...process.env, REVENUECAT_BUILD_MODE: '', EAS_BUILD_PROFILE: 'development', NODE_ENV: 'production', ADMOB_IOS_APP_ID: '', ADMOB_IOS_BANNER_ID: '' } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), TEST_IDS);
});
