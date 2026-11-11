// Build release artifacts into dist/ for a version.
// Usage: node scripts/package-app.mjs <X.Y.Z>
// Produces: dist/ext/ (full extension), app-vX.Y.Z.zip (+ .sha256) for the updater,
//           vector-extension.zip (+ .sha256) for the installers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { zipDirectory } from './zip-writer.mjs';
import { scanDir } from './scan-native.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = (process.argv[2] || '').replace(/^v/, '');
if (!/^\d+\.\d+\.\d+$/.test(version)) { console.error('Usage: package-app.mjs <X.Y.Z>'); process.exit(2); }

const dist = process.env.VECTOR_OUT_DIR ? path.resolve(process.env.VECTOR_OUT_DIR) : path.join(root, 'dist');
const ext = path.join(dist, 'ext');
fs.mkdirSync(dist, { recursive: true });
fs.rmSync(ext, { recursive: true, force: true });
fs.cpSync(path.join(root, 'src'), ext, { recursive: true });

// Stamp the version into version.json and the manifest.
const versionFile = path.join(ext, 'app', 'version.json');
const meta = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
meta.version = version;
fs.writeFileSync(versionFile, JSON.stringify(meta, null, 2) + '\n');

const manifestFile = path.join(ext, 'CSXS', 'manifest.xml');
const manifest = fs.readFileSync(manifestFile, 'utf8')
  .replace(/(ExtensionBundleVersion=")[^"]*"/, `$1${version}"`)
  .replace(/(<Extension Id="[^"]*" Version=")[^"]*"/, `$1${version}"`);
fs.writeFileSync(manifestFile, manifest);

const offenders = scanDir(ext);
if (offenders.length) { console.error('Native code found (Rosetta guard):\n' + offenders.join('\n')); process.exit(1); }

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
function emit(name, buf) {
  fs.writeFileSync(path.join(dist, name), buf);
  fs.writeFileSync(path.join(dist, name + '.sha256'), `${sha(buf)}  ${name}\n`);
  console.log(`${name}  ${buf.length} bytes`);
}

emit(`app-v${version}.zip`, zipDirectory(path.join(ext, 'app')));
emit('vector-extension.zip', zipDirectory(ext));
