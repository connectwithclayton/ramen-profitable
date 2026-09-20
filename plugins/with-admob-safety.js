const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig, withInfoPlist, withPodfile, withXcodeProject } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const BANNER_IDENTITY_SOURCE = 'RPBannerRequestIdentity.m';

function shellQuote(value) {
  return `'${String(value ?? '').replace(/'/g, "'\"'\"'")}'`;
}

module.exports = (config, ids) => {
  config = withInfoPlist(config, mod => {
    mod.modResults.GADApplicationIdentifier = ids.ios.appId;
    mod.modResults.GADDelayAppMeasurementInit = true;
    return mod;
  });
  config = withPodfile(config, mod => {
    const wrappedCommand = '/bin/bash "$PODS_ROOT/../../scripts/with-original-xcode-configuration.sh"';
    const results = mergeContents({
      tag: 'preserve-original-xcode-configuration',
      src: mod.modResults.contents,
      newSrc: [
        "  constants_target = installer.pods_project.targets.find { |target| target.name == 'EXConstants' }",
        "  raise 'EXConstants target is required for app configuration.' unless constants_target",
        '  constants_phase = constants_target.shell_script_build_phases.find do |phase|',
        "    phase.name == '[CP-User] Generate app.config for prebuilt Constants.manifest'",
        '  end',
        "  raise 'EXConstants app configuration phase is missing.' unless constants_phase",
        `  constants_wrapper = '${wrappedCommand}'`,
        '  unless constants_phase.shell_script.start_with?(constants_wrapper)',
        "    raise 'EXConstants app configuration phase changed unexpectedly.' unless constants_phase.shell_script.start_with?('bash -l')",
        "    constants_phase.shell_script = constants_phase.shell_script.sub('bash -l', constants_wrapper)",
        '  end',
      ].join('\n'),
      anchor: /post_install do \|installer\|/,
      offset: 1,
      comment: '#',
    });
    mod.modResults.contents = results.contents;
    return mod;
  });
  config = withXcodeProject(config, mod => {
    let project = mod.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot);
    const sourcePath = path.join(projectName, BANNER_IDENTITY_SOURCE);
    fs.copyFileSync(
      path.join(mod.modRequest.projectRoot, 'native', 'ios', BANNER_IDENTITY_SOURCE),
      path.join(mod.modRequest.platformProjectRoot, sourcePath),
    );
    if (!project.hasFile(sourcePath)) {
      project = IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: sourcePath,
        groupName: projectName,
        project,
      });
    }

    const name = 'Reject AdMob test identifiers in Release';
    const appId = shellQuote(ids.ios.appId);
    const bannerId = shellQuote(ids.ios.bannerId);
    const localEasMessage = shellQuote(
      'AdMob RELEASE BLOCKED: this local EAS iOS Release intentionally uses Google sample identifiers. ' +
        'Live AdMob inventory in a developer-machine, non-store binary risks invalid traffic and AdMob account suspension. ' +
        'EAS cloud builds with EAS_BUILD_RUNNER=eas-build are this app\'s supported release path; rerun without --local.',
    );
    const script = `if [ "$CONFIGURATION" = "Release" ]; then\n  if [ "$EAS_BUILD" = "true" ] && [ "$EAS_BUILD_RUNNER" = "local-build-plugin" ]; then\n    printf '%s\\n' ${localEasMessage} >&2\n    exit 1\n  fi\n  /bin/bash "$SRCROOT/../scripts/with-original-xcode-configuration.sh" "$SRCROOT/../node_modules/expo-constants/scripts/with-node.sh" "$SRCROOT/../scripts/check-admob-release.js" ${appId} ${bannerId} "$CONFIGURATION"\nfi`;
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
