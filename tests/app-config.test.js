const assert = require('node:assert/strict');
const test = require('node:test');

const appConfig = require('../app.config');
const { TEST_IDS } = require('../config/admob');

function withEnvironment(values, callback) {
  const isolatedValues = {
    REVENUECAT_BUILD_PLATFORM: undefined,
    ...values,
  };
  const previous = {};
  for (const [name, value] of Object.entries(isolatedValues)) {
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

test('iOS release configuration refuses a missing RevenueCat key', () => {
  assert.throws(
    () => withEnvironment(
      {
        EAS_BUILD_PROFILE: 'production',
        EAS_BUILD_PLATFORM: 'ios',
        CONFIGURATION: undefined,
        RP_ORIGINAL_XCODE_CONFIGURATION: undefined,
        NODE_ENV: 'production',
        REVENUECAT_BUILD_MODE: 'release',
        REVENUECAT_TEST_STORE_API_KEY: undefined,
        REVENUECAT_IOS_API_KEY: undefined,
        REVENUECAT_ANDROID_API_KEY: undefined,
      },
      () => withArguments([], () => appConfig({ config: {} })),
    ),
    error => {
      assert.match(error.message, /RevenueCat RELEASE BLOCKED/);
      assert.match(error.message, /REVENUECAT_IOS_API_KEY/);
      assert.match(error.message, /EAS preview or production environment/);
      return true;
    },
  );
});

test('iOS release configuration refuses malformed RevenueCat keys', () => {
  for (const key of ['test_wrong_store', 'appl_']) {
    assert.throws(
      () => withEnvironment(
        {
          EAS_BUILD_PROFILE: 'production',
          EAS_BUILD_PLATFORM: 'ios',
          CONFIGURATION: undefined,
          RP_ORIGINAL_XCODE_CONFIGURATION: undefined,
          NODE_ENV: 'production',
          REVENUECAT_BUILD_MODE: 'release',
          REVENUECAT_IOS_API_KEY: key,
          REVENUECAT_ANDROID_API_KEY: undefined,
        },
        () => withArguments([], () => appConfig({ config: {} })),
      ),
      /REVENUECAT_IOS_API_KEY must be a usable appl_ RevenueCat platform key/,
    );
  }
});

test('iOS release configuration embeds a present RevenueCat key', () => {
  const configured = withEnvironment(
    {
      EAS_BUILD_PROFILE: 'production',
      EAS_BUILD_PLATFORM: 'ios',
      CONFIGURATION: undefined,
      RP_ORIGINAL_XCODE_CONFIGURATION: undefined,
      NODE_ENV: 'production',
      REVENUECAT_BUILD_MODE: 'release',
      REVENUECAT_IOS_API_KEY: 'appl_release_value',
      REVENUECAT_ANDROID_API_KEY: undefined,
    },
    () => withArguments([], () => appConfig({ config: {} })),
  );
  assert.deepEqual(configured.extra.revenueCat, {
    iosApiKey: 'appl_release_value',
    androidApiKey: undefined,
  });
});

test('Android release configuration does not require the iOS key', () => {
  const configured = withEnvironment(
    {
      EAS_BUILD_PROFILE: undefined,
      EAS_BUILD_PLATFORM: undefined,
      CONFIGURATION: undefined,
      RP_ORIGINAL_XCODE_CONFIGURATION: undefined,
      NODE_ENV: 'development',
      REVENUECAT_BUILD_MODE: undefined,
      REVENUECAT_IOS_API_KEY: undefined,
      REVENUECAT_ANDROID_API_KEY: 'goog_release_value',
    },
    () => withArguments(
      ['run:android', '--variant', 'release'],
      () => appConfig({ config: {} }),
    ),
  );
  assert.deepEqual(configured.extra.revenueCat, {
    iosApiKey: undefined,
    androidApiKey: 'goog_release_value',
  });
});

test('development configuration allows RevenueCat credentials to be absent', () => {
  const configured = withEnvironment(
    {
      EAS_BUILD_PROFILE: 'development',
      EAS_BUILD_PLATFORM: 'ios',
      CONFIGURATION: undefined,
      RP_ORIGINAL_XCODE_CONFIGURATION: undefined,
      NODE_ENV: 'development',
      REVENUECAT_BUILD_MODE: 'development',
      REVENUECAT_TEST_STORE_API_KEY: undefined,
      REVENUECAT_IOS_API_KEY: undefined,
      REVENUECAT_ANDROID_API_KEY: undefined,
    },
    () => withArguments([], () => appConfig({ config: {} })),
  );
  assert.deepEqual(configured.extra.revenueCat, {
    testStoreApiKey: undefined,
  });
});

test('RevenueCat release mode does not select production AdMob inventory', () => {
  const configured = withEnvironment(
    {
      EAS_BUILD: undefined,
      EAS_BUILD_PROFILE: 'production',
      EAS_BUILD_PLATFORM: undefined,
      CONFIGURATION: undefined,
      RP_ORIGINAL_XCODE_CONFIGURATION: undefined,
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
    iosApiKey: 'appl_release_value',
    androidApiKey: 'goog_release_value',
  });
});

test('exact Xcode Release selects production AdMob independently', () => {
  const configured = withEnvironment(
    {
      EAS_BUILD_PROFILE: undefined,
      CONFIGURATION: 'Release',
      RP_ORIGINAL_XCODE_CONFIGURATION: undefined,
      NODE_ENV: 'development',
      REVENUECAT_BUILD_MODE: undefined,
      REVENUECAT_TEST_STORE_API_KEY: 'test_not_for_release',
      REVENUECAT_IOS_API_KEY: 'appl_release_value',
      REVENUECAT_ANDROID_API_KEY: 'goog_release_value',
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
    androidApiKey: 'goog_release_value',
  });
});

test('exact Release option selects production AdMob independently', () => {
  const configured = withEnvironment(
    {
      EAS_BUILD_PROFILE: undefined,
      CONFIGURATION: 'Debug',
      RP_ORIGINAL_XCODE_CONFIGURATION: undefined,
      NODE_ENV: 'development',
      REVENUECAT_BUILD_MODE: undefined,
      REVENUECAT_TEST_STORE_API_KEY: 'test_not_for_release',
      REVENUECAT_IOS_API_KEY: 'appl_release_value',
      REVENUECAT_ANDROID_API_KEY: 'goog_release_value',
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
    androidApiKey: 'goog_release_value',
  });
});

test('explicit iOS Debug overrides a stale Release environment', () => {
  const configured = withEnvironment(
    {
      EAS_BUILD: undefined,
      EAS_BUILD_PROFILE: undefined,
      EAS_BUILD_PLATFORM: undefined,
      CONFIGURATION: 'Release',
      RP_ORIGINAL_XCODE_CONFIGURATION: undefined,
      NODE_ENV: 'development',
      REVENUECAT_BUILD_MODE: undefined,
      REVENUECAT_TEST_STORE_API_KEY: 'test_safe_value',
      REVENUECAT_IOS_API_KEY: 'appl_release_value',
      REVENUECAT_ANDROID_API_KEY: 'goog_release_value',
      ADMOB_IOS_APP_ID: 'ca-app-pub-1111111111111111~1111111111',
      ADMOB_IOS_BANNER_ID: 'ca-app-pub-1111111111111111/1111111111',
    },
    () => withArguments(
      ['run:ios', '--configuration', 'Debug'],
      () => appConfig({ config: {} }),
    ),
  );
  assert.deepEqual(configured.extra.admob, TEST_IDS);
  assert.deepEqual(configured.extra.revenueCat, {
    testStoreApiKey: 'test_safe_value',
  });
});
