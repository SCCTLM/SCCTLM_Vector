// Run: node --test tests/
// Colour maths, gamut checks and field rendering for the colour picker window.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ENGINE = require('../src/app/lib/jscolorengine/src/main.js');

function load() {
  const sandbox = { require };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of ['color-math.js', 'color-gamut.js', 'color-field.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app', f), 'utf8'), sandbox);
  }
  return sandbox;
}

const { ColorMath: CM, ColorGamut: CG, ColorField: CF } = load();
const near = (a, b, tol, msg) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) <= tol, `${msg || ''} ${JSON.stringify(a)} vs ${JSON.stringify(b)}`));

// Values from the Photoshop picker screenshot for #1e419b: H 223 S 81 B 61, L 30 a 15 b -54.
test('HSB and hex round trips match the reference colour', () => {
  const rgb = CM.hexToRgb('#1e419b');
  assert.deepStrictEqual([...rgb], [30, 65, 155]);
  near(CM.rgbToHsb(...rgb), [223, 81, 61], 0.6);
  near(CM.hsbToRgb(...CM.rgbToHsb(...rgb)), rgb, 1e-9);
  assert.strictEqual(CM.rgbToHex(rgb), '1e419b');
  assert.deepStrictEqual([...CM.hexToRgb('fff')], [255, 255, 255]);
  assert.strictEqual(CM.hexToRgb('12345'), null);
  assert.strictEqual(CM.hexToRgb('zzzzzz'), null);
});

test('hue is kept for greys and primaries land on the right hue', () => {
  assert.strictEqual(CM.rgbToHsb(128, 128, 128, 200)[0], 200);
  near(CM.rgbToHsb(255, 0, 0), [0, 100, 100], 1e-9);
  near(CM.rgbToHsb(0, 255, 0), [120, 100, 100], 1e-9);
  near(CM.rgbToHsb(0, 0, 255), [240, 100, 100], 1e-9);
  near(CM.hsbToRgb(360, 100, 100), [255, 0, 0], 1e-9);
});

test('Lab is D50 and round trips inside sRGB', () => {
  near(CM.rgbToLab(30, 65, 155), [29.6, 15, -54], 1, 'reference');
  near(CM.rgbToLab(255, 255, 255), [100, 0, 0], 0.01, 'white');
  near(CM.rgbToLab(0, 0, 0), [0, 0, 0], 0.01, 'black');
  near(CM.labToRgb(...CM.rgbToLab(30, 65, 155)), [30, 65, 155], 0.01);
  const clipped = CM.labToRgb(50, 127, -128);
  clipped.forEach((v) => assert.ok(v >= 0 && v <= 255));
});

test('profileInfo reads v2 desc and v4 mluc tags, rejects other data', () => {
  function profile(space, tagType, text) {
    const tag = tagType === 'desc'
      ? Buffer.concat([Buffer.from('desc\0\0\0\0'), u32(text.length + 1), Buffer.from(text + '\0')])
      : Buffer.concat([Buffer.from('mluc\0\0\0\0'), u32(1), u32(12), Buffer.from('enUS'), u32(text.length * 2), u32(28),
        Buffer.from(text, 'utf16le').swap16()]);
    const head = Buffer.alloc(144);
    head.write(space, 16); head.write('acsp', 36);
    head.writeUInt32BE(1, 128); head.write('desc', 132); head.writeUInt32BE(144, 136); head.writeUInt32BE(tag.length, 140);
    return new Uint8Array(Buffer.concat([head, tag]));
  }
  function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; }
  assert.deepStrictEqual({ ...CG.profileInfo(profile('CMYK', 'desc', 'Test v2')) }, { space: 'CMYK', name: 'Test v2' });
  assert.deepStrictEqual({ ...CG.profileInfo(profile('RGB ', 'mluc', 'Test v4')) }, { space: 'RGB', name: 'Test v4' });
  assert.strictEqual(CG.profileInfo(new Uint8Array(200)), null);
  assert.strictEqual(CG.profileInfo(null), null);
});

