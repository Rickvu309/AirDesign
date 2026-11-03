import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const start = performance.now();
const width = 1280;
const height = 720;
const text = (id, value, x, y, w, h, size = 32, color = '#172b32', weight = 400) => ({ id, value, x, y, w, h, size, color, weight });
const fixtures = [
  { id: 'good-editorial', expected: true, bg: '#f6f3eb', elements: [
    text('eyebrow', 'FIELD NOTES / 2026', 64, 64, 800, 32, 18),
    text('title', 'Make room for better work', 64, 144, 1120, 96, 64, '#172b32', 700),
    text('body', 'A focused workspace gives each idea the attention it needs.', 64, 304, 800, 112, 36),
    text('footer', 'Fewer distractions. Clearer decisions.', 64, 600, 1000, 48, 24)
  ] },
  { id: 'good-data', expected: true, bg: '#102d32', elements: [
    text('title', 'More teams return each month', 64, 64, 1120, 80, 48, '#ffffff', 700),
    text('metric', '72%', 64, 216, 480, 160, 120, '#b9f0d5', 700),
    text('label', 'Monthly active teams', 64, 400, 480, 64, 28, '#ffffff'),
    text('explanation', 'Retention rose 12 points after simplifying the first project.', 640, 240, 560, 200, 36, '#ffffff'),
    text('source', 'Illustrative data / September 2026', 64, 624, 1000, 40, 18, '#ffffff')
  ] },
  { id: 'bad-overflow', expected: false, bg: '#f6f3eb', elements: [
    text('title', 'Quarterly update', 64, 64, 1000, 80, 48),
    text('body', 'Important findings need enough room to be read. '.repeat(16), 64, 216, 480, 64, 36),
    text('outside', 'Off the canvas', 1160, 600, 400, 64, 32)
  ] },
  { id: 'bad-contrast', expected: false, bg: '#ffffff', elements: [
    text('title', 'This message fades away', 64, 64, 1120, 96, 56, '#dddddd', 700),
    text('body', 'Small text needs stronger contrast.', 64, 240, 1000, 64, 18, '#aaaaaa')
  ] },
  { id: 'bad-overlap-grid', expected: false, bg: '#f6f3eb', elements: [
    text('title', 'A crowded story', 67, 67, 1000, 96, 56),
    text('first', 'Two messages', 67, 243, 640, 96, 48),
    text('second', 'Compete for attention', 251, 267, 800, 96, 48)
  ] }
];

const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const render = slide => `<!doctype html><html><head><meta charset="utf-8"><title>${slide.id}</title><style>*{box-sizing:border-box}body{margin:0}main{position:relative;width:${width}px;height:${height}px;background:${slide.bg};overflow:hidden}.text{position:absolute;font-family:Arial,sans-serif;line-height:1.12;overflow:hidden;white-space:normal;overflow-wrap:break-word}</style></head><body><main>${slide.elements.map(e => `<div data-id="${e.id}" class="text" style="left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;font-size:${e.size}px;font-weight:${e.weight};color:${e.color}">${escapeHtml(e.value)}</div>`).join('')}</main></body></html>`;

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const results = [];
try {
  for (const fixture of fixtures) {
    const html = render(fixture);
    await writeFile(`artifacts/${fixture.id}.html`, html);
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate(({ width, height }) => {
      const luminance = rgb => rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const bg = luminance(rgb(getComputedStyle(document.querySelector('main')).backgroundColor));
      const elements = [...document.querySelectorAll('.text')].map(el => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const range = document.createRange();
        range.selectNodeContents(el);
        const glyphs = range.getBoundingClientRect();
        const fg = luminance(rgb(style.color));
        const contrast = (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
        const fontSize = parseFloat(style.fontSize);
        const large = fontSize >= 24 || (fontSize >= 18.6667 && parseInt(style.fontWeight, 10) >= 700);
        const residual = coordinate => Math.min(coordinate % 8, 8 - coordinate % 8);
        return {
          id: el.dataset.id, x: rect.x, y: rect.y, w: rect.width, h: rect.height,
          overflow: glyphs.bottom > rect.bottom + 1 || glyphs.right > rect.right + 1 || el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1,
          outside: rect.left < -1 || rect.top < -1 || rect.right > width + 1 || rect.bottom > height + 1,
          contrast: Number(contrast.toFixed(3)), contrastFail: contrast < (large ? 3 : 4.5),
          gridResidual: residual(rect.x) + residual(rect.y)
        };
      });
      const overlaps = [];
      for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
          const a = elements[i];
          const b = elements[j];
          const area = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
          if (area > 1) overlaps.push({ ids: [a.id, b.id], area });
        }
      }
      const overflow = elements.filter(e => e.overflow).length;
      const outside = elements.filter(e => e.outside).length;
      const contrastFailures = elements.filter(e => e.contrastFail).length;
      const gridAlignedPercent = 100 * elements.filter(e => e.gridResidual <= 2).length / elements.length;
      return { overflow, outside, contrastFailures, overlapPairs: overlaps.length, minContrast: Math.min(...elements.map(e => e.contrast)), gridAlignedPercent, hardPass: overflow + outside + contrastFailures + overlaps.length === 0, elements, overlaps };
    }, { width, height });
    await page.screenshot({ path: `artifacts/${fixture.id}.png` });
    results.push({ id: fixture.id, expectedHardPass: fixture.expected, ...result });
  }
} finally {
  await browser.close();
}
console.table(results.map(({ id, hardPass, overflow, outside, contrastFailures, overlapPairs, minContrast, gridAlignedPercent }) => ({ id, hardPass, overflow, outside, contrastFailures, overlapPairs, minContrast, gridAlignedPercent })));
const separationPass = results.every(result => result.hardPass === result.expectedHardPass);
const elapsedSeconds = Number(((performance.now() - start) / 1000).toFixed(3));
await writeFile('artifacts/results.json', JSON.stringify({ elapsedSeconds, separationPass, results }, null, 2));
console.log(JSON.stringify({ separationPass, elapsedSeconds, paidApiCalls: 0 }));
if (!separationPass) process.exitCode = 1;
