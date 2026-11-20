import { packager } from '@electron/packager';
import { readFile, access, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(path.join(root, 'vendor/tectonic.lock.json'), 'utf8'));
const compiler = path.join(root, 'vendor/tectonic.exe');
await access(compiler).catch(() => {
  throw new Error('Compiler is missing. Run npm run setup first.');
});
if (
  createHash('sha256')
    .update(await readFile(compiler))
    .digest('hex') !== lock.binarySha256
) {
  throw new Error('Compiler integrity check failed. Run npm run setup.');
}
const folders = await packager({
  dir: root,
  name: 'InkMath',
  platform: 'win32',
  arch: 'x64',
  out: path.join(root, 'dist'),
  overwrite: true,
  asar: false,
  icon: path.join(root, 'assets/app.ico'),
  appVersion: manifest.version,
  appCopyright: 'Copyright © 2026 Smrbruh and InkMath contributors',
  win32metadata: { CompanyName: 'InkMath', FileDescription: 'InkMath — Paper Studio' },
  ignore: [
    /^\/(?:\.git|\.github|\.cache|dist|docs|scripts)(?:\/|$)/,
    /^\/tests\.cjs$/,
    /^\/(?:README.*\.md|CONTRIBUTING\.md|CHANGELOG\.md|SECURITY\.md|\.prettier.*|\.editorconfig|\.gitignore|\.gitattributes)$/,
  ],
});
for (const folder of folders) {
  await copyFile(path.join(root, 'LICENSE'), path.join(folder, 'LICENSE-InkMath.txt'));
  await copyFile(
    path.join(root, 'THIRD_PARTY_NOTICES.md'),
    path.join(folder, 'THIRD_PARTY_NOTICES.md'),
  );
  console.log(`Portable application: ${folder}`);
}
