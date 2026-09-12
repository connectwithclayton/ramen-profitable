const assert = require('node:assert/strict');
const test = require('node:test');

const appConfig = require('../app.config');
const { TEST_IDS } = require('../config/admob');

function withEnvironment(values, callback) {
  const previous = {};
  for (const [name, value] of Object.entries(values)) {
    previous[name] = process.env[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    return callback();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function withArguments(values, callback) {
  const previous = process.argv;
  process.argv = [previous[0], previous[1], ...values];
  try {
    return callback();
  } finally {
    process.argv = previous;
  }
}

test('nonexact release-like environment variables select sample inventory', () => {
  const configured = withEnvironment(
    {
      EAS_BUILD_PROFILE: 'production',
      CONFIGURATION: 'Profile',
      NODE_ENV: 'production',
      REVENUECAT_BUILD_MODE: 'release',
      REVENUECAT_TEST_STORE_API_KEY: 'test_safe_value',
      REVENUECAT_IOS_API_KEY: 'appl_release_value',
      REVENUECAT_ANDROID_API_KEY: 'goog_release_value',
      ADMOB_IOS_APP_ID: 'ca-app-pub-1111111111111111~1111111111',
      ADMOB_IOS_BANNER_ID: 'ca-app-pub-1111111111111111/1111111111',
    },
    () => withArguments([], () => appConfig({ config: {} })),
  );
  assert.deepEqual(configured.extra.admob, TEST_IDS);
  assert.deepEqual(configured.extra.revenueCat, {
    testStoreApiKey: 'test_safe_value',
  });
});

test('exact Xcode Release configuration selects production identifiers', () => {
  const configured = withEnvironment(
    {
      EAS_BUILD_PROFILE: 'development',
      CONFIGURATION: 'Release',
      NODE_ENV: 'development',
      REVENUECAT_BUILD_MODE: 'development',
      REVENUECAT_TEST_STORE_API_KEY: 'test_not_for_release',
      REVENUECAT_IOS_API_KEY: 'appl_release_value',
      REVENUECAT_ANDROID_API_KEY: undefined,
      ADMOB_IOS_APP_ID: 'ca-app-pub-1111111111111111~1111111111',
      ADMOB_IOS_BANNER_ID: 'ca-app-pub-1111111111111111/1111111111',
    },
    () => withArguments([], () => appConfig({ config: {} })),
  );
  assert.deepEqual(configured.extra.admob.ios, {
    appId: 'ca-app-pub-1111111111111111~1111111111',
    bannerId: 'ca-app-pub-1111111111111111/1111111111',
  });
  assert.deepEqual(configured.extra.revenueCat, {
    iosApiKey: 'appl_release_value',
    androidApiKey: undefined,
  });
  assert.equal('testStoreApiKey' in configured.extra.revenueCat, false);
});

test('exact Release option selects valid production identifiers', () => {
  const configured = withEnvironment(
    {
      EAS_BUILD_PROFILE: 'development',
      CONFIGURATION: 'Debug',
      NODE_ENV: 'development',
      REVENUECAT_BUILD_MODE: 'development',
      REVENUECAT_TEST_STORE_API_KEY: 'test_not_for_release',
      REVENUECAT_IOS_API_KEY: 'appl_release_value',
      REVENUECAT_ANDROID_API_KEY: undefined,
      ADMOB_IOS_APP_ID: 'ca-app-pub-1111111111111111~1111111111',
      ADMOB_IOS_BANNER_ID: 'ca-app-pub-1111111111111111/1111111111',
    },
    () => withArguments(
      ['run:ios', '--configuration', 'Release'],
      () => appConfig({ config: {} }),
    ),
  );
  assert.deepEqual(configured.extra.admob.ios, {
    appId: 'ca-app-pub-1111111111111111~1111111111',
    bannerId: 'ca-app-pub-1111111111111111/1111111111',
  });
  assert.deepEqual(configured.extra.revenueCat, {
    iosApiKey: 'appl_release_value',
    androidApiKey: undefined,
  });
  assert.equal('testStoreApiKey' in configured.extra.revenueCat, false);
});
