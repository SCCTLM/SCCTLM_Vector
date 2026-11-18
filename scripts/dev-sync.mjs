// Copy src/app into the installed CEP extension so Illustrator runs the working tree.
// Usage: node scripts/dev-sync.mjs [--watch]
// Override the target with VECTOR_EXT_DIR (the extension folder that contains app/).
// version.json is left alone so the installed version stamp and updater state stay intact.
// Restart the panel (and Illustrator, which caches the engine) after a sync.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcApp = path.join(root, 'src', 'app');
const SKIP = new Set(['version.json']);

function extensionDir() {
  if (process.env.VECTOR_EXT_DIR) return path.resolve(process.env.VECTOR_EXT_DIR);
  const base = process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Adobe', 'CEP', 'extensions')
    : path.join(os.homedir(), 'Library', 'Application Support', 'Adobe', 'CEP', 'extensions');
  return path.join(base, 'vn.scctlm.vector');
}

const destApp = path.join(extensionDir(), 'app');
if (!fs.existsSync(destApp)) {
  console.error('Installed extension not found: ' + destApp + '\nInstall the panel first or set VECTOR_EXT_DIR.');
  process.exit(1);
}

function copyFile(rel) {
  if (SKIP.has(path.basename(rel))) return false;
  const from = path.join(srcApp, rel);
  const to = path.join(destApp, rel);
  const st = fs.statSync(from);
  if (!st.isFile()) return false;
  if (fs.existsSync(to) && fs.readFileSync(to).equals(fs.readFileSync(from))) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

function walk(dir, rel = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const r = path.join(rel, e.name);
    return e.isDirectory() ? walk(path.join(dir, e.name), r) : [r];
  });
}

let count = 0;
for (const rel of walk(srcApp)) {
  if (copyFile(rel)) { console.log('synced ' + rel); count++; }
}
console.log(count ? count + ' file(s) synced to ' + destApp : 'already up to date: ' + destApp);

if (process.argv.includes('--watch')) {
  console.log('watching src/app (Ctrl+C to stop)');
  fs.watch(srcApp, { recursive: true }, (_evt, rel) => {
    if (!rel) return;
    try { if (copyFile(rel)) console.log('synced ' + rel); } catch { /* file mid-write or removed */ }
  });
}
