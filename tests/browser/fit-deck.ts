import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import type { ResolvedParagraph, ResolvedRun, ResolvedText, Spacing } from "../../packages/document/src/index.ts"

type ZipEntry = {
  readonly filename: string
  readonly directory: boolean
  getData(writer: unknown): Promise<Uint8Array>
}

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly ZipWriter: new (writer: unknown) => {
    add(name: string, reader: unknown): Promise<unknown>
    close(): Promise<Uint8Array>
  }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

export type FitGroup = "plain" | "spacing" | "bullets" | "mixed" | "marks"
export type FitCase = { readonly group: FitGroup; readonly width: number; readonly text: ResolvedText }

const point = 12_700
const height = 500
const perSlide = 40
const fonts = ["Calibri", "Arial", "Times New Roman", "Cambria"]
const words =
  "the of and to a in is that for it as was with be by on not he this are or his from at which but have an had they you were their one all we can her has there been if more when will would who so no out up into than them could time these two may then do first any my now such like our over man me even most made after also did many before must through back years where much your way well down should because each just those people how too little state good very make world still own see men work long get here between both life being under never day same another know while last might us great old year off come since against go came right used take three".split(
    " ",
  )
const marked = [
  "state-of-the-art",
  "and/or",
  "U.S.",
  "(see",
  "page)",
  "“quoted”",
  "it’s",
  "10-20",
  "e.g.,",
  "50%",
  "$1,000",
  "3.14",
  "A/B",
  "Q&A:",
  "well—known",
  "2019–2024",
  "why?",
  "now!",
  "co-op",
  "x y",
  "[draft]",
  "{set}",
  "#1",
  "a+b=c",
  "end.",
]

let seed = 7
function random(): number {
  seed = (seed + 0x6d2b79f5) | 0
  let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
  return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
}
function between(low: number, high: number): number {
  return low + random() * (high - low)
}
function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)]
  if (item === undefined) throw new Error("empty")
  return item
}
function sentence(group: FitGroup): string {
  const count = 2 + Math.floor(random() * 22)
  return Array.from({ length: count }, () => (group === "marks" && random() < 0.35 ? pick(marked) : pick(words))).join(
    " ",
  )
}

function run(text: string, font: string, size: number): ResolvedRun {
  return { text, font, size, bold: random() < 0.3, italic: random() < 0.2, color: null }
}

function spacingOf(size: number): Spacing | null {
  const roll = random()
  if (roll < 0.25) return null
  if (roll < 0.75) return { percent: pick([0.8, 0.9, 1, 1.2, 1.5]) }
  return { points: onGrid(size * between(1, 1.6)) }
}

function gapOf(size: number): Spacing | null {
  const roll = random()
  if (roll < 0.4) return null
  return roll < 0.7 ? { percent: pick([0.2, 0.5, 1]) } : { points: onGrid(size * between(0.2, 1)) }
}

let grid = 1
function onGrid(value: number): number {
  return Math.max(grid, Math.round(value / grid) * grid)
}

function paragraphOf(group: FitGroup, font: string, size: number, number: number): ResolvedParagraph {
  const text = sentence(group)
  let runs: ResolvedRun[] = [run(text, font, size)]
  if (group === "mixed") {
    const pieces = text.split(" ")
    const cuts = 1 + Math.floor(random() * 3)
    runs = []
    for (let part = 0; part <= cuts; part += 1) {
      const slice = pieces.slice(
        Math.floor((part * pieces.length) / (cuts + 1)),
        Math.floor(((part + 1) * pieces.length) / (cuts + 1)),
      )
      if (slice.length === 0) continue
      const piece = (part === 0 ? "" : " ") + slice.join(" ")
      runs.push(run(piece, random() < 0.3 ? pick(fonts) : font, onGrid(size * pick([0.5, 0.75, 1, 1.5]))))
    }
  }
  const first = runs[0] ?? run(text, font, size)
  const spaced = group === "spacing" || group === "bullets"
  const numbered = group === "bullets" && number > 0
  return {
    align: pick(["left", "left", "center", "right"] as const),
    level: 0,
    marginLeft: group === "bullets" ? 342_900 : 0,
    indent: group === "bullets" ? -342_900 : 0,
    lineSpacing: spaced ? spacingOf(size) : null,
    spaceBefore: spaced ? gapOf(size) : null,
    spaceAfter: spaced ? gapOf(size) : null,
    bullet:
      group === "bullets"
        ? numbered
          ? { text: `${number}.`, font: first.font, size: first.size }
          : { text: "•", font: "Arial", size: first.size }
        : null,
    runs,
    end: { font: runs.at(-1)?.font ?? font, size: runs.at(-1)?.size ?? size },
  }
}

export function fitCases(counts: Readonly<Record<FitGroup, number>>, step = 1): readonly FitCase[] {
  seed = 7
  grid = step
  const cases: FitCase[] = []
  for (const [group, count] of Object.entries(counts) as [FitGroup, number][]) {
    for (let at = 0; at < count; at += 1) {
      const font = pick(fonts)
      const size = onGrid(between(12, 44))
      const width = onGrid(between(160, 864))
      const numbered = group === "bullets" && random() < 0.4
      const paragraphs = Array.from({ length: 1 + Math.floor(random() * 7) }, (_, index) =>
        paragraphOf(group, font, size, numbered ? index + 1 : 0),
      )
      cases.push({
        group,
        width,
        text: {
          paragraphs,
          insets: { left: 91_440, top: 45_720, right: 91_440, bottom: 45_720 },
          anchor: "top",
          wrap: true,
          fit: "none",
          fontScale: 1,
          lineReduction: 0,
          vertical: false,
        },
      })
    }
  }
  return cases
}

