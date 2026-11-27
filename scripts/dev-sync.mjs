// Copy src/app and fixed shell files into the installed CEP extension so Illustrator runs the working tree.
// Usage: node scripts/dev-sync.mjs [--watch]
// Override the target with VECTOR_EXT_DIR (the extension folder that contains app/).
// version.json is left alone so the installed version stamp and updater state stay intact.
// Restart the panel (and Illustrator, which caches the manifest and engine) after a sync.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');
const srcApp = path.join(srcDir, 'app');
const SKIP = new Set(['version.json']);
const SHELL_FILES = [
  path.join('CSXS', 'manifest.xml'),
  'loader.html',
  'loader.js',
  'loader-core.js',
  'picker-loader.html'
];
const OBSOLETE_SHELL_FILES = ['notice-loader.html'];

function extensionDir() {
  if (process.env.VECTOR_EXT_DIR) return path.resolve(process.env.VECTOR_EXT_DIR);
  const base = process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Adobe', 'CEP', 'extensions')
    : path.join(os.homedir(), 'Library', 'Application Support', 'Adobe', 'CEP', 'extensions');
  return path.join(base, 'vn.scctlm.vector');
}

const extDir = extensionDir();
const destApp = path.join(extDir, 'app');
if (!fs.existsSync(destApp)) {
  console.error('Installed extension not found: ' + destApp + '\nInstall the panel first or set VECTOR_EXT_DIR.');
  process.exit(1);
}

function copyPair(from, to) {
  if (!fs.existsSync(from)) return false;
  const st = fs.statSync(from);
  if (!st.isFile()) return false;
  if (fs.existsSync(to) && fs.readFileSync(to).equals(fs.readFileSync(from))) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

function copyFile(rel) {
  if (SKIP.has(path.basename(rel))) return false;
  return copyPair(path.join(srcApp, rel), path.join(destApp, rel));
}

function walk(dir, rel = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const r = path.join(rel, e.name);
    return e.isDirectory() ? walk(path.join(dir, e.name), r) : [r];
  });
}

let count = 0;
for (const rel of SHELL_FILES) {
  if (copyPair(path.join(srcDir, rel), path.join(extDir, rel))) {
    console.log('synced shell ' + rel);
    count++;
  }
}
for (const rel of OBSOLETE_SHELL_FILES) {
  const target = path.join(extDir, rel);
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
    console.log('removed obsolete ' + rel);
    count++;
  }
}
for (const rel of walk(srcApp)) {
  if (copyFile(rel)) { console.log('synced ' + rel); count++; }
}
console.log(count ? count + ' file(s) synced to ' + extDir : 'already up to date: ' + extDir);

if (process.argv.includes('--watch')) {
  console.log('watching src/app (Ctrl+C to stop)');
  fs.watch(srcApp, { recursive: true }, (_evt, rel) => {
    if (!rel) return;
    try { if (copyFile(rel)) console.log('synced ' + rel); } catch { /* file mid-write or removed */ }
  });
}
