// Self-update client: find a newer GitHub Release, download, verify, extract to a staging folder.
// Pure JS on Node built-ins only (https, crypto, zlib, fs): no native modules, no child processes.
// The loader (loader-core.js) swaps the staged folder in on next launch.
(function (global) {
  'use strict';

  var fs = require('fs');
  var path = require('path');
  var crypto = require('crypto');
  var zlib = require('zlib');

  var DEFAULT_API_BASE = 'https://api.github.com';
  var CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
  var MAX_ZIP_BYTES = 20 * 1024 * 1024;
  var MAX_UNPACKED_BYTES = 60 * 1024 * 1024;
  var MAX_ENTRIES = 2000;
  var MAX_REDIRECTS = 5;
  var REQUEST_TIMEOUT_MS = 30000;
  var DEFAULT_LOADER_VERSION = 1;

  // ---------- versions ----------
  function parseVersion(text) {
    var m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(text).trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  }

  // 1 if a > b, -1 if a < b, 0 if equal; null when either is not a plain X.Y.Z version.
  function compareVersions(a, b) {
    var x = parseVersion(a), y = parseVersion(b);
    if (!x || !y) return null;
    for (var i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
    return 0;
  }

  // ---------- http ----------
  function getBuffer(target, opts) {
    opts = opts || {};
    var maxBytes = opts.maxBytes || MAX_ZIP_BYTES;
    var redirects = opts.redirects === undefined ? MAX_REDIRECTS : opts.redirects;
    return new Promise(function (resolve, reject) {
      var parsed = new URL(target);
      var secure = parsed.protocol === 'https:';
      if (!secure && !(opts.allowInsecure && parsed.protocol === 'http:')) {
        reject(new Error('Refusing non-https URL'));
        return;
      }
      var client = require(secure ? 'https' : 'http');
      var headers = { 'User-Agent': 'scctlm-vector-updater', Accept: opts.accept || '*/*' };
      var req = client.get({
        protocol: parsed.protocol, hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, headers: headers
      }, function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirects <= 0) { reject(new Error('Too many redirects')); return; }
          var next = new URL(res.headers.location, target).href;
          getBuffer(next, { maxBytes: maxBytes, redirects: redirects - 1, accept: opts.accept, allowInsecure: opts.allowInsecure })
            .then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode)); return; }
        var declared = Number(res.headers['content-length']);
        if (declared > maxBytes) { res.resume(); reject(new Error('Download too large')); return; }
        var chunks = [], total = 0;
        res.on('data', function (c) {
          total += c.length;
          if (total > maxBytes) { req.abort(); reject(new Error('Download too large')); return; }
          chunks.push(c);
        });
        res.on('end', function () {
          if (declared && total !== declared) { reject(new Error('Truncated download')); return; }
          resolve(Buffer.concat(chunks));
        });
        res.on('error', reject);
      });
      req.setTimeout(REQUEST_TIMEOUT_MS, function () { req.abort(); reject(new Error('Request timed out')); });
      req.on('error', reject);
    });
  }

  // ---------- release lookup ----------
  function findAsset(release, name) {
    var assets = release.assets || [];
    for (var i = 0; i < assets.length; i++) if (assets[i].name === name) return assets[i];
    return null;
  }

  // Resolves to null when up to date, otherwise { version, notes, zipUrl, shaUrl, sigUrl }.
  function checkForUpdate(opts) {
    var repo = opts.repo;
    if (!repo) return Promise.reject(new Error('Updates are not enabled in this build'));
    var apiBase = opts.apiBase || DEFAULT_API_BASE;
    var failed = opts.failedVersions || [];
    return getBuffer(apiBase + '/repos/' + repo + '/releases/latest', {
      maxBytes: 1024 * 1024, accept: 'application/vnd.github+json', allowInsecure: opts.allowInsecure
    }).then(function (buf) {
      var release = JSON.parse(buf.toString('utf8'));
      var version = parseVersion(release.tag_name);
      if (!version) throw new Error('Release tag is not a version: ' + release.tag_name);
      var tag = version.join('.');
      if (compareVersions(tag, opts.currentVersion) !== 1 || failed.indexOf(tag) >= 0) return null;
      var zip = findAsset(release, 'app-v' + tag + '.zip');
      var sha = findAsset(release, 'app-v' + tag + '.zip.sha256');
      var sig = findAsset(release, 'app-v' + tag + '.zip.sig');
      if (!zip || !sha || !sig) throw new Error('Release v' + tag + ' is missing update files');
      return {
        version: tag,
        notes: String(release.body || ''),
        zipUrl: zip.browser_download_url,
        shaUrl: sha.browser_download_url,
        sigUrl: sig.browser_download_url
      };
    });
  }

  // ---------- verification ----------
  function sha256Hex(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

  // shaText is the .sha256 file content ("<hex>" or "<hex>  filename"). Throws on any mismatch.
  function verifyDownload(zip, shaText, sigBuf, publicKeyPem) {
    var expected = String(shaText).trim().split(/\s+/)[0].toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(expected)) throw new Error('Malformed checksum file');
    if (sha256Hex(zip) !== expected) throw new Error('Checksum mismatch');
    var ok = false;
    try { ok = crypto.verify(null, zip, publicKeyPem, sigBuf); } catch (e) { ok = false; }
    if (!ok) throw new Error('Signature verification failed');
  }

  // ---------- zip ----------
  function safeEntryName(name) {
    if (!name || name.indexOf('\0') >= 0 || name.indexOf('\\') >= 0) return false;
    if (name.charAt(0) === '/' || /^[A-Za-z]:/.test(name)) return false;
    return name.split('/').every(function (seg) { return seg !== '..'; });
  }

  // Returns [{ name, data }] for files only. Rejects unsafe names, zip64, encryption, oversize.
  function readZip(buf) {
    var eocd = -1;
    for (var i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a zip file');
    var count = buf.readUInt16LE(eocd + 10);
    var cdOffset = buf.readUInt32LE(eocd + 16);
    if (count === 0xffff || cdOffset === 0xffffffff) throw new Error('Zip64 is not supported');
    if (count > MAX_ENTRIES) throw new Error('Too many entries');

    var entries = [], pos = cdOffset, unpacked = 0;
    for (var n = 0; n < count; n++) {
      if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('Corrupt zip directory');
      var flags = buf.readUInt16LE(pos + 8);
      var method = buf.readUInt16LE(pos + 10);
      var compSize = buf.readUInt32LE(pos + 20);
      var size = buf.readUInt32LE(pos + 24);
      var nameLen = buf.readUInt16LE(pos + 28);
      var extraLen = buf.readUInt16LE(pos + 30);
      var commentLen = buf.readUInt16LE(pos + 32);
      var local = buf.readUInt32LE(pos + 42);
      var name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
      pos += 46 + nameLen + extraLen + commentLen;

      if (!safeEntryName(name)) throw new Error('Unsafe path in zip: ' + name);
      if (name.charAt(name.length - 1) === '/') continue;
      if (flags & 1) throw new Error('Encrypted zip entries are not supported');
      unpacked += size;
      if (unpacked > MAX_UNPACKED_BYTES) throw new Error('Zip contents too large');

      if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) throw new Error('Corrupt zip entry');
      var start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      if (start + compSize > buf.length) throw new Error('Truncated zip entry');
      var raw = buf.slice(start, start + compSize);
      var data;
      if (method === 0) data = raw;
      else if (method === 8) data = zlib.inflateRawSync(raw);
      else throw new Error('Unsupported zip compression');
      if (data.length !== size) throw new Error('Zip entry size mismatch: ' + name);
      entries.push({ name: name, data: data });
    }
    return entries;
  }

  function rmrf(target) {
    var st;
    try { st = fs.lstatSync(target); } catch (e) { return; }
    if (st.isDirectory()) {
      fs.readdirSync(target).forEach(function (f) { rmrf(path.join(target, f)); });
      fs.rmdirSync(target);
    } else {
      fs.unlinkSync(target);
    }
  }

  // Extracts into destDir (created fresh). Requires version.json and index.html at the root.
  // Returns the parsed version.json. destDir is removed again on any failure.
  function extractApp(zipBuf, destDir) {
    var entries = readZip(zipBuf);
    var names = entries.map(function (e) { return e.name; });
    if (names.indexOf('version.json') < 0 || names.indexOf('index.html') < 0) {
      throw new Error('Update is missing version.json or index.html');
    }
    rmrf(destDir);
    try {
      entries.forEach(function (e) {
        var target = path.join(destDir, e.name);
        if (target.indexOf(path.join(destDir, path.sep)) !== 0) throw new Error('Unsafe path in zip: ' + e.name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, e.data);
      });
      return JSON.parse(fs.readFileSync(path.join(destDir, 'version.json'), 'utf8'));
    } catch (e) {
      rmrf(destDir);
      throw e;
    }
  }

  // ---------- staging ----------
  // Downloads, verifies and extracts the release into <extDir>/app.staging, then writes the
  // ".ready" marker last so the loader never applies a half-written folder.
  function stageUpdate(info, opts) {
    var extDir = opts.extDir;
    var pem = opts.publicKeyPem;
    var dl = { allowInsecure: opts.allowInsecure };
    if (!pem) return Promise.reject(new Error('No update signing key installed'));
    var staging = path.join(extDir, 'app.staging');
    return Promise.all([
      getBuffer(info.zipUrl, { maxBytes: MAX_ZIP_BYTES, allowInsecure: dl.allowInsecure }),
      getBuffer(info.shaUrl, { maxBytes: 4096, allowInsecure: dl.allowInsecure }),
      getBuffer(info.sigUrl, { maxBytes: 4096, allowInsecure: dl.allowInsecure })
    ]).then(function (parts) {
      verifyDownload(parts[0], parts[1].toString('utf8'), parts[2], pem);
      var meta = extractApp(parts[0], staging);
      try {
        if (meta.version !== info.version) throw new Error('Update version does not match its release');
        if ((meta.minLoaderVersion || 1) > (opts.loaderVersion || DEFAULT_LOADER_VERSION)) {
          var err = new Error('This update needs a newer installer');
          err.needsInstaller = true;
          throw err;
        }
        fs.writeFileSync(path.join(staging, '.ready'), info.version, 'utf8');
      } catch (e) {
        rmrf(staging);
        throw e;
      }
      return meta;
    });
  }

  // ---------- throttle state ----------
  function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
  }

  function dueForCheck(stateFile, now) {
    var s = readJson(stateFile, {});
    return !(typeof s.lastCheck === 'number' && now - s.lastCheck < CHECK_INTERVAL_MS && s.lastCheck <= now);
  }

  function recordCheck(stateFile, now) {
    var s = readJson(stateFile, {});
    s.lastCheck = now;
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(s), 'utf8');
  }

  global.Updater = {
    compareVersions: compareVersions,
    checkForUpdate: checkForUpdate,
    verifyDownload: verifyDownload,
    readZip: readZip,
    extractApp: extractApp,
    stageUpdate: stageUpdate,
    dueForCheck: dueForCheck,
    recordCheck: recordCheck,
    rmrf: rmrf
  };
}(window));
