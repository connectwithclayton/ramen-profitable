const { resolveAdMob } = require('./config/admob');
const DEVELOPMENT_PROFILES = new Set(['development', 'ios-simulator']);
const RELEASE_PROFILES = new Set(['preview', 'production']);

function cliOption(args, name) {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  const prefix = `${name}=`;
  return args.find(argument => argument.startsWith(prefix))?.slice(prefix.length);
}

function localIosRunMode(args = process.argv.slice(2)) {
  if (args[0] !== 'run:ios') return undefined;
  const configuration = cliOption(args, '--configuration');
  return configuration === undefined || configuration === 'Debug'
    ? 'development'
    : 'release';
}

function buildMode() {
  const profile = process.env.EAS_BUILD_PROFILE;
  const profileMode =
    profile && DEVELOPMENT_PROFILES.has(profile)
      ? 'development'
      : profile && RELEASE_PROFILES.has(profile)
        ? 'release'
        : undefined;
  const xcodeMode =
    process.env.CONFIGURATION === 'Debug'
      ? 'development'
      : process.env.CONFIGURATION === 'Release'
        ? 'release'
        : undefined;
  const runMode = localIosRunMode();
  const inferredMode = profileMode ?? xcodeMode ?? runMode;
  const nodeMode =
    process.env.NODE_ENV === 'development'
      ? 'development'
      : process.env.NODE_ENV === 'production'
        ? 'release'
        : undefined;
  const explicitMode = process.env.REVENUECAT_BUILD_MODE;
  if (explicitMode) {
    if (explicitMode !== 'development' && explicitMode !== 'release') {
      throw new Error(
        'REVENUECAT_BUILD_MODE must be either "development" or "release".',
      );
    }
    const requiredMode = inferredMode ?? nodeMode;
    if (requiredMode && explicitMode !== requiredMode) {
      const source = profileMode
        ? `EAS_BUILD_PROFILE="${profile}"`
        : xcodeMode
          ? `CONFIGURATION="${process.env.CONFIGURATION}"`
          : runMode
            ? 'the local Expo iOS configuration'
            : `NODE_ENV="${process.env.NODE_ENV}"`;
      throw new Error(
        `REVENUECAT_BUILD_MODE="${explicitMode}" conflicts with ${source}; ` +
          `this configuration requires "${requiredMode}" mode.`,
      );
    }
    return requiredMode ?? explicitMode;
  }

  return inferredMode ?? nodeMode ?? 'release';
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

  const admob = resolveAdMob(mode === 'development');
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
