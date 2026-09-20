const { resolveAdMob } = require('./config/admob');
const REVENUECAT_DEVELOPMENT_PROFILES = new Set([
  'development',
  'ios-simulator',
]);
const REVENUECAT_RELEASE_PROFILES = new Set(['preview', 'production']);
const ADMOB_IOS_RELEASE_PROFILES = new Set(['preview', 'production']);
const ORIGINAL_XCODE_CONFIGURATION = 'RP_ORIGINAL_XCODE_CONFIGURATION';
const REVENUECAT_BUILD_PLATFORM = 'REVENUECAT_BUILD_PLATFORM';

function xcodeConfiguration() {
  if (
    Object.prototype.hasOwnProperty.call(
      process.env,
      ORIGINAL_XCODE_CONFIGURATION,
    )
  ) {
    return process.env[ORIGINAL_XCODE_CONFIGURATION];
  }
  return process.env.CONFIGURATION;
}

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
  const configuration = xcodeConfiguration();
  if (configuration === 'Debug') return 'development';
  if (configuration === 'Release') return 'release';
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
          ? `CONFIGURATION="${xcodeConfiguration()}"`
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
  if (
    process.env.EAS_BUILD === 'true' &&
    process.env.EAS_BUILD_RUNNER !== 'eas-build'
  ) {
    return false;
  }
  if (
    Object.prototype.hasOwnProperty.call(
      process.env,
      ORIGINAL_XCODE_CONFIGURATION,
    )
  ) {
    return process.env[ORIGINAL_XCODE_CONFIGURATION] === 'Release';
  }
  if (process.env.CONFIGURATION) {
    return process.env.CONFIGURATION === 'Release';
  }
  return (
    process.env.EAS_BUILD === 'true' &&
    process.env.EAS_BUILD_RUNNER === 'eas-build' &&
    process.env.EAS_BUILD_PLATFORM === 'ios' &&
    ADMOB_IOS_RELEASE_PROFILES.has(process.env.EAS_BUILD_PROFILE)
  );
}

function cleanKey(value) {
  const key = value?.trim();
  return key || undefined;
}

function releaseKey(name, expectedPrefix, required = false) {
  const key = cleanKey(process.env[name]);
  if (!key) {
    if (!required) return undefined;
    throw new Error(
      `RevenueCat RELEASE BLOCKED: ${name} is missing. Set the iOS public ` +
        `SDK key beginning with ${expectedPrefix} in the EAS preview or ` +
        'production environment using Plain text or Sensitive visibility, ' +
        'or in the local release environment, then rebuild.',
    );
  }
  if (!key.startsWith(expectedPrefix) || key.length === expectedPrefix.length) {
    throw new Error(
      `RevenueCat RELEASE BLOCKED: ${name} must be a usable ` +
        `${expectedPrefix} RevenueCat platform key. Replace it with the ` +
        'matching public SDK key from RevenueCat Project Settings and rebuild.',
    );
  }
  return key;
}

function revenueCatBuildPlatform(args) {
  let platform;
  if (args[0] === 'run:ios') platform = 'ios';
  else if (args[0] === 'run:android') platform = 'android';
  else {
    const commandPlatform = commandOption(args, args[0], '--platform');
    if (commandPlatform === 'ios' || commandPlatform === 'android') {
      platform = commandPlatform;
    } else if (
      process.env.EAS_BUILD_PLATFORM === 'ios' ||
      process.env.EAS_BUILD_PLATFORM === 'android'
    ) {
      platform = process.env.EAS_BUILD_PLATFORM;
    } else if (revenueCatXcodeMode()) {
      platform = 'ios';
    } else if (
      process.env[REVENUECAT_BUILD_PLATFORM] === 'ios' ||
      process.env[REVENUECAT_BUILD_PLATFORM] === 'android'
    ) {
      platform = process.env[REVENUECAT_BUILD_PLATFORM];
    }
  }
  if (platform) process.env[REVENUECAT_BUILD_PLATFORM] = platform;
  return platform;
}

function requiresRevenueCatIOSKey(args) {
  // Fail closed: only a confirmed Android build may omit the iOS key.
  return revenueCatBuildPlatform(args) !== 'android';
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
          iosApiKey: releaseKey(
            'REVENUECAT_IOS_API_KEY',
            'appl_',
            requiresRevenueCatIOSKey(args),
          ),
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
