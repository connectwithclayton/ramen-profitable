const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
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
test('Expo config keeps AdMob and RevenueCat build modes independent', () => {
  const root = path.resolve(__dirname, '..');
  const environment = {
    ...process.env,
    EXPO_NO_DOTENV: '1',
    REVENUECAT_BUILD_MODE: '',
    EAS_BUILD: '',
    EAS_BUILD_PROFILE: '',
    EAS_BUILD_PLATFORM: '',
    CONFIGURATION: '',
    REVENUECAT_TEST_STORE_API_KEY: 'test_local_value',
    REVENUECAT_IOS_API_KEY: 'appl_local_value',
    REVENUECAT_ANDROID_API_KEY: 'goog_local_value',
    ADMOB_IOS_APP_ID: production.appId,
    ADMOB_IOS_BANNER_ID: production.bannerId,
  };
  delete environment.RP_ORIGINAL_XCODE_CONFIGURATION;
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
  const developmentMode = {
    EAS_BUILD_PROFILE: 'development',
    CONFIGURATION: 'Profile',
    NODE_ENV: 'development',
    REVENUECAT_BUILD_MODE: 'development',
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
  ]) {
    assert.deepEqual(evaluate(args, developmentMode), development);
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
        env: { ...environment, ...developmentMode },
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
  const productionRevenueCat = {
    iosApiKey: 'appl_local_value',
    androidApiKey: 'goog_local_value',
  };
  const releaseBuild = {
    admob: { ios: production },
    revenueCat: productionRevenueCat,
  };
  assert.deepEqual(
    evaluate([], {
      EAS_BUILD_PROFILE: '',
      CONFIGURATION: 'Release',
      NODE_ENV: 'development',
      REVENUECAT_BUILD_MODE: '',
    }),
    releaseBuild,
  );
  assert.deepEqual(
    evaluate(['run:ios', '--configuration', 'Release'], {
      EAS_BUILD_PROFILE: '',
      CONFIGURATION: 'Debug',
      NODE_ENV: 'development',
      REVENUECAT_BUILD_MODE: '',
    }),
    releaseBuild,
  );
  assert.deepEqual(
    evaluate(['run:ios', '--configuration=Release'], {
      EAS_BUILD_PROFILE: '',
      CONFIGURATION: 'Debug',
      NODE_ENV: 'development',
      REVENUECAT_BUILD_MODE: '',
    }),
    releaseBuild,
  );
  for (const args of [
    ['run:ios', '--configuration', 'Debug'],
    ['run:ios', '--configuration=Debug'],
  ]) {
    assert.deepEqual(
      evaluate(args, {
        EAS_BUILD_PROFILE: '',
        CONFIGURATION: 'Release',
        NODE_ENV: 'development',
        REVENUECAT_BUILD_MODE: '',
      }),
      development,
    );
  }
  for (const args of [
    ['run:android', '--variant', 'release'],
    ['run:android', '--variant=release'],
  ]) {
    assert.deepEqual(
      evaluate(args, {
        EAS_BUILD_PROFILE: '',
        CONFIGURATION: '',
        NODE_ENV: 'development',
        REVENUECAT_BUILD_MODE: '',
      }),
      { admob: TEST_IDS, revenueCat: productionRevenueCat },
    );
  }
  for (const profile of ['preview', 'production']) {
    assert.deepEqual(
      evaluate([], {
        EAS_BUILD: 'true',
        EAS_BUILD_PROFILE: profile,
        EAS_BUILD_PLATFORM: 'ios',
        CONFIGURATION: '',
        NODE_ENV: 'production',
        REVENUECAT_BUILD_MODE: 'release',
      }),
      releaseBuild,
    );
    assert.deepEqual(
      evaluate([], {
        EAS_BUILD: 'true',
        EAS_BUILD_PROFILE: profile,
        EAS_BUILD_PLATFORM: 'android',
        CONFIGURATION: '',
        NODE_ENV: 'production',
        REVENUECAT_BUILD_MODE: 'release',
      }),
      { admob: TEST_IDS, revenueCat: productionRevenueCat },
    );
  }
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

test('RevenueCat mode reaches the later Expo Constants consumer', () => {
  const root = path.resolve(__dirname, '..');
  fs.mkdirSync(path.join(root, '.expo'), { recursive: true });
  const fixture = fs.mkdtempSync(
    path.join(root, '.expo/revenuecat-mode-propagation-'),
  );
  const script = [
    "process.argv.splice(1, 0, require.resolve('expo/bin/cli'));",
    "const { getConfig } = require('expo/config');",
    "const { spawnSync } = require('node:child_process');",
    "const path = require('node:path');",
    "getConfig(process.cwd(), { skipSDKVersionRequirement: true, isPublicConfig: true });",
    "const executable = path.join(path.dirname(require.resolve('expo-constants/package.json')), 'scripts/getAppConfig.js');",
    "const child = spawnSync(process.execPath, [executable, process.cwd(), process.env.APP_CONFIG_DEST], { cwd: process.cwd(), env: process.env, encoding: 'utf8' });",
    "process.stdout.write(JSON.stringify({ status: child.status, stdout: child.stdout, stderr: child.stderr }));",
  ].join(' ');
  const environment = {
    ...process.env,
    EXPO_NO_DOTENV: '1',
    EAS_BUILD: '',
    EAS_BUILD_PROFILE: '',
    EAS_BUILD_PLATFORM: '',
    CONFIGURATION: '',
    NODE_ENV: 'development',
    REVENUECAT_BUILD_MODE: '',
    REVENUECAT_TEST_STORE_API_KEY: 'test_local_value',
    REVENUECAT_IOS_API_KEY: 'appl_local_value',
    REVENUECAT_ANDROID_API_KEY: 'goog_local_value',
    ADMOB_IOS_APP_ID: production.appId,
    ADMOB_IOS_BANNER_ID: production.bannerId,
  };
  delete environment.RP_ORIGINAL_XCODE_CONFIGURATION;

  try {
    for (const [index, args] of [
      ['run:android', '--variant', 'release'],
      ['run:ios', '--configuration', 'Release'],
    ].entries()) {
      const destination = path.join(fixture, String(index));
      fs.mkdirSync(destination);
      const result = spawnSync(
        process.execPath,
        ['-e', script, '--', ...args],
        {
          cwd: root,
          encoding: 'utf8',
          env: { ...environment, APP_CONFIG_DEST: destination },
        },
      );
      assert.equal(result.status, 0, result.stderr);
      const consumer = JSON.parse(result.stdout);
      assert.equal(consumer.status, 0, consumer.stdout + consumer.stderr);
      const generated = JSON.parse(
        fs.readFileSync(path.join(destination, 'app.config'), 'utf8'),
      );
      assert.deepEqual(generated.extra.revenueCat, {
        iosApiKey: 'appl_local_value',
        androidApiKey: 'goog_local_value',
      });
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
