const { withXcodeProject, withAppBuildGradle, withAppDelegate } = require('@expo/config-plugins');

module.exports = (config, ids) => {
  config = withXcodeProject(config, mod => {
    const project = mod.modResults;
    const name = 'Reject AdMob test identifiers in Release';
    const script = `if [ "$CONFIGURATION" != "Debug" ]; then\n  . "$SRCROOT/.xcode.env"\n  "$NODE_BINARY" "$SRCROOT/../scripts/check-admob-release.js" ios '${ids.ios.appId || ''}' '${ids.ios.bannerId || ''}'\nfi`;
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
  config = withAppBuildGradle(config, mod => {
    mod.modResults.contents = mod.modResults.contents.replace(/\n\/\/ BEGIN RAMEN ADMOB[\s\S]*?\/\/ END RAMEN ADMOB\n/g, '');
    mod.modResults.contents += `\n// BEGIN RAMEN ADMOB\n// AdMob IDs captured during prebuild; release never accepts sample inventory.\ngradle.taskGraph.whenReady { graph ->\n  if (graph.allTasks.any { it.name.toLowerCase().contains('release') }) {\n    exec {\n      workingDir rootProject.projectDir.parentFile\n      commandLine 'node', 'scripts/check-admob-release.js', 'android', '${ids.android.appId || ''}', '${ids.android.bannerId || ''}'\n    }\n  }\n}\n// END RAMEN ADMOB\n`;
    return mod;
  });
  return withAppDelegate(config, mod => {
    if (mod.modResults.language !== 'swift') throw new Error('AdMob privacy configuration requires the Expo Swift AppDelegate.');
    let contents = mod.modResults.contents;
    if (!contents.includes('import GoogleMobileAds')) contents = 'import GoogleMobileAds\n' + contents;
    const statement = 'MobileAds.shared.requestConfiguration.setPublisherFirstPartyIDEnabled(false)';
    if (!contents.includes(statement)) {
      const anchor = ') -> Bool {';
      if (!contents.includes(anchor)) throw new Error('Cannot install AdMob privacy configuration in AppDelegate.');
      contents = contents.replace(anchor, `${anchor}\n    ${statement}`);
    }
    mod.modResults.contents = contents;
    return mod;
  });
};
