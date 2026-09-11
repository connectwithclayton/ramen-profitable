const { withInfoPlist, withXcodeProject } = require('@expo/config-plugins');

module.exports = (config, ids) => {
  config = withInfoPlist(config, mod => {
    mod.modResults.GADApplicationIdentifier = ids.ios.appId;
    mod.modResults.GADDelayAppMeasurementInit = true;
    return mod;
  });
  config = withXcodeProject(config, mod => {
    const project = mod.modResults;
    const name = 'Reject AdMob test identifiers in Release';
    const script = `if [ "$CONFIGURATION" != "Debug" ]; then\n  . "$SRCROOT/.xcode.env"\n  "$NODE_BINARY" "$SRCROOT/../scripts/check-admob-release.js" '${ids.ios.appId || ''}' '${ids.ios.bannerId || ''}'\nfi`;
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
