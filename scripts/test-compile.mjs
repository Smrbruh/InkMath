import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';

const require = createRequire(import.meta.url);
const { buildTex } = require('../latex.cjs');
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, '.cache/compile-tests');
await mkdir(out, { recursive: true });
const compiler = path.join(root, 'vendor/tectonic.exe');
const examples = [
  [
    'cyrillic',
    String.raw`\section*{Русский и қазақша}
Вероятность, ёж, съёмка. Ә Ғ Қ Ң Ө Ұ Ү Һ І ә ғ қ ң ө ұ ү һ і.
\[ P(A\mid B)=\frac{P(A\cap B)}{P(B)}. \]`,
    { paper: 'grid' },
  ],
  ['course', await readFile(path.join(root, 'assets/course-body.tex'), 'utf8'), {}],
];
for (const [name, source, settings] of examples) {
  const input = path.join(out, `${name}.tex`);
  await writeFile(input, buildTex(source, settings));
  execFileSync(compiler, ['--untrusted', '--keep-logs', '--outdir', out, input], {
    cwd: out,
    windowsHide: true,
    stdio: 'pipe',
    timeout: 300000,
  });
  const log = await readFile(path.join(out, `${name}.log`), 'utf8');
  assert.ok(
    !/Missing character:|Overfull \\[hv]box/.test(log),
    `${name}: font or layout regression`,
  );
  const pdf = await PDFDocument.load(await readFile(path.join(out, `${name}.pdf`)));
  assert.ok(pdf.getPageCount() > 0);
  if (name === 'course') assert.ok(pdf.getPageCount() >= 25);
  console.log(`${name}: ${pdf.getPageCount()} page(s), no missing glyphs or overflowing boxes.`);
}
