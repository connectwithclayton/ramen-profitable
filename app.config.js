const { resolveAdMob } = require('./config/admob');

function cleanKey(value) {
  const key = value?.trim();
  return key || undefined;
}

function releaseKey(name, expectedPrefix) {
  const key = cleanKey(process.env[name]);
  if (key && !key.startsWith(expectedPrefix)) {
    throw new Error(
      `${name} must be a ${expectedPrefix} RevenueCat platform key. ` +
        'Release configuration refused to embed it.',
    );
  }
  return key;
}

module.exports = ({ config }) => {
  const args = process.argv.slice(2);
  if (args.includes('--no-dev')) {
    throw new Error(
      'npx expo start --no-dev is unsupported for Catvertising because it ' +
        'serves a production-mode bundle with development inventory. ' +
        'Use npx expo start --dev-client with a Debug development client, ' +
        'or build with npx expo run:ios --configuration Release.',
    );
  }
  const release =
    process.env.CONFIGURATION === 'Release' ||
    args.some(
      (argument, index) =>
        argument === '--configuration' && args[index + 1] === 'Release',
    );
  const revenueCat =
    release
      ? {
          iosApiKey: releaseKey('REVENUECAT_IOS_API_KEY', 'appl_'),
          androidApiKey: releaseKey('REVENUECAT_ANDROID_API_KEY', 'goog_'),
        }
      : {
          testStoreApiKey: cleanKey(
            process.env.REVENUECAT_TEST_STORE_API_KEY,
          ),
        };

  const admob = resolveAdMob(!release);
  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      ['./plugins/with-admob-safety', admob],
    ],
    extra: {
      ...config.extra,
      revenueCat,
      admob,
    },
  };
};
