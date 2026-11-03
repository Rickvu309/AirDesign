import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { SaxesParser } from 'saxes';

const root = fileURLToPath(new URL('.', import.meta.url));
const out = `${root}output/`;
await mkdir(out, { recursive: true });
const timings: Record<string, number> = {};
async function timed<T>(name: string, task: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await task();
  timings[name] = Number((performance.now() - start).toFixed(3));
  return result;
}
function hash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
const pns = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const ans = 'http://schemas.openxmlformats.org/drawingml/2006/main';
type Run = { text: string; start: number; end: number };
type Shape = { kind: 'text'; id: string; name: string; runs: Run[] };
function parseSlide(xml: string): Shape[] {
  assert(Buffer.byteLength(xml) <= 8 * 1024 * 1024, 'XML size budget');
  const parser = new SaxesParser({ xmlns: true });
  const shapes: Shape[] = [];
  let shape: Shape | undefined;
  let run: { text: string; start: number } | undefined;
  let depth = 0;
  parser.on('doctype', () => { throw new Error('DTD forbidden'); });
  parser.on('error', error => { throw error; });
  parser.on('opentag', tag => {
    assert(++depth <= 128, 'XML depth budget');
    if (tag.uri === pns && tag.local === 'sp') {
      assert(!shape, 'Nested shape unsupported in probe');
      shape = { kind: 'text', id: '', name: '', runs: [] };
    }
    if (shape && tag.uri === pns && tag.local === 'cNvPr') {
      shape.id = tag.attributes.id?.value ?? '';
      shape.name = tag.attributes.name?.value ?? '';
    }
    if (shape && tag.uri === ans && tag.local === 't') {
      assert(!tag.isSelfClosing, 'Empty run unsupported in probe');
      run = { text: '', start: parser.position };
    }
  });
  parser.on('text', text => { if (run) run.text += text; });
  parser.on('cdata', text => { if (run) run.text += text; });
  parser.on('closetag', tag => {
    if (run && shape && tag.uri === ans && tag.local === 't') {
      shape.runs.push({ ...run, end: parser.position - tag.name.length - 3 });
      run = undefined;
    }
    if (tag.uri === pns && tag.local === 'sp' && shape) {
      assert(shape.id, 'Shape ID required');
      shapes.push(shape);
      shape = undefined;
    }
    depth--;
  });
  parser.write(xml).close();
  return shapes;
}
function escapeText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
async function required(zip: JSZip, name: string): Promise<Buffer> {
  const part = zip.file(name);
  assert(part, `Missing ${name}`);
  return part.async('nodebuffer');
}
const slideName = 'ppt/slides/slide1.xml';
await timed('generateFixtureMs', async () => {
  const deck = new PptxGenJS();
  deck.layout = 'LAYOUT_WIDE';
  deck.author = 'AirDesign research';
  deck.defineSlideMaster({ title: 'BASE', background: { color: 'F4F1EA' }, objects: [] });
  const slide = deck.addSlide({ masterName: 'BASE' });
  slide.addText([
    { text: 'Before 🧪 & fidelity', options: { bold: true } },
    { text: ' | second run stays exact', options: { italic: true } },
  ], { x: 1, y: 1, w: 11, h: 1, fontFace: 'Arial', fontSize: 32 });
  slide.addText('Untouched sibling shape', { x: 1, y: 3, w: 10, h: 1, fontSize: 24 });
  deck.addSlide({ masterName: 'BASE' }).addText('Untouched second slide', { x: 1, y: 1, w: 10, h: 1 });
  await deck.writeFile({ fileName: `${out}before.pptx`, compression: true });
});
const input = await readFile(`${out}before.pptx`);
const zip = await timed('unzipMs', () => JSZip.loadAsync(input, { checkCRC32: true }));
const xml = (await required(zip, slideName)).toString('utf8');
const shapes = await timed('parseMs', async () => parseSlide(xml));
await writeFile(`${out}shapes.json`, JSON.stringify(shapes, null, 2));
const target = shapes[0]?.runs[0];
assert(target);
assert.equal(target.text, 'Before 🧪 & fidelity');
assert.equal(xml.slice(target.start, target.end), escapeText(target.text));
const replacement = 'After 🧪 <fidelity> & verified';
const patched = await timed('patchMs', async () => {
  const value = xml.slice(0, target.start) + escapeText(replacement) + xml.slice(target.end);
  const next = parseSlide(value);
  assert.equal(next[0]?.runs[0]?.text, replacement);
  assert.deepEqual(next.map(s => s.runs.map(r => r.text)).slice(1), shapes.map(s => s.runs.map(r => r.text)).slice(1));
  assert.equal(next[0]?.runs[1]?.text, shapes[0]?.runs[1]?.text);
  assert.equal(value.slice(0, target.start), xml.slice(0, target.start));
  assert.equal(value.slice(target.start + escapeText(replacement).length), xml.slice(target.end));
  return value;
});
zip.file(slideName, patched);
const output = await timed('rezipMs', () => zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
await writeFile(`${out}after.pptx`, output);
const audit = await timed('verifyAllPartsMs', async () => {
  const before = await JSZip.loadAsync(await readFile(`${out}before.pptx`), { checkCRC32: true });
  const after = await JSZip.loadAsync(await readFile(`${out}after.pptx`), { checkCRC32: true });
  const names = Object.values(before.files).filter(p => !p.dir).map(p => p.name).sort();
  assert.deepEqual(Object.values(after.files).filter(p => !p.dir).map(p => p.name).sort(), names);
  const rows = [];
  for (const name of names) {
    const a = await required(before, name);
    const b = await required(after, name);
    const identical = a.equals(b);
    assert.equal(identical, name !== slideName, `Unexpected change in ${name}`);
    rows.push({ name, before: hash(a), after: hash(b), identical });
  }
  assert.equal((await required(after, slideName)).toString('utf8'), patched);
  return rows;
});
const securityCases = [
  '<!DOCTYPE x [<!ENTITY xxe SYSTEM "file:///must-not-read">]><x>&xxe;</x>',
  '<!DOCTYPE x [<!ENTITY a "ha"><!ENTITY b "&a;&a;">]><x>&b;</x>',
  '<x>'.repeat(129) + '</x>'.repeat(129),
  '<x>&undeclared;</x>',
];
for (const input of securityCases) assert.throws(() => parseSlide(input));
const lo = spawnSync('soffice', ['--version'], { encoding: 'utf8', env: { ...process.env, TMPDIR: `${root}.tmp` }, timeout: 5000 });
const report = {
  status: 'PASS',
  scope: 'Self-generated fixture only; exact uncompressed package-part bytes, not ZIP headers or full archive; no PowerPoint open/save claim',
  inputBytes: input.length,
  outputBytes: output.length,
  totalParts: audit.length,
  identicalOtherParts: audit.filter(r => r.identical).length,
  changedParts: audit.filter(r => !r.identical).map(r => r.name),
  otherSlideXmlBytesIdentical: true,
  allBytesOutsideTargetTextInChangedSlideIdentical: true,
  securityRejectionCases: securityCases.length,
  timings,
  render: { status: 'SKIPPED', reason: lo.status === 0 ? 'LibreOffice detected; render not implemented in probe' : (lo.stderr.trim() || lo.error?.message || 'LibreOffice unavailable'), pixelDiff: null },
};
await writeFile(`${out}hashes.json`, JSON.stringify(audit, null, 2));
await writeFile(`${out}report.json`, JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
