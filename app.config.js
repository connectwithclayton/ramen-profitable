const { resolveAdMob } = require('./config/admob');
const REVENUECAT_DEVELOPMENT_PROFILES = new Set([
  'development',
  'ios-simulator',
]);
const REVENUECAT_RELEASE_PROFILES = new Set(['preview', 'production']);

function revenueCatBuildMode() {
  const profile = process.env.EAS_BUILD_PROFILE;
  const profileMode =
    profile && REVENUECAT_DEVELOPMENT_PROFILES.has(profile)
      ? 'development'
      : profile && REVENUECAT_RELEASE_PROFILES.has(profile)
        ? 'release'
        : undefined;
  const defaultMode =
    process.env.NODE_ENV === 'production' ? 'release' : 'development';
  const explicitMode = process.env.REVENUECAT_BUILD_MODE;
  if (explicitMode) {
    if (explicitMode !== 'development' && explicitMode !== 'release') {
      throw new Error(
        'REVENUECAT_BUILD_MODE must be either "development" or "release".',
      );
    }
    const inferredMode = profileMode ?? defaultMode;
    if (explicitMode !== inferredMode) {
      const source = profileMode
        ? `EAS_BUILD_PROFILE="${profile}"`
        : 'NODE_ENV="production"';
      throw new Error(
        `REVENUECAT_BUILD_MODE="${explicitMode}" conflicts with ${source}; ` +
          `this configuration requires "${inferredMode}" mode.`,
      );
    }
    return inferredMode;
  }

  return profileMode ?? defaultMode;
}

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
  if (
    args.some(
      argument => argument === '--no-dev' || argument.startsWith('--no-dev='),
    )
  ) {
    throw new Error(
      'npx expo start --no-dev is unsupported for Catvertising because it ' +
        'serves a production-mode bundle with development inventory. ' +
        'Use npx expo start --dev-client with a Debug development client, ' +
        'or build with npx expo run:ios --configuration Release.',
    );
  }
  const adMobRelease =
    process.env.CONFIGURATION === 'Release' ||
    args.some(
      (argument, index) =>
        argument === '--configuration=Release' ||
        (argument === '--configuration' && args[index + 1] === 'Release'),
    );
  const revenueCatMode = revenueCatBuildMode();
  const revenueCat =
    revenueCatMode === 'release'
      ? {
          iosApiKey: releaseKey('REVENUECAT_IOS_API_KEY', 'appl_'),
          androidApiKey: releaseKey('REVENUECAT_ANDROID_API_KEY', 'goog_'),
        }
      : {
          testStoreApiKey: cleanKey(
            process.env.REVENUECAT_TEST_STORE_API_KEY,
          ),
        };

  const admob = resolveAdMob(!adMobRelease);
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
