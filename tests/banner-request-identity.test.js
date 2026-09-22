const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const harness = path.join(root, 'tests/fixtures/banner-request-identity-harness.m');
const guard = path.join(root, 'native/ios/RPBannerRequestIdentity.m');

test('request identity boundary targets the pinned RN-GMA release', () => {
  const dependency = require('react-native-google-mobile-ads/package.json');
  assert.equal(dependency.version, '16.5.0');
});

test('native banner callbacks remain bound to the GAD request that created them', t => {
  if (os.platform() !== 'darwin') {
    t.skip('the native lifecycle harness requires the Apple Objective-C runtime');
    return;
  }

  fs.mkdirSync(path.join(root, '.expo'), { recursive: true });
  const fixture = fs.mkdtempSync(path.join(root, '.expo/banner-request-identity-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));

  const compile = (name, sources) => {
    const executable = path.join(fixture, name);
    const result = spawnSync(
      'xcrun',
      ['clang', '-fobjc-arc', '-fblocks', '-framework', 'Foundation', ...sources, '-o', executable],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return executable;
  };

  const unguarded = compile('unguarded', [harness]);
  const reproduction = spawnSync(unguarded, [], { encoding: 'utf8' });
  assert.equal(reproduction.status, 0, reproduction.stdout + reproduction.stderr);
  assert.match(reproduction.stdout, /request A callbacks reached request B/);

  const guarded = compile('guarded', [harness, guard]);
  const regression = spawnSync(guarded, ['guarded'], { encoding: 'utf8' });
  assert.equal(regression.status, 0, regression.stdout + regression.stderr);
  assert.match(regression.stdout, /delayed and retired callbacks rejected/);
});
