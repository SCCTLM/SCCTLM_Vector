// Rosetta guard: fail if a directory holds anything that could be native code.
// Usage: node scripts/scan-native.mjs <dir> [<dir>...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BAD_EXTENSIONS = new Set(['.node', '.dll', '.exe', '.dylib', '.so', '.a', '.lib', '.bundle', '.sys']);

// Mach-O (thin and fat, both byte orders), PE ("MZ") and ELF.
const MAGICS = [
  ['Mach-O', [0xfe, 0xed, 0xfa, 0xce]], ['Mach-O', [0xfe, 0xed, 0xfa, 0xcf]],
  ['Mach-O', [0xce, 0xfa, 0xed, 0xfe]], ['Mach-O', [0xcf, 0xfa, 0xed, 0xfe]],
  ['Mach-O fat', [0xca, 0xfe, 0xba, 0xbe]], ['PE', [0x4d, 0x5a]], ['ELF', [0x7f, 0x45, 0x4c, 0x46]]
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export function scanDir(dir) {
  const offenders = [];
  for (const file of walk(dir)) {
    const ext = path.extname(file).toLowerCase();
    if (BAD_EXTENSIONS.has(ext)) { offenders.push(`${file}: native extension ${ext}`); continue; }
    const fd = fs.openSync(file, 'r');
    const head = Buffer.alloc(4);
    const n = fs.readSync(fd, head, 0, 4, 0);
    fs.closeSync(fd);
    for (const [kind, magic] of MAGICS) {
      if (n >= magic.length && magic.every((b, i) => head[i] === b)) { offenders.push(`${file}: ${kind} binary`); break; }
    }
  }
  return offenders;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dirs = process.argv.slice(2);
  if (!dirs.length) { console.error('Usage: scan-native.mjs <dir>...'); process.exit(2); }
  const offenders = dirs.flatMap((d) => scanDir(d));
  if (offenders.length) {
    console.error('Native code found (Rosetta guard):\n' + offenders.join('\n'));
    process.exit(1);
  }
  console.log('No native code found in: ' + dirs.join(', '));
}
