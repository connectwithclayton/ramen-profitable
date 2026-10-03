const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;
const listeners = { motion: new Set(), power: new Set(), app: new Set() };
const subscribe = (key, cb) => {
  listeners[key].add(cb);
  return { remove: () => listeners[key].delete(cb) };
};
const emit = (key, value) => {
  for (const cb of listeners[key]) cb(value);
};
let motionRead = async () => false;
let powerRead = async () => false;
let storageValue = null;
const loops = [];
const timings = [];
const native = {
  Platform: { OS: 'ios', select: options => options.ios ?? options.default },
  StyleSheet: { create: value => value, hairlineWidth: 1 },
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Easing: { sin: 'sin', inOut: value => value },
  AccessibilityInfo: {
    isReduceMotionEnabled: () => motionRead(),
    addEventListener: (_, cb) => subscribe('motion', cb),
  },
  AppState: {
    currentState: 'active',
    addEventListener: (_, cb) => subscribe('app', cb),
  },
  Animated: {
    View: 'AnimatedView',
    Value: class {
      constructor(value) { this.value = value; }
      setValue(value) { this.value = value; }
      interpolate(config) { return config; }
    },
    add: (a, b) => [a, b],
    timing: (value, config) => {
      timings.push(config);
      return { start() {}, stop() {} };
    },
    sequence: value => value,
    loop: () => {
      const loop = { started: false, stopped: false, start() { this.started = true; }, stop() { this.stopped = true; } };
      loops.push(loop);
      return loop;
    },
  },
};
const originalLoad = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'react-native') return native;
  if (name === 'expo-battery') return {
    isLowPowerModeEnabledAsync: () => powerRead(),
    addLowPowerModeListener: cb => subscribe('power', cb),
  };
  if (name === 'expo-haptics') return { impactAsync: async () => {}, ImpactFeedbackStyle: { Light: 'light' } };
  if (name === 'react-native-svg') return new Proxy({ __esModule: true, default: 'Svg' }, { get: (obj, key) => obj[key] ?? String(key) });
  if (name === '@react-native-async-storage/async-storage') return {
    getItem: async () => storageValue,
    setItem: async (_, value) => { storageValue = value; },
  };
  return originalLoad(name, parent, main);
};
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, filename);
};
const { useGame } = require('../src/state/gameStore.ts');
const { selectPersistedState } = require('../src/state/experience.ts');
const { BETA_TESTER } = require('../src/content/content.ts');
const CodeScreen = require('../src/screens/CodeScreen.tsx').default;
const CodeRingGlow = require('../src/components/CodeRingGlow.tsx').default;
const project = { name: 'Tabsy', idea: 'tabs', loc: 0, need: 300, manualTaps: 0, depletionReactionDelivered: false };
const glow = root => root.root.findAllByProps({ testID: 'code-ring-glow' })[0];
const opacity = root => glow(root).props.style[1].opacity;
const mount = async component => {
  let root;
  await act(async () => { root = create(component); });
  return root;
};
const unmount = async root => { await act(async () => root.unmount()); };

test.beforeEach(async () => {
  await useGame.persist.rehydrate();
  motionRead = async () => false;
  powerRead = async () => false;
  native.AppState.currentState = 'active';
  loops.length = 0;
  timings.length = 0;
  useGame.setState({ project: { ...project }, energy: 50, energyRegen: 0.06, hasTappedCode: false, autoCode: 0, overlay: null, notifs: [] });
});

test('first successful ring press softens the glow immediately and persists across projects/relaunch', async () => {
  const root = await mount(React.createElement(CodeScreen));
  assert.deepEqual(opacity(root).outputRange, [0.42, 1]);
  const ring = root.root.findAllByType('Pressable').find(el => el.props.accessibilityRole === 'button');
  await act(async () => ring.props.onPress());
  assert.equal(useGame.getState().project.loc, 3);
  assert.equal(useGame.getState().hasTappedCode, true);
  assert.deepEqual(opacity(root).outputRange, [0.08, 0.16]);
  assert.equal(loops.length, 1, 'successful taps soften without restarting the breath');
  const saved = storageValue;
  assert.equal(JSON.parse(saved).state.hasTappedCode, true);
  await unmount(root);
  useGame.getState().newProject();
  assert.equal(useGame.getState().hasTappedCode, true);
  useGame.setState({ hasTappedCode: false });
  storageValue = saved;
  await useGame.persist.rehydrate();
  assert.equal(useGame.getState().hasTappedCode, true);
  const reopened = await mount(React.createElement(CodeScreen));
  assert.deepEqual(opacity(reopened).outputRange, [0.08, 0.16]);
  await unmount(reopened);
});

test('no usable energy removes the glow and stops the loop; regeneration resumes the correct cue', async () => {
  const root = await mount(React.createElement(CodeScreen));
  const pulse = loops.at(-1);
  for (const energy of [0.99, 0, 0.5]) {
    await act(async () => useGame.setState({ energy }));
    assert.equal(glow(root), undefined);
    await act(async () => { assert.equal(useGame.getState().tapCode(), false); });
    assert.equal(useGame.getState().hasTappedCode, false);
  }
  assert.equal(pulse.stopped, true);
  await act(async () => useGame.setState({ energy: 1 }));
  assert.deepEqual(opacity(root).outputRange, [0.42, 1]);
  await act(async () => { assert.equal(useGame.getState().tapCode(), true); });
  assert.equal(glow(root), undefined);
  await act(async () => useGame.setState({ energy: 1.06 }));
  assert.deepEqual(opacity(root).outputRange, [0.08, 0.16]);
  await unmount(root);
});