test('profile folders per platform', () => {
  const win = CG.profileDirs('win32', { 'ProgramFiles(x86)': 'C:\\PF86', ProgramFiles: 'C:\\PF', APPDATA: 'C:\\Users\\x\\AppData\\Roaming', SystemRoot: 'C:\\Win' });
  assert.ok(win.includes('C:\\PF86\\Common Files\\Adobe\\Color\\Profiles\\Recommended'));
  assert.ok(win.includes('C:\\PF\\Common Files\\Adobe\\Color\\Profiles'));
  assert.ok(win.includes('C:\\Users\\x\\AppData\\Roaming\\Adobe\\Color\\Profiles'));
  assert.ok(win.includes('C:\\Win\\System32\\spool\\drivers\\color'));
  assert.ok(win.every((d) => !/undefined/.test(d)), 'unset variables add no folder');
  const mac = CG.profileDirs('darwin', { HOME: '/Users/x' });
  assert.ok(mac.includes('/Library/Application Support/Adobe/Color/Profiles/Recommended'));
  assert.ok(mac.includes('/Users/x/Library/Application Support/Adobe/Color/Profiles'));
  assert.ok(mac.includes('/Users/x/Library/ColorSync/Profiles'));
});

// The Adobe profiles cannot be redistributed, so these run only where Creative Cloud installed them.
const profiles = CG.listCmykProfiles(CG.profileDirs(process.platform, process.env));
const swop = CG.findProfile(profiles, 'U.S. Web Coated (SWOP) v2');
const needsSwop = { skip: swop ? false : 'U.S. Web Coated (SWOP) v2 is not installed on this machine' };

test('lists installed CMYK profiles by their internal name', needsSwop, () => {
  assert.ok(/USWebCoatedSWOP\.icc$/i.test(swop.path));
  assert.ok(profiles.every((p) => p.name && p.path));
  assert.strictEqual(CG.findProfile(profiles, 'nope'), null);
});

test('gamut verdicts and CMYK match Illustrator for SWOP', needsSwop, () => {
  const g = CG.create(ENGINE, fs.readFileSync(swop.path));
  assert.strictEqual(g.name, 'U.S. Web Coated (SWOP) v2');
  // Illustrator 26.0.2, convertSampleColor in a SWOP document.
  near(g.toCmyk([30, 65, 155]), [99.8, 86.6, 2.9, 0.2], 1.5, 'cmyk');
  near(g.toCmyk([57, 25, 209]), [85.4, 83.8, 0, 0], 1.5, 'cmyk');
  assert.strictEqual(g.isOutOfGamut([30, 65, 155]), true); // round trip Delta E 4.8 in Illustrator
  assert.strictEqual(g.isOutOfGamut([0, 0, 255]), true);
  assert.strictEqual(g.isOutOfGamut([128, 128, 128]), false);
  assert.strictEqual(g.isOutOfGamut([255, 255, 255]), false);
  const fixed = g.nearestInGamut([30, 65, 155]);
  assert.strictEqual(g.isOutOfGamut(fixed), false);
});

test('the interpolated mask agrees with the exact check', needsSwop, () => {
  const g = CG.create(ENGINE, fs.readFileSync(swop.path));
  let seed = 7, disagree = 0;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) % 256;
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const c = [rnd(), rnd(), rnd()];
    if ((g.maskDeltaE(...c) > CG.THRESHOLD) !== g.isOutOfGamut(c)) disagree++;
  }
  assert.ok(disagree / N < 0.01, `disagree ${disagree}/${N}`);
});

test('field and slider markers map back to the same values in every mode', () => {
  const start = { hsb: [223, 81, 61], rgb: [30, 65, 155], lab: [30, 15, -54] };
  for (const id of Object.keys(CF.MODES)) {
    const v = start[CF.MODES[id].group];
    const p = CF.position(id, v);
    near(CF.atSlider(id, CF.atField(id, v, p.x, p.y), p.s), v, 1e-9, id);
  }
  // Hue mode: saturation runs left to right, brightness bottom to top, hue down the slider.
  assert.deepStrictEqual({ ...CF.position('hsb-h', [180, 0, 100]) }, { x: 0, y: 0, s: 0.5 });
  assert.deepStrictEqual(CF.atField('hsb-h', [10, 50, 50], 1, 1), [10, 100, 0]);
  assert.deepStrictEqual(CF.atField('hsb-h', [10, 50, 50], 2, -1), [10, 100, 100]);
});

