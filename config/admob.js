// The ONE AdMob identifier configuration point. Development always uses Google's
// sample inventory. Supply the two iOS environment values below for a release.
// Sources verified 2026-09-10: https://developers.google.com/admob/ios/quick-start
// https://developers.google.com/admob/ios/test-ads (fixed-size banner)
// Android counterparts: /admob/android/quick-start and /admob/android/test-ads.
const TEST_IDS = {
  ios: { appId: 'ca-app-pub-3940256099942544~1458002511', bannerId: 'ca-app-pub-3940256099942544/2934735716' },
  android: { appId: 'ca-app-pub-3940256099942544~3347511713', bannerId: 'ca-app-pub-3940256099942544/6300978111' },
};

function assertProductionIds(ids, platform) {
  for (const [key, separator] of [['appId', '~'], ['bannerId', '/']]) {
    const value = ids?.[key];
    if (typeof value !== 'string' || !new RegExp(`^ca-app-pub-[0-9]{16}${separator}[0-9]{10}$`).test(value) || value.startsWith('ca-app-pub-3940256099942544')) {
      throw new Error(`AdMob RELEASE BLOCKED: ${platform} ${key} is missing, invalid, or a Google TEST identifier. Set production IDs in config/admob.js's environment configuration and rebuild.`);
    }
  }
}

function resolveAdMob(development, platform = 'ios', env = process.env) {
  if (platform !== 'ios' && platform !== 'android') throw new Error(`Unsupported AdMob platform: ${platform}`);
  const production = {
    ios: { appId: env.ADMOB_IOS_APP_ID?.trim(), bannerId: env.ADMOB_IOS_BANNER_ID?.trim() },
    android: { appId: env.ADMOB_ANDROID_APP_ID?.trim(), bannerId: env.ADMOB_ANDROID_BANNER_ID?.trim() },
  };
  if (!development) assertProductionIds(production[platform], platform);
  return development ? TEST_IDS : production;
}
module.exports = { TEST_IDS, assertProductionIds, resolveAdMob };
