// ed25519 signing for update zips.
//   node scripts/sign-release.mjs --generate-key <private.pem> <public.pem>
//   node scripts/sign-release.mjs <file>            (private key PEM in env VECTOR_SIGNING_KEY)
// The signature is written next to the file as <file>.sig. The private key must never be committed.
import fs from 'node:fs';
import crypto from 'node:crypto';

const args = process.argv.slice(2);

if (args[0] === '--generate-key') {
  const [, privPath, pubPath] = args;
  if (!privPath || !pubPath) { console.error('Usage: --generate-key <private.pem> <public.pem>'); process.exit(2); }
  if (fs.existsSync(privPath) || fs.existsSync(pubPath)) { console.error('Refusing to overwrite an existing key file'); process.exit(1); }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  fs.writeFileSync(pubPath, publicKey.export({ type: 'spki', format: 'pem' }));
  console.log(`Wrote ${privPath} (keep secret, store as the VECTOR_SIGNING_KEY secret) and ${pubPath} (ship as src/update-pubkey.pem).`);
} else {
  const file = args[0];
  const pem = process.env.VECTOR_SIGNING_KEY;
  if (!file || !pem) { console.error('Usage: sign-release.mjs <file> with VECTOR_SIGNING_KEY set'); process.exit(2); }
  const signature = crypto.sign(null, fs.readFileSync(file), crypto.createPrivateKey(pem));
  fs.writeFileSync(file + '.sig', signature);
  console.log(`Signed ${file}`);
}
