const { withInfoPlist, withXcodeProject } = require('@expo/config-plugins');

function shellQuote(value) {
  return `'${String(value ?? '').replace(/'/g, "'\"'\"'")}'`;
}

module.exports = (config, ids) => {
  config = withInfoPlist(config, mod => {
    mod.modResults.GADApplicationIdentifier = ids.ios.appId;
    mod.modResults.GADDelayAppMeasurementInit = true;
    return mod;
  });
  config = withXcodeProject(config, mod => {
    const project = mod.modResults;
    const name = 'Reject AdMob test identifiers in Release';
    const appId = shellQuote(ids.ios.appId);
    const bannerId = shellQuote(ids.ios.bannerId);
    const script = `if [ "$CONFIGURATION" != "Debug" ]; then\n  /bin/bash -l "$SRCROOT/../node_modules/expo-constants/scripts/with-node.sh" "$SRCROOT/../scripts/check-admob-release.js" ${appId} ${bannerId} "$CONFIGURATION"\nfi`;
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase || {};
    const existing = Object.values(phases).find(p => p.name === `"${name}"`);
    if (existing) {
      // Re-prebuild after supplying real IDs must replace the captured samples.
      existing.shellScript = JSON.stringify(script);
    } else {
      project.addBuildPhase([], 'PBXShellScriptBuildPhase', name, project.getFirstTarget().uuid, {
        shellPath: '/bin/sh',
        shellScript: script,
      });
    }
    return mod;
  });
  return config;
};
