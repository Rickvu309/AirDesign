import {expect, it} from "vitest"
import {execFile} from "node:child_process"
import {promisify} from "node:util"
import {mkdtemp, readFile, writeFile, rm, copyFile, mkdir} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {fixtureDeck} from "../../../packages/deck/src/fixture.ts"
import {initialHistory} from "../../../packages/change-log/src/index.ts"
import {transduceLegacyHistory} from "../../../packages/change-log/src/text/history-transducer.ts"
import {importPptx} from "../../../packages/pptx/src/index.ts"
import {importedNativeDeck} from "../../../packages/pptx/src/import-deck.ts"

it("executes frozen legacy and native export jobs through the actual worker entry", async () => {
  const directory = await mkdtemp(path.join(os.homedir(), "tmp/paragraph-export-"))
  const deck = fixtureDeck(1, 2), native = transduceLegacyHistory({version: 2, history: initialHistory(deck), immutable: {version: 2, events: [], receipts: []}}).history.deck
  const text = native.slides[0]!.elements[0]!
  if (text.kind !== "text") throw new Error("text-required")
  text.body.frame.anchor = "bottom"
  text.body.frame.insets = {top: 8, right: 12, bottom: 16, left: 20}
  text.body.paragraphs[0].alignment = "right"
  text.body.paragraphs[0].marker = {kind: "number", format: "decimal", start: 3}
  const execute = promisify(execFile)
  try {
    for (const frozen of [{snapshotVersion: 2, deck}, {snapshotVersion: 3, deck: native}]) for (const format of ["pptx", "pdf"]) {
      await writeFile(path.join(directory, "input.json"), JSON.stringify({snapshotVersion: frozen.snapshotVersion, snapshot: {deck: frozen.deck, seq: 3, title: "Frozen paragraphs", source: null}, options: {format, slides: ["s0"], allowIssues: true}}))
      await execute(process.execPath, [path.resolve("apps/worker/src/export/entry.ts")], {env: {...process.env, AIRDESIGN_JOB_DIRECTORY: directory}, timeout: 30000, maxBuffer: 8192})
      const bytes = await readFile(path.join(directory, "result.bin"))
      if (format === "pdf") expect(bytes.subarray(0, 5).toString()).toBe("%PDF-")
      else {
        const presentation = await importPptx(bytes)
        expect(importedNativeDeck(presentation).slides).toHaveLength(1)
        expect(JSON.parse(presentation.parts.get("airdesign/saved-version.json")!.toString())).toMatchObject({version: frozen.snapshotVersion, seq: 3})
        if (frozen.snapshotVersion === 3) expect(importedNativeDeck(presentation).slides[0]!.elements[0]).toMatchObject({body: {frame: {anchor: "bottom", insets: text.body.frame.insets}, paragraphs: [{alignment: "right", marker: {kind: "number", start: 3}}]}})
      }
      if (frozen.snapshotVersion === 3 && process.env.AIRDESIGN_PARAGRAPH_ARTIFACTS) {
        await mkdir(process.env.AIRDESIGN_PARAGRAPH_ARTIFACTS, {recursive: true})
        await copyFile(path.join(directory, "result.bin"), path.join(process.env.AIRDESIGN_PARAGRAPH_ARTIFACTS, `native-worker.${format}`))
      }
    }
  } finally {await rm(directory, {recursive: true, force: true})}
}, 90000)
