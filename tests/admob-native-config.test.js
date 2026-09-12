const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const xcode = require('xcode');
const plist = require('@expo/plist').default;
const { TEST_IDS } = require('../config/admob');

test('Expo autolinking excludes the ads native module from Android', () => {
  const root = path.resolve(__dirname, '..');
  const cli = path.join(path.dirname(require.resolve('expo-modules-autolinking/package.json')), 'bin/expo-modules-autolinking.js');
  const result = spawnSync(process.execPath, [cli, 'react-native-config', '--platform', 'android', '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const config = JSON.parse(result.stdout);
  assert.equal(config.dependencies['react-native-google-mobile-ads'], undefined);
});

test('Expo prebuild emits iOS configuration and enforces release identifiers', () => {
  const root = path.resolve(__dirname, '..');
  fs.mkdirSync(path.join(root, '.expo'), { recursive: true });
  const fixture = fs.mkdtempSync(path.join(root, '.expo/admob-prebuild-test-'));
  try {
    for (const file of ['package.json', 'app.json', 'app.config.js']) fs.copyFileSync(path.join(root, file), path.join(fixture, file));
    for (const dir of ['config', 'plugins', 'scripts', 'assets']) fs.cpSync(path.join(root, dir), path.join(fixture, dir), { recursive: true });
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
    const clearedVariables = [
      'EAS_BUILD',
      'EAS_BUILD_PROFILE',
      'EAS_BUILD_PLATFORM',
      'NODE_ENV',
      'REVENUECAT_BUILD_MODE',
      'CONFIGURATION',
      'RP_ORIGINAL_XCODE_CONFIGURATION',
      'REVENUECAT_TEST_STORE_API_KEY',
      'REVENUECAT_IOS_API_KEY',
      'REVENUECAT_ANDROID_API_KEY',
      'ADMOB_IOS_APP_ID',
      'ADMOB_IOS_BANNER_ID',
    ];
    const cleanEnvironment = additional => {
      const result = { ...process.env };
      for (const variable of clearedVariables) delete result[variable];
      return Object.assign(result, additional);
    };
    const env = cleanEnvironment({ CI: '1', NODE_ENV: 'development', EAS_BUILD_PROFILE: 'development', REVENUECAT_BUILD_MODE: '' });
    const prebuild = (additional = {}) => spawnSync(
      process.execPath,
      [path.join(root, 'node_modules/expo/bin/cli'), 'prebuild', '.', '--platform', 'ios', '--no-install'],
      { cwd: fixture, env: { ...env, ...additional }, encoding: 'utf8' },
    );
    const validatorPath = path.join(fixture, 'scripts/check-admob-release.js');
    const phase = () => {
      const project = xcode.project(path.join(fixture, 'ios/RamenProfitable.xcodeproj/project.pbxproj')).parseSync();
      const phases = Object.values(project.hash.project.objects.PBXShellScriptBuildPhase).filter(value => value.name === '"Reject AdMob test identifiers in Release"');
      assert.equal(phases.length, 1, 'one native release guard after every prebuild');
      return JSON.parse(phases[0].shellScript.replace(/\n/g, '\\n'));
    };
    const runPhase = (configuration, additional = {}) => spawnSync('/bin/sh', ['-c', phase()], {
      cwd: fixture,
      env: cleanEnvironment({
        CI: '1',
        SRCROOT: path.join(fixture, 'ios'),
        PODS_ROOT: path.join(fixture, 'ios/Pods'),
        CONFIGURATION: configuration,
        ...additional,
      }),
      encoding: 'utf8',
    });
    const constantsConfig = additional => {
      const constantsEnvironment = cleanEnvironment(additional);
      const result = spawnSync(
        process.execPath,
        [path.join(root, 'node_modules/expo-constants/scripts/build/getAppConfig.js'), fixture, path.join(fixture, 'ios')],
        { cwd: fixture, env: constantsEnvironment, encoding: 'utf8' },
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
      return JSON.parse(fs.readFileSync(path.join(fixture, 'ios/app.config'), 'utf8'));
    };
    let constantsPhaseScript;
    const constantsPhase = () => {
      if (constantsPhaseScript) return constantsPhaseScript;
      const podfile = fs.readFileSync(path.join(fixture, 'ios/Podfile'), 'utf8').split('\n');
      const start = podfile.findIndex(line => line.startsWith('# @generated begin preserve-original-xcode-configuration - '));
      const end = podfile.findIndex((line, index) => (
        index > start && line === '# @generated end preserve-original-xcode-configuration'
      ));
      assert.ok(start >= 0 && end > start, 'prebuild must emit its owned Constants configuration hook');
      const harness = path.join(fixture, 'ios/constants-configuration-hook.rb');
      fs.writeFileSync(harness, [
        'phase = Struct.new(:name, :shell_script).new(\'[CP-User] Generate app.config for prebuilt Constants.manifest\', ARGV.fetch(0))',
        'target = Struct.new(:name, :shell_script_build_phases).new(\'EXConstants\', [phase])',
        'project = Struct.new(:targets).new([target])',
        'installer = Struct.new(:pods_project).new(project)',
        ...podfile.slice(start + 1, end),
        'STDOUT.write(phase.shell_script)',
      ].join('\n'));
      const originalPhase = `bash -l -c '"$PODS_ROOT/../../node_modules/expo-constants/scripts/get-app-config-ios.sh"'`;
      const configured = spawnSync('ruby', [harness, originalPhase], {
        cwd: path.join(fixture, 'ios'),
        encoding: 'utf8',
      });
      assert.equal(configured.status, 0, configured.stdout + configured.stderr);
      constantsPhaseScript = configured.stdout;
      return constantsPhaseScript;
    };
    const constantsConfigThroughXcode = additional => {
      const podsRoot = path.join(fixture, 'ios/Pods');
      const constantsBuild = path.join(fixture, 'ios/constants-build');
      fs.mkdirSync(podsRoot, { recursive: true });
      fs.mkdirSync(path.join(constantsBuild, 'EXConstants.bundle'), { recursive: true });
      const result = spawnSync(
        '/bin/sh',
        ['-c', constantsPhase()],
        {
          cwd: fixture,
          env: cleanEnvironment({
            BUNDLE_FORMAT: 'shallow',
            CI: '1',
            CONFIGURATION_BUILD_DIR: constantsBuild,
            NODE_ENV: 'development',
            PROJECT_DIR: podsRoot,
            PROJECT_ROOT: fixture,
            PODS_ROOT: podsRoot,
            ...additional,
          }),
          encoding: 'utf8',
        },
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
      return JSON.parse(fs.readFileSync(path.join(constantsBuild, 'EXConstants.bundle/app.config'), 'utf8'));
    };
    const development = prebuild({
      CONFIGURATION: 'Debug',
      ADMOB_IOS_APP_ID: 'ca-app-pub-1111111111111111~2222222222',
      ADMOB_IOS_BANNER_ID: 'ca-app-pub-1111111111111111/3333333333',
    });
    assert.equal(development.status, 0, development.stdout + development.stderr);
    const info = plist.parse(fs.readFileSync(path.join(fixture, 'ios/RamenProfitable/Info.plist'), 'utf8'));
    assert.equal(info.GADApplicationIdentifier, TEST_IDS.ios.appId);
    assert.equal(info.GADDelayAppMeasurementInit, true);
    assert.equal(info.NSUserTrackingUsageDescription, undefined);
    assert.equal(info.SKAdNetworkItems, undefined);
    assert.equal(runPhase('Debug').status, 0);
    const refused = runPhase('Release');
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /AdMob RELEASE BLOCKED/);
    const productionIds = {
      ADMOB_IOS_APP_ID: 'ca-app-pub-1111111111111111~2222222222',
      ADMOB_IOS_BANNER_ID: 'ca-app-pub-1111111111111111/3333333333',
    };
    const easProduction = prebuild({
      EAS_BUILD: 'true',
      EAS_BUILD_PLATFORM: 'ios',
      NODE_ENV: 'production',
      EAS_BUILD_PROFILE: 'production',
      REVENUECAT_BUILD_MODE: 'release',
      ...productionIds,
    });
    assert.equal(easProduction.status, 0, easProduction.stdout + easProduction.stderr);
    const easProductionInfo = plist.parse(fs.readFileSync(path.join(fixture, 'ios/RamenProfitable/Info.plist'), 'utf8'));
    assert.equal(easProductionInfo.GADApplicationIdentifier, productionIds.ADMOB_IOS_APP_ID);
    assert.equal(runPhase('Release', productionIds).status, 0);
    const production = prebuild({
      CONFIGURATION: 'Release',
      NODE_ENV: 'production',
      EAS_BUILD_PROFILE: 'production',
      ...productionIds,
    });
    assert.equal(production.status, 0, production.stdout + production.stderr);
    const productionInfo = plist.parse(fs.readFileSync(path.join(fixture, 'ios/RamenProfitable/Info.plist'), 'utf8'));
    assert.equal(productionInfo.GADApplicationIdentifier, productionIds.ADMOB_IOS_APP_ID);
    const releasePhase = runPhase('Release', productionIds);
    assert.equal(releasePhase.status, 0, releasePhase.stdout + releasePhase.stderr);
    assert.deepEqual(
      constantsConfig({ CONFIGURATION: 'Release' }).extra.admob.ios,
      {},
    );
    const releaseRuntime = constantsConfig({ CONFIGURATION: 'Release', ...productionIds });
    assert.deepEqual(releaseRuntime.extra.admob.ios, {
      appId: productionIds.ADMOB_IOS_APP_ID,
      bannerId: productionIds.ADMOB_IOS_BANNER_ID,
    });
    const validator = fs.readFileSync(validatorPath, 'utf8');
    let captured;
    try {
      fs.writeFileSync(validatorPath, 'process.stdout.write(JSON.stringify(process.argv.slice(2)));\n');
      captured = runPhase('Release', productionIds);
    } finally {
      fs.writeFileSync(validatorPath, validator);
    }
    assert.equal(captured.status, 0, captured.stdout + captured.stderr);
    const capturedArguments = captured.stdout.trim().split('\n').at(-1);
    assert.deepEqual(JSON.parse(capturedArguments), [
      releaseRuntime.extra.admob.ios.appId,
      releaseRuntime.extra.admob.ios.bannerId,
      'Release',
    ]);
    const changedProductionIds = [
      {
        name: 'app ID',
        ids: {
          ...productionIds,
          ADMOB_IOS_APP_ID: 'ca-app-pub-1111111111111111~4444444444',
        },
      },
      {
        name: 'banner ID',
        ids: {
          ...productionIds,
          ADMOB_IOS_BANNER_ID: 'ca-app-pub-1111111111111111/5555555555',
        },
      },
    ];
    for (const { name, ids } of changedProductionIds) {
      const changedRuntime = constantsConfig({ CONFIGURATION: 'Release', ...ids });
      assert.deepEqual(changedRuntime.extra.admob.ios, {
        appId: ids.ADMOB_IOS_APP_ID,
        bannerId: ids.ADMOB_IOS_BANNER_ID,
      });
      const mismatched = runPhase('Release', ids);
      assert.equal(mismatched.status, 1, `${name} drift was accepted\n${mismatched.stdout}${mismatched.stderr}`);
      assert.match(mismatched.stderr, /do not match the identifiers captured during prebuild/);
    }
    const projectLocalEnvironment = path.join(fixture, '.env.local');
    const xcodeEnvironment = path.join(fixture, 'ios/.xcode.env');
    const xcodeLocalEnvironment = path.join(fixture, 'ios/.xcode.env.local');
    const originalXcodeEnvironment = fs.readFileSync(xcodeEnvironment, 'utf8');
    const xcodeLocalIds = {
      ADMOB_IOS_APP_ID: 'ca-app-pub-1111111111111111~6666666666',
      ADMOB_IOS_BANNER_ID: 'ca-app-pub-1111111111111111/7777777777',
    };
    try {
      fs.writeFileSync(
        projectLocalEnvironment,
        `ADMOB_IOS_APP_ID=${productionIds.ADMOB_IOS_APP_ID}\nADMOB_IOS_BANNER_ID=${productionIds.ADMOB_IOS_BANNER_ID}\n`,
      );
      fs.appendFileSync(
        xcodeEnvironment,
        `\nexport ADMOB_IOS_APP_ID='${productionIds.ADMOB_IOS_APP_ID}'\nexport ADMOB_IOS_BANNER_ID='${productionIds.ADMOB_IOS_BANNER_ID}'\n`,
      );
      fs.writeFileSync(
        xcodeLocalEnvironment,
        `export ADMOB_IOS_APP_ID='${xcodeLocalIds.ADMOB_IOS_APP_ID}'\nexport ADMOB_IOS_BANNER_ID='${xcodeLocalIds.ADMOB_IOS_BANNER_ID}'\n`,
      );
      const xcodeRuntime = constantsConfigThroughXcode({ CONFIGURATION: 'Release' });
      assert.deepEqual(xcodeRuntime.extra.admob.ios, {
        appId: xcodeLocalIds.ADMOB_IOS_APP_ID,
        bannerId: xcodeLocalIds.ADMOB_IOS_BANNER_ID,
      });
      const divergentXcodeEnvironment = runPhase('Release');
      assert.equal(
        divergentXcodeEnvironment.status,
        1,
        `Xcode local identifier overrides were accepted\n${divergentXcodeEnvironment.stdout}${divergentXcodeEnvironment.stderr}`,
      );
      assert.match(divergentXcodeEnvironment.stderr, /do not match the identifiers captured during prebuild/);
      fs.writeFileSync(
        xcodeLocalEnvironment,
        `export CONFIGURATION='Release'\nexport ADMOB_IOS_APP_ID='${xcodeLocalIds.ADMOB_IOS_APP_ID}'\nexport ADMOB_IOS_BANNER_ID='${xcodeLocalIds.ADMOB_IOS_BANNER_ID}'\n`,
      );
      const originalDebugRuntime = constantsConfigThroughXcode({ CONFIGURATION: 'Debug' });
      assert.deepEqual(originalDebugRuntime.extra.admob, TEST_IDS);
      fs.writeFileSync(
        xcodeLocalEnvironment,
        `export CONFIGURATION='Debug'\nexport ADMOB_IOS_APP_ID='${xcodeLocalIds.ADMOB_IOS_APP_ID}'\nexport ADMOB_IOS_BANNER_ID='${xcodeLocalIds.ADMOB_IOS_BANNER_ID}'\n`,
      );
      const originalReleaseRuntime = constantsConfigThroughXcode({ CONFIGURATION: 'Release' });
      assert.deepEqual(originalReleaseRuntime.extra.admob.ios, {
        appId: xcodeLocalIds.ADMOB_IOS_APP_ID,
        bannerId: xcodeLocalIds.ADMOB_IOS_BANNER_ID,
      });
      const overriddenXcodeConfiguration = runPhase('Release');
      assert.equal(
        overriddenXcodeConfiguration.status,
        1,
        `Xcode local configuration bypassed the Release guard\n${overriddenXcodeConfiguration.stdout}${overriddenXcodeConfiguration.stderr}`,
      );
      assert.match(overriddenXcodeConfiguration.stderr, /do not match the identifiers captured during prebuild/);
    } finally {
      fs.writeFileSync(xcodeEnvironment, originalXcodeEnvironment);
      fs.rmSync(projectLocalEnvironment, { force: true });
      fs.rmSync(xcodeLocalEnvironment, { force: true });
    }
    const loginHome = path.join(fixture, 'login-home');
    const loginIds = {
      ADMOB_IOS_APP_ID: 'ca-app-pub-1111111111111111~8888888888',
      ADMOB_IOS_BANNER_ID: 'ca-app-pub-1111111111111111/9999999999',
    };
    fs.mkdirSync(loginHome);
    const loginProfile = path.join(loginHome, '.bash_profile');
    fs.writeFileSync(
      loginProfile,
      `export ADMOB_IOS_APP_ID='${loginIds.ADMOB_IOS_APP_ID}'\nexport ADMOB_IOS_BANNER_ID='${loginIds.ADMOB_IOS_BANNER_ID}'\n`,
    );
    const divergentLoginEnvironment = runPhase('Release', { HOME: loginHome });
    assert.equal(
      divergentLoginEnvironment.status,
      1,
      `login-shell identifier overrides were accepted\n${divergentLoginEnvironment.stdout}${divergentLoginEnvironment.stderr}`,
    );
    assert.match(divergentLoginEnvironment.stderr, /do not match the identifiers captured during prebuild/);
    fs.writeFileSync(
      loginProfile,
      `export CONFIGURATION='Debug'\nexport ADMOB_IOS_APP_ID='${loginIds.ADMOB_IOS_APP_ID}'\nexport ADMOB_IOS_BANNER_ID='${loginIds.ADMOB_IOS_BANNER_ID}'\n`,
    );
    const overriddenLoginConfiguration = runPhase('Release', { HOME: loginHome });
    assert.equal(
      overriddenLoginConfiguration.status,
      1,
      `login-shell configuration bypassed the Release guard\n${overriddenLoginConfiguration.stdout}${overriddenLoginConfiguration.stderr}`,
    );
    assert.match(overriddenLoginConfiguration.stderr, /do not match the identifiers captured during prebuild/);
    const sampleRuntime = runPhase('Release', {
      ADMOB_IOS_APP_ID: TEST_IDS.ios.appId,
      ADMOB_IOS_BANNER_ID: TEST_IDS.ios.bannerId,
    });
    assert.equal(sampleRuntime.status, 1, sampleRuntime.stdout + sampleRuntime.stderr);
    assert.match(sampleRuntime.stderr, /Google TEST identifier/);
    const malformedRuntime = runPhase('Release', {
      ...productionIds,
      ADMOB_IOS_BANNER_ID: 'not-an-admob-banner-id',
    });
    assert.equal(malformedRuntime.status, 1, malformedRuntime.stdout + malformedRuntime.stderr);
    assert.match(malformedRuntime.stderr, /iOS bannerId/);
    const crossPublisherRuntime = runPhase('Release', {
      ADMOB_IOS_APP_ID: 'ca-app-pub-2222222222222222~2222222222',
      ADMOB_IOS_BANNER_ID: productionIds.ADMOB_IOS_BANNER_ID,
    });
    assert.equal(crossPublisherRuntime.status, 1, crossPublisherRuntime.stdout + crossPublisherRuntime.stderr);
    assert.match(crossPublisherRuntime.stderr, /same publisher account/);
    assert.deepEqual(constantsConfig({ CONFIGURATION: 'Debug' }).extra.admob, TEST_IDS);
    assert.deepEqual(
      constantsConfig({ CONFIGURATION: 'Debug', NODE_ENV: 'production', ...productionIds }).extra.admob,
      TEST_IDS,
      'an exact Debug configuration must keep sample inventory despite a production NODE_ENV',
    );
    for (const variable of ['ADMOB_IOS_APP_ID', 'ADMOB_IOS_BANNER_ID']) {
      const marker = path.join(fixture, `injected-${variable}`);
      const payload = `'; touch ${marker}; $(touch ${marker}); exit 0; #`;
      const generated = prebuild({
        CONFIGURATION: 'Release',
        NODE_ENV: 'production',
        EAS_BUILD_PROFILE: 'production',
        ...productionIds,
        [variable]: payload,
      });
      assert.equal(generated.status, 0, generated.stdout + generated.stderr);
      const rejected = runPhase('Release', productionIds);
      assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
      assert.equal(fs.existsSync(marker), false, `${variable} escaped its generated shell argument`);
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
