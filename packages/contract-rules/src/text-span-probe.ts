import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

export type TextSpanFixture = {
  fixtureId: string
  edit: { part: string; spanId: string; nextText: string }
  expect: {
    unchangedParts: string[]
    unchangedSpanIds: string[]
    lineCountDelta: number
    repairPrompt: false
  }
}

export type TextSpanReport = {
  fixtureId: string
  wallMs: number
  peakRssBytes: number
  unchangedPartHashesMatch: boolean
  changedParts: string[]
  unchangedSpanIds: string[]
  lineCountDelta: number
  repairPrompt: false
  referenceImage: { status: "unproven"; gate: "X01" }
  partHashes: { before: Record<string, string>; after: Record<string, string> }
}

export async function runTextSpanProbe(fixtureDir: string): Promise<TextSpanReport> {
  const started = performance.now()
  let peakRss = process.memoryUsage().rss
  const sample = () => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss)
  }
  const fixture = JSON.parse(await readFile(path.join(fixtureDir, "fixture.json"), "utf8")) as TextSpanFixture
  const partNames = (await readdir(path.join(fixtureDir, "parts"))).filter((name) => name !== "fixture.json").sort()
  const before = new Map<string, Buffer>()
  for (const name of partNames) {
    before.set(name, await readFile(path.join(fixtureDir, "parts", name)))
    sample()
  }
  const edited = editSpan(before.get(fixture.edit.part), fixture.edit)
  if (!edited) {
    throw new Error("span-not-found")
  }
  const after = new Map(before)
  after.set(fixture.edit.part, edited.bytes)
  sample()
  const beforeHashes = hashParts(before)
  const afterHashes = hashParts(after)
  const changedParts = partNames.filter((name) => beforeHashes[name] !== afterHashes[name])
  const unchangedPartHashesMatch = fixture.expect.unchangedParts.every((name) => beforeHashes[name] === afterHashes[name])
  const unchangedSpanIds = fixture.expect.unchangedSpanIds.filter((spanId) => edited.text.includes(`id="${spanId}"`) && spanText(edited.text, spanId) === spanText(before.get(fixture.edit.part)?.toString("utf8") ?? "", spanId))
  const lineCountDelta = lineCount(edited.text) - lineCount(before.get(fixture.edit.part)?.toString("utf8") ?? "")
  sample()
  return {
    fixtureId: fixture.fixtureId,
    wallMs: performance.now() - started,
    peakRssBytes: peakRss,
    unchangedPartHashesMatch,
    changedParts,
    unchangedSpanIds,
    lineCountDelta,
    repairPrompt: false,
    referenceImage: { status: "unproven", gate: "X01" },
    partHashes: { before: beforeHashes, after: afterHashes },
  }
}

function hashParts(parts: Map<string, Buffer>): Record<string, string> {
  const hashes: Record<string, string> = {}
  for (const [name, bytes] of parts) {
    hashes[name] = createHash("sha256").update(bytes).digest("hex")
  }
  return hashes
}

function editSpan(bytes: Buffer | undefined, edit: TextSpanFixture["edit"]): { bytes: Buffer; text: string } | null {
  if (!bytes) {
    return null
  }
  const text = bytes.toString("utf8")
  const pattern = new RegExp(`(<a:r id="${edit.spanId}"><a:t>)[\\s\\S]*?(</a:t></a:r>)`)
  if (!pattern.test(text)) {
    return null
  }
  const next = text.replace(pattern, `$1${escapeXml(edit.nextText)}$2`)
  return { bytes: Buffer.from(next), text: next }
}

function spanText(xml: string, spanId: string): string {
  const match = new RegExp(`<a:r id="${spanId}"><a:t>([\\s\\S]*?)</a:t></a:r>`).exec(xml)
  return match?.[1] ?? ""
}

function lineCount(xml: string): number {
  const matches = xml.match(/<a:p[ >]/g)
  return matches?.length ?? 0
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}
