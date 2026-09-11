// The ONE AdMob identifier configuration point. Development always uses Google's
// sample inventory. Supply the two iOS environment values below for an iOS release.
// Sources verified 2026-09-10: https://developers.google.com/admob/ios/quick-start
// https://developers.google.com/admob/ios/test-ads (inline adaptive banner)
const TEST_IDS = {
  ios: { appId: 'ca-app-pub-3940256099942544~1458002511', bannerId: 'ca-app-pub-3940256099942544/2435281174' },
};

function assertProductionIds(ids) {
  for (const [key, separator] of [['appId', '~'], ['bannerId', '/']]) {
    const value = ids?.[key];
    if (typeof value !== 'string' || !new RegExp(`^ca-app-pub-[0-9]{16}${separator}[0-9]{10}$`).test(value) || value.startsWith('ca-app-pub-3940256099942544')) {
      throw new Error(`AdMob RELEASE BLOCKED: iOS ${key} is missing, invalid, or a Google TEST identifier. Set production IDs in config/admob.js's environment configuration and rebuild.`);
    }
  }
}

function resolveAdMob(development, env = process.env) {
  const production = {
    ios: { appId: env.ADMOB_IOS_APP_ID?.trim(), bannerId: env.ADMOB_IOS_BANNER_ID?.trim() },
  };
  return development ? TEST_IDS : production;
}
module.exports = { TEST_IDS, assertProductionIds, resolveAdMob };
