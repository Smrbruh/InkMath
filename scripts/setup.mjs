import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(await readFile(path.join(root, 'vendor/tectonic.lock.json'), 'utf8'));
const hash = (data) => createHash('sha256').update(data).digest('hex');
if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('InkMath currently supports Windows x64. See docs/DEVELOPMENT.md.');
}

const target = path.join(root, 'vendor/tectonic.exe');
let valid = false;
try {
  valid = hash(await readFile(target)) === lock.binarySha256;
} catch {}
if (!valid) {
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'inkmath-setup-'));
  try {
    console.log(`Downloading Tectonic ${lock.version} from the upstream release…`);
    const response = await fetch(lock.url, { signal: AbortSignal.timeout(180000) });
    if (!response.ok) throw new Error(`Compiler download failed: HTTP ${response.status}`);
    const archive = Buffer.from(await response.arrayBuffer());
    if (hash(archive) !== lock.archiveSha256) throw new Error('Tectonic archive SHA-256 mismatch.');
    const archivePath = path.join(scratch, 'tectonic.zip');
    const expanded = path.join(scratch, 'expanded');
    await writeFile(archivePath, archive);
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Expand-Archive -LiteralPath $env:INKMATH_ZIP -DestinationPath $env:INKMATH_EXPANDED',
      ],
      {
        windowsHide: true,
        env: { ...process.env, INKMATH_ZIP: archivePath, INKMATH_EXPANDED: expanded },
        stdio: 'inherit',
      },
    );
    const binary = await readFile(path.join(expanded, 'tectonic.exe'));
    if (hash(binary) !== lock.binarySha256)
      throw new Error('Tectonic executable SHA-256 mismatch.');
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(expanded, 'tectonic.exe'), target);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
console.log(`Tectonic ${lock.version}: SHA-256 verified.`);
execFileSync(process.execPath, [path.join(root, 'node_modules/electron/install.js')], {
  cwd: root,
  windowsHide: true,
  stdio: 'inherit',
});
console.log('Ready. Run npm start.');
