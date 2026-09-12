const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
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
test('Expo config selects production only for exact Release signals', () => {
  const root = path.resolve(__dirname, '..');
  const environment = {
    ...process.env,
    EXPO_NO_DOTENV: '1',
    REVENUECAT_BUILD_MODE: '',
    EAS_BUILD_PROFILE: '',
    CONFIGURATION: '',
    REVENUECAT_TEST_STORE_API_KEY: 'test_local_value',
    REVENUECAT_IOS_API_KEY: 'appl_local_value',
    REVENUECAT_ANDROID_API_KEY: 'goog_local_value',
    ADMOB_IOS_APP_ID: production.appId,
    ADMOB_IOS_BANNER_ID: production.bannerId,
  };
  const script = "process.argv.splice(1, 0, require.resolve('expo/bin/cli')); const { getConfig } = require('expo/config'); const extra = getConfig(process.cwd(), { skipSDKVersionRequirement: true, isPublicConfig: true }).exp.extra; process.stdout.write(JSON.stringify({ admob: extra.admob, revenueCat: extra.revenueCat }));";
  const evaluate = (args, overrides = {}) => {
    const result = spawnSync(process.execPath, ['-e', script, '--', ...args], {
      cwd: root,
      encoding: 'utf8',
      env: { ...environment, ...overrides },
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const development = {
    admob: TEST_IDS,
    revenueCat: { testStoreApiKey: 'test_local_value' },
  };
  const ignoredReleaseSignals = {
    EAS_BUILD_PROFILE: 'production',
    CONFIGURATION: 'Profile',
    NODE_ENV: 'production',
    REVENUECAT_BUILD_MODE: 'release',
  };
  for (const args of [
    [],
    ['start'],
    ['start', '-d'],
    ['start', '--dev-client'],
    ['start', '--go'],
    ['run:ios'],
    ['run:ios', '--binary', 'Ramen.app'],
    ['run:ios', '--configuration', 'Debug'],
    ['run:ios', '--configuration=Debug'],
    ['run:ios', '--configuration', 'Profile'],
    ['run:ios', '--configuration', 'release'],
    ['run:ios', '--configuration=Profile'],
    ['run:ios', '--configuration=release'],
    ['run:android', '--variant', 'release'],
  ]) {
    assert.deepEqual(evaluate(args, ignoredReleaseSignals), development);
  }
  for (const args of [
    ['start', '--no-dev'],
    ['start', '-d', '--no-dev'],
    ['start', '--dev-client', '--no-dev'],
    ['start', '--go', '--no-dev'],
    ['start', '-g', '--no-dev'],
    ['start', '--no-dev', '--dev-client'],
    ['start', '--no-dev=true'],
    ['--no-dev'],
    ['--no-dev=true'],
  ]) {
    const unsupported = spawnSync(
      process.execPath,
      ['-e', script, '--', ...args],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...environment, ...ignoredReleaseSignals },
      },
    );
    assert.equal(
      unsupported.status,
      1,
      `${args.join(' ')}\n${unsupported.stdout}${unsupported.stderr}`,
    );
    assert.match(
      unsupported.stderr,
      /npx expo start --no-dev is unsupported for Catvertising/,
    );
    assert.match(
      unsupported.stderr,
      /serves a production-mode bundle with development inventory/,
    );
    assert.match(
      unsupported.stderr,
      /Use npx expo start --dev-client with a Debug development client/,
    );
    assert.match(
      unsupported.stderr,
      /npx expo run:ios --configuration Release/,
    );
  }
  const release = {
    admob: { ios: production },
    revenueCat: {
      iosApiKey: 'appl_local_value',
      androidApiKey: 'goog_local_value',
    },
  };
  assert.deepEqual(
    evaluate([], {
      EAS_BUILD_PROFILE: 'development',
      CONFIGURATION: 'Release',
      NODE_ENV: 'development',
      REVENUECAT_BUILD_MODE: 'development',
    }),
    release,
  );
  assert.deepEqual(
    evaluate(['run:ios', '--configuration', 'Release'], {
      EAS_BUILD_PROFILE: 'development',
      CONFIGURATION: 'Debug',
      NODE_ENV: 'development',
      REVENUECAT_BUILD_MODE: 'development',
    }),
    release,
  );
  assert.deepEqual(
    evaluate(['run:ios', '--configuration=Release'], {
      EAS_BUILD_PROFILE: 'development',
      CONFIGURATION: 'Debug',
      NODE_ENV: 'development',
      REVENUECAT_BUILD_MODE: 'development',
    }),
    release,
  );
  assert.deepEqual(
    evaluate(['run:ios', '--configuration', 'Release'], {
      REVENUECAT_TEST_STORE_API_KEY: '',
      REVENUECAT_IOS_API_KEY: '',
      REVENUECAT_ANDROID_API_KEY: '',
      ADMOB_IOS_APP_ID: '',
      ADMOB_IOS_BANNER_ID: '',
    }),
    { admob: { ios: { appId: '', bannerId: '' } }, revenueCat: {} },
  );
});