test('completion, absent projects, and covering overlays have no glow or active pulse', async () => {
  const root = await mount(React.createElement(CodeScreen));
  await act(async () => useGame.setState({ project: { ...project, loc: 300 } }));
  assert.equal(glow(root), undefined);
  assert.equal(useGame.getState().tapCode(), false);
  assert.equal(useGame.getState().hasTappedCode, false);
  await act(async () => useGame.setState({ project: null }));
  assert.equal(glow(root), undefined);
  assert.equal(useGame.getState().tapCode(), false);
  await act(async () => useGame.setState({ project, overlay: { type: 'review', appName: project.name } }));
  assert.equal(glow(root), undefined);
  assert.ok(loops.every(loop => loop.stopped));
  await unmount(root);
});

test('automation does not fake ring discovery or restore a glow without energy', async () => {
  const root = await mount(React.createElement(CodeScreen));
  await act(async () => {
    useGame.setState({ autoCode: 6 });
    useGame.getState().fastTick();
  });
  assert.equal(useGame.getState().project.loc, 3);
  assert.equal(useGame.getState().hasTappedCode, false);
  assert.deepEqual(opacity(root).outputRange, [0.42, 1]);
  assert.equal(loops.length, 1, 'game ticks do not restart the native loop');
  await act(async () => useGame.setState({ energy: 0.99 }));
  assert.equal(glow(root), undefined);
  await unmount(root);
});

test('legacy saves infer discovery only from successful manual taps, not automated LOC', () => {
  const select = state => selectPersistedState(state, BETA_TESTER).hasTappedCode;
  assert.equal(select({}), false);
  assert.equal(select({ project: { ...project, manualTaps: 1 } }), true);
  assert.equal(select({ project: { ...project, loc: 90, manualTaps: 0 } }), false);
  assert.equal(select({ hasTappedCode: true, project: null }), true);
  assert.equal(select({ hasTappedCode: 'true', project }), false);
  assert.equal(select(JSON.parse(JSON.stringify(selectPersistedState({ hasTappedCode: true, project }, BETA_TESTER)))), true);
});

test('unknown preferences stay static; reduced motion and low power changes stop and resume the native pulse', async () => {
  let resolveMotion;
  let resolvePower;
  motionRead = () => new Promise(resolve => { resolveMotion = resolve; });
  powerRead = () => new Promise(resolve => { resolvePower = resolve; });
  const root = await mount(React.createElement(CodeRingGlow, { size: 248, discovered: false }));
  assert.equal(opacity(root), 0.64);
  assert.equal(loops.length, 0);
  await act(async () => resolveMotion(false));
  assert.equal(loops.length, 0);
  await act(async () => resolvePower(false));
  assert.equal(loops.at(-1).started, true);
  assert.ok(timings.every(config => config.useNativeDriver && config.isInteraction === false && config.duration === 1900));
  await act(async () => emit('motion', true));
  assert.equal(opacity(root), 0.64);
  assert.equal(loops.at(-1).stopped, true);
  await act(async () => emit('motion', false));
  await act(async () => emit('power', { lowPowerMode: true }));
  assert.equal(opacity(root), 0.64);
  assert.equal(loops.at(-1).stopped, true);
  await act(async () => root.update(React.createElement(CodeRingGlow, { size: 248, discovered: true })));
  assert.equal(opacity(root), 0.11);
  await act(async () => emit('power', { lowPowerMode: false }));
  assert.deepEqual(opacity(root).outputRange, [0.08, 0.16]);
  assert.equal(glow(root).props.pointerEvents, 'none');
  assert.equal(glow(root).props.accessibilityElementsHidden, true);
  await unmount(root);
  assert.equal(loops.at(-1).stopped, true);
  for (const set of Object.values(listeners)) assert.equal(set.size, 0);
});

test('late initial preference reads cannot undo a newer system event', async () => {
  let resolveMotion;
  let resolvePower;
  motionRead = () => new Promise(resolve => { resolveMotion = resolve; });
  powerRead = () => new Promise(resolve => { resolvePower = resolve; });
  const root = await mount(React.createElement(CodeRingGlow, { size: 248, discovered: false }));
  await act(async () => { emit('motion', true); emit('power', { lowPowerMode: true }); });
  await act(async () => { resolveMotion(false); resolvePower(false); });
  assert.equal(opacity(root), 0.64);
  assert.equal(loops.length, 0);
  await unmount(root);
});

test('backgrounding stops the pulse; foreground rechecks preferences; failed reads stay static', async () => {
  const root = await mount(React.createElement(CodeRingGlow, { size: 248, discovered: false }));
  await act(async () => emit('app', 'background'));
  assert.equal(glow(root), undefined);
  assert.equal(loops.at(-1).stopped, true);
  motionRead = async () => { throw new Error('unavailable'); };
  powerRead = async () => { throw new Error('unavailable'); };
  await act(async () => emit('app', 'active'));
  assert.equal(opacity(root), 0.64);
  assert.equal(loops.length, 1);
  await unmount(root);
});
