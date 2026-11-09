import {id} from "../../deck/src/model.ts"
import {fixtureDeck} from "../../deck/src/fixture.ts"
import {commandId, initialHistory, projectHistory} from "../../change-log/src/index.ts"
import {executeNative, nativeHistoryModel} from "../../change-log/src/text/native-model.ts"
import {transduceLegacyHistory} from "../../change-log/src/text/history-transducer.ts"
import {importPptx} from "../../pptx/src/index.ts"
import {writeNativeSavedPptx} from "../../pptx/src/export-deck.ts"
import {importedNativeDeck} from "../../pptx/src/import-deck.ts"
import {expect, it} from "vitest"
import {build} from "vite"
import {chromium} from "playwright"
import {readFile, writeFile} from "node:fs/promises"
import {fitFixture} from "../../deck/test/text/fit-fixture.ts"
import type * as NativeFit from "../src/text/measured-fit.tsx"

declare global {interface Window {NativeFit: typeof NativeFit}}

it("fits loaded-font native text using shared line geometry with bounded stable shrink and resize", async () => {
  const bundle = await build({configFile: false, define: {"process.env.NODE_ENV": '"development"'}, logLevel: "silent", cacheDir: process.env.TMPDIR, build: {write: false, minify: false, lib: {entry: "packages/render/src/text/measured-fit.tsx", name: "NativeFit", formats: ["iife"]}}})
  const built = Array.isArray(bundle) ? bundle[0] : bundle
  if (!built || !("output" in built)) throw new Error("fit-bundle-required")
  const code = built.output.find(chunk => chunk.type === "chunk")
  if (code?.type !== "chunk") throw new Error("fit-code-required")
  const font = await readFile(new URL("../../ui/fonts/geist-latin-400.woff2", import.meta.url))
  const browser = await chromium.launch({args: ["--no-sandbox"]})
  try {
    const page = await browser.newPage({offline: true})
    await page.setContent(`<style>@font-face{font-family:Geist;src:url(data:font/woff2;base64,${font.toString("base64")})}body{margin:0}</style>`)
    await page.addScriptTag({content: `${code.code}\nwindow.NativeFit = NativeFit;`})
    const text = fitFixture()
    text.box = {x: 20, y: 20, width: 240, height: 90}
    const paragraph = text.body.paragraphs[0]
    paragraph.endStyle = {...paragraph.endStyle, font: "Geist", size: 28, bold: false}
    paragraph.runs = [{kind: "text", text: "Invisible words still occupy native lines and wrap", style: {...paragraph.endStyle, color: null}}, {kind: "break", style: {...paragraph.endStyle, size: 34}}, {kind: "text", text: "Final visible line", style: paragraph.endStyle}]
    paragraph.marker = {kind: "number", start: 3, format: "decimal"}
    text.body.paragraphs.push({...structuredClone(paragraph), id: id("fit-empty"), runs: []})
    const receipts = await page.evaluate(async text => {
      const {measureNativeText, prepareNativeTextEdit} = window.NativeFit
      const receipts = []
      for (const verticalFlow of ["horizontal", "vertical270"] as const) for (const wrap of ["square", "none"] as const) for (const kind of ["shrink", "resize-shape"] as const) {
        const previous = structuredClone(text), next = structuredClone(text)
        next.body.frame.autofit = kind === "shrink" ? {kind, fontScale: null, lineReduction: null} : {kind}
        next.body.frame.wrap = wrap
        next.body.frame.verticalFlow = verticalFlow
        next.body.frame.insets = {top: 4, right: 6, bottom: 8, left: 24}
        const before = await measureNativeText(next)
        let calls = 0
        const trace: unknown[] = []
        const result = await prepareNativeTextEdit(previous, next, async candidate => {calls++; const size = await measureNativeText(candidate); trace.push({box: candidate.box, size}); return size}).catch(error => {throw new Error(JSON.stringify({kind, wrap, verticalFlow, trace, error: String(error)}))})
        const change = result.changes[0]
        if (change?.kind !== "set" || !("kind" in change.value) || change.value.kind !== "text") throw new Error("fit-text-required")
        const fitted = change.value, after = await measureNativeText(fitted)
        const repeated = await prepareNativeTextEdit(fitted, structuredClone(fitted), async () => {throw new Error("repeat-measured")})
        receipts.push({kind, wrap, verticalFlow, before, after, fitted, calls, stable: JSON.stringify(result) === JSON.stringify(repeated), loaded: document.fonts.check("28px Geist")})
      }
      return receipts
    }, text)
    for (const receipt of receipts) {
      expect(receipt.loaded).toBe(true)
      expect(receipt.before.height > text.box.height || receipt.before.width > text.box.width).toBe(true)
      expect(receipt.after.height).toBeLessThanOrEqual(receipt.fitted.box.height)
      expect(receipt.after.width).toBeLessThanOrEqual(receipt.fitted.box.width)
      expect(receipt.calls).toBeLessThanOrEqual(21)
      expect(receipt.stable).toBe(true)
      const original = transduceLegacyHistory({version: 2, history: initialHistory(fixtureDeck(1, 1)), immutable: {version: 2, events: [], receipts: []}}).history
      const accepted = executeNative(original, {id: commandId("browser-fit"), kind: "edit", base: original.seq, run: null, changes: {changes: [{kind: "set", target: receipt.fitted.id, value: receipt.fitted}]}})
      expect(accepted.receipt.kind).toBe("applied")
      const reopened = JSON.parse(JSON.stringify(accepted.history))
      expect(projectHistory(reopened, nativeHistoryModel)).toEqual(accepted.history.deck)
      const saved = await writeNativeSavedPptx(accepted.history.deck, accepted.history.seq, null, {})
      const imported = importedNativeDeck(await importPptx(saved)).slides[0]?.elements[0]
      if (imported?.kind !== "text") throw new Error("saved-fit-text-required")
      expect(imported.body.frame.autofit).toEqual(receipt.fitted.body.frame.autofit)
      expect(imported.box).toEqual(receipt.fitted.box)

    }
    const artifacts = process.env.AIRDESIGN_PARAGRAPH_ARTIFACTS
    if (artifacts) await writeFile(`${artifacts}/measured-fit-geometry.json`, JSON.stringify(receipts, null, 2))
  } finally {await browser.close()}
}, 60000)
