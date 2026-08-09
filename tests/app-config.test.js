const assert = require('node:assert/strict');
const test = require('node:test');

const appConfig = require('../app.config');

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

test('rejects a development override for a production EAS profile', () => {
  assert.throws(
    () =>
      withEnvironment(
        {
          EAS_BUILD_PROFILE: 'production',
          REVENUECAT_BUILD_MODE: 'development',
          REVENUECAT_TEST_STORE_API_KEY: 'test_attack_value',
        },
        () => appConfig({ config: {} }),
      ),
    /REVENUECAT_BUILD_MODE="development" conflicts with EAS_BUILD_PROFILE="production"/,
  );
});

test('release configuration excludes the Test Store key', () => {
  const config = withEnvironment(
    {
      EAS_BUILD_PROFILE: 'production',
      REVENUECAT_BUILD_MODE: 'release',
      REVENUECAT_TEST_STORE_API_KEY: 'test_not_for_release',
      REVENUECAT_IOS_API_KEY: 'appl_release_value',
    },
    () => appConfig({ config: {} }),
  );

  assert.deepEqual(config.extra.revenueCat, {
    iosApiKey: 'appl_release_value',
    androidApiKey: undefined,
  });
  assert.equal('testStoreApiKey' in config.extra.revenueCat, false);
});
