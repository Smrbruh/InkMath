const fonts = { segoe: 'Segoe Print', comic: 'Comic Sans MS', classic: 'Georgia' };
const inks = { blue: '193B62', black: '252C35', green: '24584B', purple: '59416E' };
const coverage = require('./font-coverage.json');
function cyrillicFallback(source, s) {
  const missing = new Set(coverage[s.font]);
  const chars = [...new Set([...source].filter((c) => missing.has(c.codePointAt(0))))];
  if (!chars.length) return '';
  return (
    '\\usepackage{newunicodechar}\n\\newfontfamily\\notebookfallback{Segoe UI}\n' +
    chars
      .map(
        (c) =>
          '\\newunicodechar{' +
          c +
          '}{{\\notebookfallback\\char"' +
          c.codePointAt(0).toString(16).toUpperCase() +
          '}}',
      )
      .join('\n')
  );
}
function normalizeSettings(s = {}) {
  return {
    font: fonts[s.font] ? s.font : 'segoe',
    ink: inks[s.ink] ? s.ink : 'blue',
    paper: ['plain', 'ruled', 'grid'].includes(s.paper) ? s.paper : 'plain',
    size: [10, 11, 12].includes(Number(s.size)) ? Number(s.size) : 11,
  };
}
function style(s) {
  return String.raw`\setmainfont{${fonts[s.font]}}[ItalicFont=${fonts[s.font]},BoldItalicFont=${fonts[s.font]}]
\definecolor{notebookink}{HTML}{${inks[s.ink]}}
\definecolor{notebookline}{HTML}{E5ECF3}
\geometry{a4paper,margin=22mm,headheight=16pt}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0.65em}
\setlength{\emergencystretch}{3em}
\linespread{1.12}
\AtBeginDocument{\color{notebookink}}
${s.paper === 'plain' ? '' : String.raw`\AddToShipoutPictureBG{\AtPageLowerLeft{\color{notebookline}\linethickness{0.2pt}\multiput(0,0)(0,20){43}{\line(1,0){600}}${s.paper === 'grid' ? String.raw`\multiput(0,0)(20,0){31}{\line(0,1){850}}` : ''}}}`}`;
}
function buildTex(source, inputSettings = {}) {
  if (typeof source !== 'string' || source.length > 2000000)
    throw new Error('Document must be text, up to 2 MB.');
  const s = normalizeSettings(inputSettings);
  const clean = source.replace(/^\s*%.*$/gm, '');
  if (/\\documentclass(?:\[[^\]]*\])?\{/.test(clean)) {
    const begin = source.indexOf('\\begin{document}');
    if (begin < 0) throw new Error('Full LaTeX document is missing \\begin{document}.');
    const preamble = source.slice(0, begin);
    const needed = [
      'fontspec',
      'xcolor',
      'geometry',
      ...(s.paper === 'plain' ? [] : ['eso-pic']),
    ].filter(
      (p) =>
        !new RegExp(
          '\\\\(?:usepackage|RequirePackage)(?:\\[[^\\]]*\\])?\\{[^}]*\\b' + p + '\\b[^}]*\\}',
        ).test(preamble),
    );
    return (
      preamble +
      '\n% InkMath appearance\n' +
      needed.map((p) => '\\usepackage{' + p + '}').join('\n') +
      '\n' +
      style(s) +
      '\n' +
      cyrillicFallback(source, s) +
      '\n' +
      source.slice(begin)
    );
  }
  return String.raw`% InkMath Notes. Compile with XeLaTeX or Tectonic.
\documentclass[${s.size}pt,a4paper]{article}
\usepackage[OT1]{fontenc}
\usepackage{amsmath,amssymb,eulervm}
\usepackage{fontspec}
\usepackage{geometry,xcolor,eso-pic}
\usepackage{booktabs,array,longtable}
\usepackage[unicode,hidelinks,hypertexnames=false]{hyperref}
\makeatletter
\renewcommand{\@pnumwidth}{2.4em}
\renewcommand{\@tocrmarg}{3.4em}
\makeatother
\hypersetup{pdftitle={Probability and Statistics / InkMath Notes},pdfauthor={InkMath}}
${style(s)}
${cyrillicFallback(source, s)}
\begin{document}
${source}
\end{document}
`;
}
module.exports = { buildTex, normalizeSettings };
