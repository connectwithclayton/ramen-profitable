const path = require('node:path');
const { load } = require('@expo/env');
const { getConfig } = require('expo/config');
const { assertProductionIds } = require('../config/admob');
const [appId, bannerId] = process.argv.slice(2);

function resolveArchiveIds() {
  const projectRoot = path.resolve(__dirname, '..');
  load(projectRoot, { silent: true });
  process.chdir(projectRoot);
  const { exp } = getConfig(projectRoot, {
    isPublicConfig: true,
    skipSDKVersionRequirement: true,
  });
  return exp.extra?.admob?.ios;
}

try {
  const capturedIds = { appId, bannerId };
  assertProductionIds(capturedIds);
  if (process.env.CONFIGURATION === 'Release') {
    const archiveIds = resolveArchiveIds();
    assertProductionIds(archiveIds);
    if (
      archiveIds.appId !== capturedIds.appId ||
      archiveIds.bannerId !== capturedIds.bannerId
    ) {
      throw new Error(
        'AdMob RELEASE BLOCKED: archive-time iOS identifiers do not match ' +
          'the identifiers captured during prebuild. Regenerate the iOS ' +
          'project with the current release identifiers and rebuild.',
      );
    }
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
