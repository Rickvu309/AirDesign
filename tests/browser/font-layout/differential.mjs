import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { fixtureBytes, manifest } from "./fixture-faces.mjs"
import { corpus, historical, systemFaceReasons } from "./cases.mjs"
import { Faces, hbVersion, historicalWidth, lineWidth, plan, wrap } from "./reference-shape.mjs"

const readFixture = (name) => readFile(new URL(name, import.meta.url))
const readJson = async (name) => JSON.parse(await readFixture(name))
const base = "https://font-layout.test"
const tolerance = 0.5
const referenceWidthTolerance = 1e-4
const webRequire = createRequire(new URL("../../../apps/web/package.json", import.meta.url))
const historicInter = "@fontsource-variable/inter"
const historicInterPath = "/historic-inter/"

function probeWidths(layout, icu, faces) {
  const widths = new Set([65, 110, 155, 205, 270, 390])
  const paragraphs = []
  let offset = 0
  for (const paragraph of layout.text.split("\n")) {
    const end = offset + paragraph.length
    const breaks = icu
      .lines(paragraph, layout.lang)
      .slice(1)
      .map((pos) => offset + pos)
    paragraphs.push({ offset, end, breaks })
    offset = end + 1
  }

  function addThresholds(start, { end, breaks }) {
    for (const next of breaks) {
      if (next <= start) continue
      const width = lineWidth(layout, start, next, faces, { softHyphen: next < end })
      if (width > tolerance) {
        widths.add(width - tolerance)
        widths.add(width + tolerance)
      }
    }
  }

  for (const paragraph of paragraphs) addThresholds(paragraph.offset, paragraph)
  const laterStarts = new Map(
    paragraphs.flatMap((paragraph) =>
      paragraph.breaks.filter((start) => start < paragraph.end).map((start) => [start, paragraph]),
    ),
  )
  for (const width of widths) {
    for (const { start } of wrap(layout, faces, width, icu.lines)) {
      const paragraph = laterStarts.get(start)
      if (!paragraph) continue
      laterStarts.delete(start)
      addThresholds(start, paragraph)
    }
  }
  return [...widths]
}

const lineEnds = (rows) => rows.map(({ start, end }) => `${start}-${end}`).join("|")
const sameEnds = (left, right) => lineEnds(left) === lineEnds(right)
const diff = (rows, widths) => Math.max(0, ...rows.map(({ width }, at) => Math.abs(width - widths[at])))

export const snapshotProbe = ({ width, expected, actual }) => {
  const overflows = (rows) => rows.some((row) => row.width > width + 1 / 64)
  const impact = [
    ...(expected.length !== actual.length ? ["line-count"] : []),
    ...(overflows(expected) !== overflows(actual) ? ["overflow"] : []),
  ]
  return [Number(width.toFixed(6)), lineEnds(expected), lineEnds(actual), ...impact]
}

