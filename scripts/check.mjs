import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const dir of [root, path.join(root, 'scripts')]) {
  for (const name of await readdir(dir)) {
    if (/\.(?:cjs|mjs|js)$/.test(name)) {
      execFileSync(process.execPath, ['--check', path.join(dir, name)], { stdio: 'inherit' });
    }
  }
}
console.log('JavaScript syntax checks passed.');
