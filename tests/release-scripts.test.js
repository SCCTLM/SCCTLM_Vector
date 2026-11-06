// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const script = (name) => path.join(root, 'scripts', name);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ilus-rel-'));

test('package-app builds stamped, hashed, native-free artifacts the updater can read', async () => {
  const out = tmp();
  execFileSync('node', [script('package-app.mjs'), '1.2.3'], { env: { ...process.env, ILUS_OUT_DIR: out } });

  const zipPath = path.join(out, 'app-v1.2.3.zip');
  const zip = fs.readFileSync(zipPath);
  const shaLine = fs.readFileSync(zipPath + '.sha256', 'utf8');
  assert.strictEqual(shaLine.split(/\s+/)[0], crypto.createHash('sha256').update(zip).digest('hex'));

  const manifest = fs.readFileSync(path.join(out, 'ext', 'CSXS', 'manifest.xml'), 'utf8');
  assert.match(manifest, /ExtensionBundleVersion="1\.2\.3"/);
  assert.match(manifest, /<Extension Id="vn\.scctlm\.ilus\.panel" Version="1\.2\.3"/);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(out, 'ext', 'app', 'version.json'), 'utf8')).version, '1.2.3');
  assert.ok(fs.existsSync(path.join(out, 'ilus-extension.zip.sha256')));

  // Same bytes through the updater's own zip reader and signature check.
  const vm = require('node:vm');
  const sandbox = { require, Buffer, URL, Promise };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/app/updater.js'), 'utf8'), sandbox);
  const names = sandbox.Updater.readZip(zip).map((e) => e.name);
  assert.ok(names.includes('version.json') && names.includes('index.html') && names.includes('jsx/engine.jsx'));

  const keys = crypto.generateKeyPairSync('ed25519');
  execFileSync('node', [script('sign-release.mjs'), zipPath], {
    env: { ...process.env, ILUS_SIGNING_KEY: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }) }
  });
  sandbox.Updater.verifyDownload(zip, shaLine, fs.readFileSync(zipPath + '.sig'), keys.publicKey.export({ type: 'spki', format: 'pem' }));

  // Deterministic: a second build gives identical bytes.
  const out2 = tmp();
  execFileSync('node', [script('package-app.mjs'), '1.2.3'], { env: { ...process.env, ILUS_OUT_DIR: out2 } });
  assert.ok(fs.readFileSync(path.join(out2, 'app-v1.2.3.zip')).equals(zip));
});

test('scan-native flags native extensions and binary magic bytes, passes clean trees', () => {
  const clean = tmp();
  fs.writeFileSync(path.join(clean, 'a.js'), 'x');
  execFileSync('node', [script('scan-native.mjs'), clean]);

  const cases = { 'x.node': 'x', 'renamed.txt': Buffer.from([0x4d, 0x5a, 0x90, 0x00]), 'tool': Buffer.from([0xcf, 0xfa, 0xed, 0xfe]), 'lib': Buffer.from([0x7f, 0x45, 0x4c, 0x46]) };
  for (const [name, content] of Object.entries(cases)) {
    const dir = tmp();
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', name), content);
    assert.throws(() => execFileSync('node', [script('scan-native.mjs'), dir], { stdio: 'pipe' }), undefined, name);
  }
});

test('sign-release refuses to overwrite existing keys', () => {
  const dir = tmp();
  const priv = path.join(dir, 'p.pem'), pub = path.join(dir, 'p.pub.pem');
  execFileSync('node', [script('sign-release.mjs'), '--generate-key', priv, pub]);
  assert.throws(() => execFileSync('node', [script('sign-release.mjs'), '--generate-key', priv, pub], { stdio: 'pipe' }));
});
