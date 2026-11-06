// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const sandbox = { require, Buffer, URL, Promise };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/updater.js'), 'utf8'), sandbox);
const Updater = sandbox.Updater;

// ---- helpers ----
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Minimal zip writer. files: { name: string|Buffer }. Names are written verbatim (for zip-slip tests).
function makeZip(files, { deflate = true } = {}) {
  const locals = [], central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content);
    const comp = deflate ? zlib.deflateRawSync(data) : data;
    const method = deflate ? 8 : 0;
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(data), 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(method, 10);
    cd.writeUInt32LE(crc32(data), 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, comp);
    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8); eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, eocd]);
}

const keys = crypto.generateKeyPairSync('ed25519');
const pubPem = keys.publicKey.export({ type: 'spki', format: 'pem' });
const sign = (buf) => crypto.sign(null, buf, keys.privateKey);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ilus-upd-'));

const goodFiles = (version) => ({
  'version.json': JSON.stringify({ version, minLoaderVersion: 1 }),
  'index.html': '<html></html>',
  'jsx/engine.jsx': '// engine'
});

// Serves a fake GitHub Releases API plus assets for one release.
function mockServer(release) {
  const server = http.createServer((req, res) => {
    if (req.url === '/repos/o/r/releases/latest') {
      const base = `http://127.0.0.1:${server.address().port}`;
      const assets = Object.keys(release.files).map((name) => ({ name, browser_download_url: `${base}/dl/${name}` }));
      res.end(JSON.stringify({ tag_name: release.tag, body: 'notes', assets }));
    } else if (req.url.startsWith('/dl/')) {
      const f = release.files[decodeURIComponent(req.url.slice(4))];
      if (!f) { res.statusCode = 404; res.end(); } else res.end(f);
    } else { res.statusCode = 404; res.end(); }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function releaseFiles(version, zip, { sigOf = zip, shaOf = zip } = {}) {
  return {
    [`app-v${version}.zip`]: zip,
    [`app-v${version}.zip.sha256`]: sha(shaOf),
    [`app-v${version}.zip.sig`]: sign(sigOf)
  };
}

async function withServer(release, fn) {
  const server = await mockServer(release);
  try { return await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.closeAllConnections(); server.close(); }
}

// ---- versions ----
test('compareVersions orders plain X.Y.Z and rejects anything else', () => {
  assert.strictEqual(Updater.compareVersions('1.2.0', '1.1.9'), 1);
  assert.strictEqual(Updater.compareVersions('v1.0.0', '1.0.0'), 0);
  assert.strictEqual(Updater.compareVersions('0.9.9', '1.0.0'), -1);
  assert.strictEqual(Updater.compareVersions('1.0.0-beta', '1.0.0'), null);
});

// ---- zip ----
test('readZip reads stored and deflated entries', () => {
  for (const deflate of [true, false]) {
    const entries = Updater.readZip(makeZip({ 'a.txt': 'hello', 'dir/b.txt': 'world' }, { deflate }));
    assert.strictEqual(entries.map((e) => e.name).join(','), 'a.txt,dir/b.txt');
    assert.strictEqual(entries[1].data.toString(), 'world');
  }
});

test('readZip rejects zip-slip, absolute and drive paths', () => {
  for (const bad of ['../evil.txt', 'a/../../evil.txt', '/etc/passwd', 'C:/x.txt', 'a\\b.txt']) {
    assert.throws(() => Updater.readZip(makeZip({ [bad]: 'x' })), /Unsafe path/, bad);
  }
});

test('extractApp requires version.json and index.html and cleans up on failure', () => {
  const dir = path.join(tmp(), 'staging');
  assert.throws(() => Updater.extractApp(makeZip({ 'index.html': 'x' }), dir), /missing/);
  assert.ok(!fs.existsSync(dir));
  const meta = Updater.extractApp(makeZip(goodFiles('1.2.0')), dir);
  assert.strictEqual(meta.version, '1.2.0');
  assert.ok(fs.existsSync(path.join(dir, 'jsx', 'engine.jsx')));
});

// ---- verification ----
test('verifyDownload accepts a valid zip and rejects tampering', () => {
  const zip = makeZip(goodFiles('1.2.0'));
  Updater.verifyDownload(zip, sha(zip) + '  app.zip', sign(zip), pubPem);
  const flipped = Buffer.from(zip); flipped[5] ^= 1;
  assert.throws(() => Updater.verifyDownload(flipped, sha(zip), sign(zip), pubPem), /Checksum/);
  assert.throws(() => Updater.verifyDownload(zip, sha(zip), sign(Buffer.from('other')), pubPem), /Signature/);
  assert.throws(() => Updater.verifyDownload(zip, 'nothex', sign(zip), pubPem), /Malformed/);
  const other = crypto.generateKeyPairSync('ed25519');
  assert.throws(() => Updater.verifyDownload(zip, sha(zip), crypto.sign(null, zip, other.privateKey), pubPem), /Signature/);
});

// ---- check + stage against the mock Releases API ----
test('checkForUpdate returns null when current, skips failed versions, offers newer ones', async () => {
  const zip = makeZip(goodFiles('1.2.0'));
  await withServer({ tag: 'v1.2.0', files: releaseFiles('1.2.0', zip) }, async (apiBase) => {
    const base = { repo: 'o/r', apiBase, allowInsecure: true };
    assert.strictEqual(await Updater.checkForUpdate({ ...base, currentVersion: '1.2.0' }), null);
    assert.strictEqual(await Updater.checkForUpdate({ ...base, currentVersion: '1.0.0', failedVersions: ['1.2.0'] }), null);
    const info = await Updater.checkForUpdate({ ...base, currentVersion: '1.0.0' });
    assert.strictEqual(info.version, '1.2.0');
    assert.strictEqual(info.notes, 'notes');
  });
});

test('checkForUpdate refuses when updates are disabled (no repo)', async () => {
  await assert.rejects(Updater.checkForUpdate({ repo: '', currentVersion: '1.0.0' }), /not enabled/);
});

test('stageUpdate stages a valid release with a ready marker', async () => {
  const zip = makeZip(goodFiles('1.2.0'));
  const ext = tmp();
  await withServer({ tag: 'v1.2.0', files: releaseFiles('1.2.0', zip) }, async (apiBase) => {
    const info = await Updater.checkForUpdate({ repo: 'o/r', apiBase, allowInsecure: true, currentVersion: '1.0.0' });
    await Updater.stageUpdate(info, { extDir: ext, publicKeyPem: pubPem, allowInsecure: true });
    assert.ok(fs.existsSync(path.join(ext, 'app.staging', '.ready')));
    assert.ok(fs.existsSync(path.join(ext, 'app.staging', 'index.html')));
  });
});

test('stageUpdate leaves nothing on disk for tampered, mis-signed, slip, mismatched or truncated releases', async () => {
  const good = makeZip(goodFiles('1.2.0'));
  const flipped = Buffer.from(good); flipped[flipped.length - 30] ^= 1;
  const cases = {
    'flipped byte': releaseFiles('1.2.0', flipped, { sigOf: good, shaOf: good }),
    'wrong signature': releaseFiles('1.2.0', good, { sigOf: Buffer.from('nope') }),
    'zip slip': (() => { const z = makeZip({ ...goodFiles('1.2.0'), '../evil.txt': 'x' }); return releaseFiles('1.2.0', z); })(),
    'version mismatch': (() => { const z = makeZip(goodFiles('9.9.9')); return releaseFiles('1.2.0', z); })(),
    'needs newer loader': (() => {
      const z = makeZip({ ...goodFiles('1.2.0'), 'version.json': JSON.stringify({ version: '1.2.0', minLoaderVersion: 2 }) });
      return releaseFiles('1.2.0', z);
    })()
  };
  for (const [label, files] of Object.entries(cases)) {
    const ext = tmp();
    await withServer({ tag: 'v1.2.0', files }, async (apiBase) => {
      const info = await Updater.checkForUpdate({ repo: 'o/r', apiBase, allowInsecure: true, currentVersion: '1.0.0' });
      await assert.rejects(Updater.stageUpdate(info, { extDir: ext, publicKeyPem: pubPem, allowInsecure: true }), undefined, label);
      assert.ok(!fs.existsSync(path.join(ext, 'app.staging')), label + ' left a staging folder');
      assert.ok(!fs.existsSync(path.join(ext, 'app')), label + ' touched app');
    });
  }
});

test('stageUpdate rejects a truncated download', async () => {
  const zip = makeZip(goodFiles('1.2.0'));
  const server = http.createServer((req, res) => {
    if (req.url.endsWith('.zip')) {
      res.setHeader('Content-Length', zip.length);
      res.write(zip.slice(0, 20));
      res.destroy();
    } else res.end('x');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const ext = tmp();
  try {
    await assert.rejects(Updater.stageUpdate(
      { version: '1.2.0', zipUrl: base + '/a.zip', shaUrl: base + '/a.sha256', sigUrl: base + '/a.sig' },
      { extDir: ext, publicKeyPem: pubPem, allowInsecure: true }));
    assert.ok(!fs.existsSync(path.join(ext, 'app.staging')));
  } finally { server.closeAllConnections(); server.close(); }
});

test('downloads over plain http are refused unless explicitly allowed', async () => {
  await assert.rejects(Updater.stageUpdate(
    { version: '1.2.0', zipUrl: 'http://example.test/a.zip', shaUrl: 'http://example.test/a', sigUrl: 'http://example.test/b' },
    { extDir: tmp(), publicKeyPem: pubPem }), /non-https/);
});

test('check throttle allows one check per day', () => {
  const file = path.join(tmp(), 'state.json');
  const now = 1_000_000_000_000;
  assert.strictEqual(Updater.dueForCheck(file, now), true);
  Updater.recordCheck(file, now);
  assert.strictEqual(Updater.dueForCheck(file, now + 3600 * 1000), false);
  assert.strictEqual(Updater.dueForCheck(file, now + 25 * 3600 * 1000), true);
});
