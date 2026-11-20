const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs = require('node:fs/promises');
const path = require('node:path');
function color(hex) {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#242424';
  return rgb(
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  );
}
async function annotatePdf(bytes, annotations) {
  if (!Object.values(annotations).some((a) => Array.isArray(a) && a.length)) return bytes;
  const doc = await PDFDocument.load(bytes);
  doc.registerFontkit(fontkit);
  let font;
  for (const [pageNo, items] of Object.entries(annotations)) {
    const index = Number(pageNo) - 1;
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= doc.getPageCount() ||
      !Array.isArray(items)
    )
      continue;
    const page = doc.getPage(index);
    const scale = page.getWidth() / 1000;
    for (const item of items) {
      const ink = color(item.color);
      if (item.kind === 'text') {
        font ||= await doc.embedFont(
          await fs.readFile(path.join(process.env.WINDIR || 'C:/Windows', 'Fonts/segoeui.ttf')),
          {
            subset: true,
          },
        );
        page.drawText(String(item.text), {
          x: item.x * scale,
          y: page.getHeight() - item.y * scale,
          size: (item.width || 18) * scale,
          font,
          color: ink,
        });
      } else if (item.points?.length) {
        const points = item.points;
        let d = points
          .map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2))
          .join(' ');
        if (points.length === 1) d += ' l .01 .01';
        page.drawSvgPath(d, {
          x: 0,
          y: page.getHeight(),
          scale,
          borderWidth: item.width || 2,
          borderColor: ink,
          borderOpacity: item.kind === 'highlighter' ? 0.3 : 1,
        });
      }
    }
  }
  return doc.save();
}
module.exports = { annotatePdf };
