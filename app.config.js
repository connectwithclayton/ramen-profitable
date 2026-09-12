const { resolveAdMob } = require('./config/admob');
const REVENUECAT_DEVELOPMENT_PROFILES = new Set([
  'development',
  'ios-simulator',
]);
const REVENUECAT_RELEASE_PROFILES = new Set(['preview', 'production']);
const ADMOB_IOS_RELEASE_PROFILES = new Set(['preview', 'production']);

function commandOption(args, command, name) {
  if (args[0] !== command) return undefined;
  for (let index = 1; index < args.length; index++) {
    if (args[index] === name) return args[index + 1];
    const prefix = `${name}=`;
    if (args[index].startsWith(prefix)) {
      return args[index].slice(prefix.length);
    }
  }
  return undefined;
}

function revenueCatCommandMode(args) {
  const iosConfiguration = commandOption(
    args,
    'run:ios',
    '--configuration',
  );
  if (iosConfiguration === 'Debug') return 'development';
  if (iosConfiguration === 'Release') return 'release';

  const androidVariant = commandOption(args, 'run:android', '--variant');
  if (androidVariant === 'debug') return 'development';
  if (androidVariant === 'release') return 'release';
  return undefined;
}

function revenueCatXcodeMode() {
  if (process.env.CONFIGURATION === 'Debug') return 'development';
  if (process.env.CONFIGURATION === 'Release') return 'release';
  return undefined;
}

function revenueCatBuildMode(args) {
  const profile = process.env.EAS_BUILD_PROFILE;
  const profileMode =
    profile && REVENUECAT_DEVELOPMENT_PROFILES.has(profile)
      ? 'development'
      : profile && REVENUECAT_RELEASE_PROFILES.has(profile)
        ? 'release'
        : undefined;
  const commandMode = revenueCatCommandMode(args);
  const xcodeMode = revenueCatXcodeMode();
  const contextualMode = commandMode ?? xcodeMode ?? profileMode;
  const defaultMode =
    process.env.NODE_ENV === 'production' ? 'release' : 'development';
  const explicitMode = process.env.REVENUECAT_BUILD_MODE;
  if (explicitMode) {
    if (explicitMode !== 'development' && explicitMode !== 'release') {
      throw new Error(
        'REVENUECAT_BUILD_MODE must be either "development" or "release".',
      );
    }
    if (contextualMode && explicitMode !== contextualMode) {
      const source = commandMode
        ? 'the explicit local Expo build command'
        : xcodeMode
          ? `CONFIGURATION="${process.env.CONFIGURATION}"`
          : `EAS_BUILD_PROFILE="${profile}"`;
      throw new Error(
        `REVENUECAT_BUILD_MODE="${explicitMode}" conflicts with ${source}; ` +
          `this configuration requires "${contextualMode}" mode.`,
      );
    }
  }

  const mode = contextualMode ?? explicitMode ?? defaultMode;
  // Expo Constants re-evaluates app config in a later child process. Carry the
  // resolved cross-platform RevenueCat mode without coupling it to iOS AdMob.
  process.env.REVENUECAT_BUILD_MODE = mode;
  return mode;
}

function isAdMobReleaseBuild(args) {
  const cliConfiguration = commandOption(
    args,
    'run:ios',
    '--configuration',
  );
  if (cliConfiguration !== undefined) {
    return cliConfiguration === 'Release';
  }
  if (process.env.CONFIGURATION) {
    return process.env.CONFIGURATION === 'Release';
  }
  return (
    process.env.EAS_BUILD === 'true' &&
    process.env.EAS_BUILD_PLATFORM === 'ios' &&
    ADMOB_IOS_RELEASE_PROFILES.has(process.env.EAS_BUILD_PROFILE)
  );
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
  const adMobRelease = isAdMobReleaseBuild(args);
  const revenueCatMode = revenueCatBuildMode(args);
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
