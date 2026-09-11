const { resolveAdMob } = require('./config/admob');
const DEVELOPMENT_PROFILES = new Set(['development', 'ios-simulator']);
const RELEASE_PROFILES = new Set(['preview', 'production']);

function buildMode() {
  const profile = process.env.EAS_BUILD_PROFILE;
  const profileMode =
    profile && DEVELOPMENT_PROFILES.has(profile)
      ? 'development'
      : profile && RELEASE_PROFILES.has(profile)
        ? 'release'
        : undefined;
  const defaultMode = process.env.NODE_ENV === 'production' ? 'release' : 'development';
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

  // Production profiles, local production exports, and unknown EAS profiles
  // cannot inherit sample identifiers from a development override.
  const adDevelopment = mode === 'development' && process.env.NODE_ENV !== 'production' &&
    (!process.env.EAS_BUILD_PROFILE || DEVELOPMENT_PROFILES.has(process.env.EAS_BUILD_PROFILE));
  const admob = resolveAdMob(adDevelopment, process.env.EAS_BUILD_PLATFORM || 'ios');
  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      ['react-native-google-mobile-ads', {
        iosAppId: admob.ios.appId,
        androidAppId: admob.android.appId,
        delayAppMeasurementInit: true,
        skAdNetworkItems: ['cstr6suwn9.skadnetwork'],
      }],
      ['./plugins/with-admob-safety', admob],
    ],
    extra: {
      ...config.extra,
      revenueCat,
      admob,
    },
  };
};
