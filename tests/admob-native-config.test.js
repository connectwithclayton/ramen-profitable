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
    const env = { ...process.env, CI: '1', NODE_ENV: 'development', EAS_BUILD_PROFILE: 'development', REVENUECAT_BUILD_MODE: '' };
    const prebuild = additional => spawnSync(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'prebuild', '--platform', 'ios', '--no-install'], { cwd: fixture, env: { ...env, ...additional }, encoding: 'utf8' });
    const phase = () => {
      const project = xcode.project(path.join(fixture, 'ios/RamenProfitable.xcodeproj/project.pbxproj')).parseSync();
      const phases = Object.values(project.hash.project.objects.PBXShellScriptBuildPhase).filter(value => value.name === '"Reject AdMob test identifiers in Release"');
      assert.equal(phases.length, 1, 'one native release guard after every prebuild');
      return JSON.parse(phases[0].shellScript.replace(/\n/g, '\\n'));
    };
    const runPhase = configuration => spawnSync('/bin/sh', ['-c', phase()], { cwd: fixture, env: { ...env, SRCROOT: path.join(fixture, 'ios'), CONFIGURATION: configuration }, encoding: 'utf8' });
    const constantsConfig = additional => {
      const constantsEnvironment = { ...process.env };
      for (const variable of [
        'EAS_BUILD_PROFILE',
        'NODE_ENV',
        'REVENUECAT_BUILD_MODE',
        'CONFIGURATION',
        'REVENUECAT_TEST_STORE_API_KEY',
        'REVENUECAT_IOS_API_KEY',
        'REVENUECAT_ANDROID_API_KEY',
        'ADMOB_IOS_APP_ID',
        'ADMOB_IOS_BANNER_ID',
      ]) delete constantsEnvironment[variable];
      Object.assign(constantsEnvironment, additional);
      const result = spawnSync(
        process.execPath,
        [path.join(root, 'node_modules/expo-constants/scripts/build/getAppConfig.js'), fixture, path.join(fixture, 'ios')],
        { cwd: fixture, env: constantsEnvironment, encoding: 'utf8' },
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
      return JSON.parse(fs.readFileSync(path.join(fixture, 'ios/app.config'), 'utf8'));
    };
    const development = prebuild();
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
    const production = prebuild({ NODE_ENV: 'production', EAS_BUILD_PROFILE: 'production', ...productionIds });
    assert.equal(production.status, 0, production.stdout + production.stderr);
    const productionInfo = plist.parse(fs.readFileSync(path.join(fixture, 'ios/RamenProfitable/Info.plist'), 'utf8'));
    assert.equal(productionInfo.GADApplicationIdentifier, productionIds.ADMOB_IOS_APP_ID);
    assert.equal(runPhase('Release').status, 0);
    assert.deepEqual(constantsConfig({ CONFIGURATION: 'Release' }).extra.admob.ios, {});
    const releaseRuntime = constantsConfig({ CONFIGURATION: 'Release', ...productionIds });
    assert.deepEqual(releaseRuntime.extra.admob.ios, {
      appId: productionIds.ADMOB_IOS_APP_ID,
      bannerId: productionIds.ADMOB_IOS_BANNER_ID,
    });
    const validatorPath = path.join(fixture, 'scripts/check-admob-release.js');
    const validator = fs.readFileSync(validatorPath, 'utf8');
    let captured;
    try {
      fs.writeFileSync(validatorPath, 'process.stdout.write(JSON.stringify(process.argv.slice(2)));\n');
      captured = runPhase('Release');
    } finally {
      fs.writeFileSync(validatorPath, validator);
    }
    assert.equal(captured.status, 0, captured.stdout + captured.stderr);
    assert.deepEqual(JSON.parse(captured.stdout), [
      releaseRuntime.extra.admob.ios.appId,
      releaseRuntime.extra.admob.ios.bannerId,
    ]);
    assert.deepEqual(constantsConfig({ CONFIGURATION: 'Debug' }).extra.admob, TEST_IDS);
    for (const variable of ['ADMOB_IOS_APP_ID', 'ADMOB_IOS_BANNER_ID']) {
      const marker = path.join(fixture, `injected-${variable}`);
      const payload = `'; touch ${marker}; $(touch ${marker}); exit 0; #`;
      const generated = prebuild({
        NODE_ENV: 'production',
        EAS_BUILD_PROFILE: 'production',
        ...productionIds,
        [variable]: payload,
      });
      assert.equal(generated.status, 0, generated.stdout + generated.stderr);
      const rejected = runPhase('Release');
      assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
      assert.equal(fs.existsSync(marker), false, `${variable} escaped its generated shell argument`);
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
