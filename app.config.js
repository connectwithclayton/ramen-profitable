const DEVELOPMENT_PROFILES = new Set(['development', 'ios-simulator']);
const RELEASE_PROFILES = new Set(['preview', 'production']);

function buildMode() {
  const explicitMode = process.env.REVENUECAT_BUILD_MODE;
  if (explicitMode) {
    if (explicitMode !== 'development' && explicitMode !== 'release') {
      throw new Error(
        'REVENUECAT_BUILD_MODE must be either "development" or "release".',
      );
    }
    return explicitMode;
  }

  const profile = process.env.EAS_BUILD_PROFILE;
  if (profile && DEVELOPMENT_PROFILES.has(profile)) return 'development';
  if (profile && RELEASE_PROFILES.has(profile)) return 'release';
  return process.env.NODE_ENV === 'production' ? 'release' : 'development';
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
  const mode = buildMode();
  const revenueCat =
    mode === 'development'
      ? {
          testStoreApiKey: cleanKey(
            process.env.REVENUECAT_TEST_STORE_API_KEY,
          ),
        }
      : {
          iosApiKey: releaseKey('REVENUECAT_IOS_API_KEY', 'appl_'),
          androidApiKey: releaseKey('REVENUECAT_ANDROID_API_KEY', 'goog_'),
        };

  return {
    ...config,
    extra: {
      ...config.extra,
      revenueCat,
    },
  };
};
