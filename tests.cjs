const test = require('node:test'),
  assert = require('node:assert/strict');
const { buildTex, normalizeSettings } = require('./latex.cjs');
const { annotatePdf } = require('./annotations.cjs');
const { PDFDocument } = require('pdf-lib');
test('body source keeps Cyrillic and maths in a complete XeLaTeX document', () => {
  const source = 'Русский: вероятность. Қазақша: Ә Ғ Қ Ң Ө Ұ Ү Һ І. \\[x^2\\]';
  const tex = buildTex(source);
  assert.ok(tex.includes(source));
  assert.equal((tex.match(/\\begin\{document\}/g) || []).length, 1);
  assert.ok(tex.includes('fontspec'));
  assert.ok(tex.includes('Segoe Print'));
});
test('appearance settings are constrained to supported values', () => {
  assert.deepEqual(
    normalizeSettings({ font: '\\input{secret}', ink: 'oops', size: 98, paper: 'x' }),
    { font: 'segoe', ink: 'blue', paper: 'plain', size: 11 },
  );
});
test('full documents preserve their own content and avoid duplicate font package', () => {
  const s =
    '\\documentclass{article}\n\\usepackage{fontspec}\n\\begin{document}Привет\\end{document}';
  const t = buildTex(s, { paper: 'grid' });
  assert.equal((t.match(/\\usepackage\{fontspec\}/g) || []).length, 1);
  assert.ok(t.includes('Привет'));
  assert.ok(t.includes('multiput'));
});
test('malformed full document produces a readable error', () =>
  assert.throws(() => buildTex('\\documentclass{article}'), /missing/));
test('extended Cyrillic uses a glyph fallback instead of dropping characters', () => {
  const tex = buildTex('Ә Ғ Қ Ң Ө Ұ Ү Һ І ә ғ қ ң ө ұ ү һ і');
  assert.ok(tex.includes('newunicodechar'));
  assert.ok(tex.includes('Segoe UI'));
  assert.ok(tex.includes('\\char"4D8'));
});
test('body accepts blank, ruled and grid paper styles', () => {
  for (const paper of ['plain', 'ruled', 'grid'])
    assert.ok(buildTex('Test', { paper }).endsWith('\\end{document}\n'));
});
test('annotations export as a valid PDF with embedded Cyrillic text', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]);
  const result = await annotatePdf(await doc.save(), {
    1: [
      {
        kind: 'pen',
        points: [
          [30, 30],
          [150, 60],
        ],
        color: '#596c9e',
        width: 3,
      },
      {
        kind: 'text',
        text: 'Привет! Ә Ғ Қ Ң Ө Ұ Ү Һ І',
        x: 80,
        y: 150,
        width: 24,
        color: '#242424',
      },
    ],
  });
  const read = await PDFDocument.load(result);
  assert.equal(read.getPageCount(), 1);
  assert.ok(result.length > 1000);
});