function escaped(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function spacingXml(name: string, spacing: Spacing | null): string {
  if (spacing === null) return ""
  const inner =
    "percent" in spacing
      ? `<a:spcPct val="${Math.round(spacing.percent * 100_000)}"/>`
      : `<a:spcPts val="${Math.round(spacing.points * 100)}"/>`
  return `<a:${name}>${inner}</a:${name}>`
}

function styleXml(tag: string, run: Pick<ResolvedRun, "font" | "size" | "bold" | "italic">): string {
  return `<a:${tag} lang="en-US" sz="${run.size * 100}" b="${run.bold ? 1 : 0}" i="${run.italic ? 1 : 0}" dirty="0"><a:latin typeface="${escaped(run.font)}"/></a:${tag}>`
}

function paragraphXml(paragraph: ResolvedParagraph): string {
  const align = { left: "l", center: "ctr", right: "r", justify: "just", distributed: "dist" }[paragraph.align]
  const bullet =
    paragraph.bullet === null
      ? "<a:buNone/>"
      : paragraph.bullet.text === "•"
        ? '<a:buFont typeface="Arial"/><a:buChar char="•"/>'
        : '<a:buAutoNum type="arabicPeriod"/>'
  const last = paragraph.runs.at(-1)
  const end = last === undefined ? { ...paragraph.end, bold: false, italic: false } : last
  return `<a:p><a:pPr marL="${paragraph.marginLeft}" indent="${paragraph.indent}" algn="${align}">${spacingXml("lnSpc", paragraph.lineSpacing)}${spacingXml("spcBef", paragraph.spaceBefore)}${spacingXml("spcAft", paragraph.spaceAfter)}${bullet}</a:pPr>${paragraph.runs
    .map((run) => `<a:r>${styleXml("rPr", run)}<a:t>${escaped(run.text)}</a:t></a:r>`)
    .join("")}${styleXml("endParaRPr", end)}</a:p>`
}

function boxXml(shape: number, item: FitCase): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${shape}" name="Case ${shape}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="609600" y="254000"/><a:ext cx="${item.width * point}" cy="${height * point}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>${item.text.paragraphs.map(paragraphXml).join("")}</p:txBody></p:sp>`
}

const ns =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const group =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
const slideType = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"
const relType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

export type PlacedCase = FitCase & { readonly key: string; readonly slide: number }

export function placeCases(cases: readonly FitCase[]): readonly PlacedCase[] {
  return cases.map((item, index) => {
    const slide = Math.floor(index / perSlide) + 1
    return { ...item, slide, key: `ppt/slides/slide${slide}.xml#${(index % perSlide) + 2}` }
  })
}

export async function fitDeck(placed: readonly PlacedCase[]): Promise<Buffer> {
  const slides = Math.max(...placed.map((item) => item.slide))
  const parts = new Map<string, string>()
  for (let slide = 1; slide <= slides; slide += 1) {
    const boxes = placed
      .filter((item) => item.slide === slide)
      .map((item) => boxXml(Number(item.key.split("#")[1]), item))
    parts.set(
      `ppt/slides/slide${slide}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${ns}><p:cSld><p:spTree>${group}${boxes.join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
    )
    parts.set(
      `ppt/slides/_rels/slide${slide}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relType}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`,
    )
  }
  const numbers = Array.from({ length: slides }, (_, at) => at + 1)
  const reader = new zip.ZipReader(
    new zip.Uint8ArrayReader(new Uint8Array(await readFile(join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")))),
  )
  const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter())
  for (const entry of await reader.getEntries()) {
    if (entry.directory || parts.has(entry.filename)) continue
    let text = new TextDecoder().decode(await entry.getData(new zip.Uint8ArrayWriter()))
    if (entry.filename === "[Content_Types].xml")
      text = text.replace(
        /<Override PartName="\/ppt\/slides\/slide1.xml"[^>]*\/>/,
        numbers.map((n) => `<Override PartName="/ppt/slides/slide${n}.xml" ContentType="${slideType}"/>`).join(""),
      )
    if (entry.filename === "ppt/presentation.xml")
      text = text.replace(
        /<p:sldIdLst>[\s\S]*<\/p:sldIdLst>/,
        `<p:sldIdLst>${numbers.map((n) => `<p:sldId id="${255 + n}" r:id="rIdSlide${n}"/>`).join("")}</p:sldIdLst>`,
      )
    if (entry.filename === "ppt/_rels/presentation.xml.rels")
      text = text.replace(
        /<Relationship Id="rId2"[^>]*\/>/,
        numbers
          .map((n) => `<Relationship Id="rIdSlide${n}" Type="${relType}/slide" Target="slides/slide${n}.xml"/>`)
          .join(""),
      )
    await writer.add(entry.filename, new zip.Uint8ArrayReader(new TextEncoder().encode(text)))
  }
  for (const [name, text] of parts) await writer.add(name, new zip.Uint8ArrayReader(new TextEncoder().encode(text)))
  await reader.close()
  return Buffer.from(await writer.close())
}