export async function compareLayout(page, icu, revision) {
  const baseline = await readJson("./parity.json")
  const lineBaseline = await readJson("./line-ends.json")
  const files = new Map(
    await Promise.all(Object.entries(manifest).map(async ([id, face]) => [id, await fixtureBytes(face)])),
  )
  const faces = new Faces()
  for (const [id, bytes] of files) faces.load(id, bytes, manifest[id].weight)
  const browserScript = await readFixture("./chromium.mjs")
  const externalRequests = []
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== base) {
      externalRequests.push(url.href)
      return route.abort()
    }
    const path = url.pathname
    if (path === "/") return route.fulfill({ contentType: "text/html", body: "<!doctype html><meta charset=utf-8>" })
    if (path === "/chromium.mjs") return route.fulfill({ contentType: "application/javascript", body: browserScript })
    if (path === historicInterPath + "index.css")
      return route.fulfill({
        contentType: "text/css",
        body: await readFile(webRequire.resolve(historicInter)),
      })
    const subset = path.match(/^\/historic-inter\/files\/(inter-[a-z-]+-wght-normal\.woff2)$/)?.[1]
    if (subset)
      return route.fulfill({
        contentType: "font/woff2",
        body: await readFile(webRequire.resolve(historicInter + "/files/" + subset)),
      })
    const bytes = files.get(path.match(/^\/faces\/(\w+)\.ttf$/)?.[1])
    if (bytes) return route.fulfill({ contentType: "font/ttf", body: bytes })
    await route.abort()
  })
  await page.goto(base)
  await page.addStyleTag({ url: base + historicInterPath + "index.css" })
  await page.evaluate(
    async ({ url, manifest, legacyText }) => {
      window.fontOracle = await import(url)
      await window.fontOracle.loadNative(manifest)
      await document.fonts.load('400 32px "Inter Variable"', legacyText)
    },
    {
      url: base + "/chromium.mjs",
      manifest,
      legacyText: corpus
        .flatMap(({ runs }) => runs.filter((run) => run.legacyCanvasFaces).map(({ text }) => text))
        .join(""),
    },
  )

  const cdp = await page.context().newCDPSession(page)
  await cdp.send("DOM.enable")
  await cdp.send("CSS.enable")
  async function fontsAt(selector) {
    const { root } = await cdp.send("DOM.getDocument")
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector })
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId })
    return fonts
  }

  const failures = []
  const records = []
  const pinnedIds = Object.keys(lineBaseline.cases)
  if (pinnedIds.length !== corpus.length || corpus.some(({ id }) => !Object.hasOwn(lineBaseline.cases, id)))
    failures.push("Line-end baseline and corpus have different case IDs")
  if (hbVersion !== revision.harfBuzz) failures.push(`HarfBuzz version ${hbVersion}`)
  for (const item of corpus) {
    const old = historical[item.id]
    const expected = baseline.records.find(({ id }) => id === item.id)
    const pinned = lineBaseline.cases[item.id]
    const layout = plan(item.runs, item.lang, faces, icu.graphemes)
    const widths = probeWidths(layout, icu, faces)
    const shared = widths.map((width) => wrap(layout, faces, width, icu.lines))
    const native = await page.evaluate(
      ({ item, widths, paint, canvasPair }) => {
        const oracle = window.fontOracle
        document.body.replaceChildren()
        const wraps = oracle.wrapped(item, widths)
        const text = item.runs.map(({ text }) => text).join("")
        const assigned = wraps.map((rows) =>
          oracle.fullLines(
            item,
            rows.map((row) => ({
              ...row,
              softHyphen: row.end < text.length && text[row.end - 1] === "\u00ad",
            })),
            paint,
          ),
        )
        return {
          widths: wraps,
          legacy: canvasPair ? oracle.pairwiseCanvas(item) : undefined,
          assigned,
          advance: oracle.full(item, undefined, "native"),
          assignedAdvance: oracle.full(item, paint, "assigned"),
        }
      },
      { item, widths, paint: layout.paint, canvasPair: old?.model === "canvas" || old?.browserLegacy !== undefined },
    )
    const nativeFonts = await fontsAt("#native")
    const assignedFonts = await fontsAt("#assigned")
    const nativeSystemFaces = nativeFonts
      .filter(({ isCustomFont }) => !isCustomFont)
      .map(({ postScriptName }) => postScriptName)
      .sort()
      .join("|")
    const variant = pinned?.nativeVariants?.[nativeSystemFaces]
    if (pinned?.nativeVariants && nativeSystemFaces && !variant)
      failures.push(`${item.id}: unpinned native faces ${nativeSystemFaces}`)
    const pinnedProbes = variant?.probes ?? pinned?.probes
    const category = variant?.category ?? pinned?.category
    const fallback = [...nativeFonts, ...assignedFonts].filter(({ isCustomFont }) => !isCustomFont)
    const systemReason = systemFaceReasons[item.id]
    if (fallback.length && !systemReason) failures.push(`${item.id}: unexplained OS face ${JSON.stringify(fallback)}`)

    const lines = wrap(layout, faces, Infinity, icu.lines)
    const advance = Math.max(...lines.map(({ width }) => width))
    const probes = widths.map((width, at) => {
      const css = native.widths[at]
      const model = css.map((row) => ({
        ...row,
        width: lineWidth(layout, row.start, row.end, faces, {
          softHyphen: row.end < layout.text.length && layout.text[row.end - 1] === "\u00ad",
        }),
      }))
      return {
        width,
        expected: shared[at],
        actual: css,
        agrees: sameEnds(shared[at], css),
        assignedWidthError: diff(model, native.assigned[at]),
      }
    })
    const snapshots = probes.map(snapshotProbe)
    if (pinnedProbes?.length !== snapshots.length) {
      failures.push(`${item.id}: expected ${pinnedProbes?.length ?? 0} probes, got ${snapshots.length}`)
    } else {
      const changed = snapshots.findIndex((probe, at) => JSON.stringify(probe) !== JSON.stringify(pinnedProbes[at]))
      if (changed !== -1)
        failures.push(
          `${item.id}: probe ${changed + 1} changed from ${JSON.stringify(pinnedProbes[changed])} to ${JSON.stringify(snapshots[changed])}`,
        )
    }
    const hasDifferences = probes.some(({ agrees }) => !agrees)
    if (hasDifferences !== Object.hasOwn(lineBaseline.policies, category))
      failures.push(`${item.id}: expected a category policy for each case with line-end differences`)
    const error = Math.max(
      Math.abs(advance - native.assignedAdvance),
      ...probes.map((probe) => probe.assignedWidthError),
    )
    const pinnedAdvance = expected?.w ?? pinned?.advance
    if (pinnedAdvance === undefined || Math.abs(advance - pinnedAdvance) > referenceWidthTolerance)
      failures.push(`${item.id}: prototype width changed to ${advance}`)
    if (!layout.missing.length && !assignedFonts.some(({ isCustomFont }) => !isCustomFont) && error > tolerance)
      failures.push(`${item.id}: assigned width differs by ${error} px`)

    const legacy =
      old?.model === "canvas" ? native.legacy : old && historicalWidth(item, faces, old.model, icu.graphemes)
    if (
      old &&
      (Math.abs(legacy - old.legacy) > tolerance ||
        (old.native !== undefined && Math.abs(native.advance - old.native) > tolerance))
    )
      failures.push(`${item.id}: PR 1625 widths differ from evidence: legacy ${legacy}, native ${native.advance}`)
    if (old?.browserLegacy !== undefined && Math.abs(native.legacy - old.browserLegacy) > tolerance)
      failures.push(`${item.id}: legacy browser width ${native.legacy} differs from ${old.browserLegacy}`)
    records.push({
      id: item.id,
      category,
      advance,
      nativeAdvance: native.advance,
      assignedAdvance: native.assignedAdvance,
      legacy,
      browserLegacy: old?.browserLegacy === undefined ? undefined : native.legacy,
      nativeFonts,
      assignedFonts,
      systemReason,
      missing: layout.missing,
      assignedWidthError: error,
      probes,
    })
  }
  await cdp.detach()
  if (externalRequests.length) failures.push(`External browser requests: ${externalRequests.join("\n")}`)
  return { chromium: page.context().browser()?.version(), revision, externalRequests, failures, records }
}