test('field render: corners in hue mode and grey where the mask says so', () => {
  const w = 16, h = 16, data = new Uint8ClampedArray(w * h * 4);
  CF.renderField('hsb-h', [0, 0, 0], w, h, data, null);
  const px = (x, y) => Array.from(data.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
  assert.deepStrictEqual(px(0, 0), [255, 255, 255, 255]);     // top-left: white
  assert.deepStrictEqual(px(w - 1, 0), [255, 0, 0, 255]);     // top-right: pure hue
  assert.deepStrictEqual(px(0, h - 1), [0, 0, 0, 255]);       // bottom: black
  CF.renderField('hsb-h', [0, 0, 0], w, h, data, (r, g, b) => r > 200 && g < 50);
  assert.deepStrictEqual(px(w - 1, 0), [CF.GREY, CF.GREY, CF.GREY, 255]);
  assert.deepStrictEqual(px(0, 0), [255, 255, 255, 255]);
});

test('slider render: hue strip ignores the current colour, others use it', () => {
  const data = new Uint8ClampedArray(2 * 7 * 4);
  CF.renderSlider('hsb-h', [100, 0, 0], 2, 7, data);
  assert.deepStrictEqual(Array.from(data.slice(0, 4)), [255, 0, 0, 255]);
  CF.renderSlider('rgb-r', [0, 10, 20], 2, 7, data);
  assert.deepStrictEqual(Array.from(data.slice(0, 4)), [255, 10, 20, 255]);
  assert.deepStrictEqual(Array.from(data.slice(-4)), [0, 10, 20, 255]);
});

test('mask render of the reference colour greys the saturated side only', needsSwop, () => {
  const g = CG.create(ENGINE, fs.readFileSync(swop.path));
  const w = 256, h = 256, data = new Uint8ClampedArray(w * h * 4);
  const isOut = (r, gg, b) => g.maskDeltaE(r, gg, b) > CG.THRESHOLD;
  CF.renderField('hsb-h', [223, 81, 61], w, h, data, isOut);
  const grey = (x, y) => data[(y * w + x) * 4] === CF.GREY && data[(y * w + x) * 4 + 1] === CF.GREY;
  assert.ok(grey(w - 1, 0), 'top-right (saturated, bright blue) is out of gamut');
  assert.ok(!grey(0, h - 1) && !grey(10, 200), 'dark, unsaturated corner is printable');
});

test('virtual sRGB profile keeps all RGB colors in-gamut and converts RGB <-> CMYK cleanly', () => {
  assert.strictEqual(CG.isRgbProfile(CG.RGB_PROFILE_NAME), true);
  assert.strictEqual(CG.isRgbProfile('U.S. Web Coated (SWOP) v2'), false);
  const rgbProfile = CG.createRgb();
  assert.strictEqual(rgbProfile.isRgb, true);
  assert.strictEqual(rgbProfile.isOutOfGamut([0, 255, 255]), false);
  assert.strictEqual(rgbProfile.isOutOfGamut([255, 0, 255]), false);
  assert.strictEqual(rgbProfile.maskDeltaE(31, 200, 255), 0);
  assert.deepStrictEqual(rgbProfile.nearestInGamut([31, 200, 255]), [31, 200, 255]);
  near(rgbProfile.toCmyk([0, 0, 0]), [0, 0, 0, 100], 1e-6, 'black');
  near(rgbProfile.toCmyk([255, 255, 255]), [0, 0, 0, 0], 1e-6, 'white');
  near(rgbProfile.cmykToRgb(rgbProfile.toCmyk([31, 200, 255])), [31, 200, 255], 1e-6, 'round-trip');
});
