import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { freshBrowserExport, playwrightFailureLines } from "./browser-export.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "browser-export-"))
const file = path.join(dir, "exported-deck.pptx")
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }))

const planted = fs.readFileSync(path.join(root, "scripts/pptx-fixtures/text.pptx"))
fs.writeFileSync(file, planted)
let during = "unread"
const fresh = Buffer.from("fresh-export")
const replaced = await freshBrowserExport({
  file,
  run: async () => {
    during = fs.existsSync(file) ? "present" : "gone"
    fs.writeFileSync(file, fresh)
  },
})
if (during !== "gone") throw new Error("V5 judged the planted text.pptx")
if (!replaced.ok) throw new Error("V5 rejected the replacement export")
if (!fs.readFileSync(file).equals(fresh)) throw new Error("V5 kept the planted text.pptx")

fs.writeFileSync(file, Buffer.from("old good export"))
let seen = "unread"
const missing = await freshBrowserExport({
  file,
  run: async () => {
    seen = fs.existsSync(file) ? "present" : "gone"
  },
})
if (seen !== "gone") throw new Error("V2 left the old export in place")
if (missing.ok) throw new Error("V2 passed with no export")
if (missing.line === undefined || !missing.line.includes("wrote no tests/browser/exported-deck.pptx")) {
  throw new Error(missing.line ?? "V2 passed with no export")
}
if (fs.existsSync(file)) throw new Error("V2 kept the old export")

fs.writeFileSync(file, Buffer.from("old good export"))
const failedSpec = await freshBrowserExport({
  file,
  run: async () => {
    fs.writeFileSync(file, Buffer.from("partial"))
    throw new Error("spec failed")
  },
})
if (failedSpec.ok) throw new Error("a failed spec passed")
if (failedSpec.line === undefined || !failedSpec.line.includes("browser export spec failed")) {
  throw new Error(failedSpec.line ?? "a failed spec passed")
}

const silentSpec = await freshBrowserExport({
  file,
  run: async () => {
    fs.writeFileSync(file, Buffer.from("written before the failure"))
    throw new Error("")
  },
})
if (silentSpec.ok) throw new Error("a spec that failed with no message passed")
if (!silentSpec.line.includes("browser export spec failed")) throw new Error(silentSpec.line)

const paragraphsFile = path.join(dir, "exported-paragraphs.pptx")
fs.writeFileSync(file, planted)
fs.writeFileSync(paragraphsFile, planted)
let deckBefore = "unread"
let paragraphsBefore = "unread"
const both = await freshBrowserExport({
  file,
  also: [paragraphsFile],
  run: async () => {
    deckBefore = fs.existsSync(file) ? "present" : "gone"
    paragraphsBefore = fs.existsSync(paragraphsFile) ? "present" : "gone"
    fs.writeFileSync(file, fresh)
    fs.writeFileSync(paragraphsFile, fresh)
  },
})
if (deckBefore !== "gone" || paragraphsBefore !== "gone")
  throw new Error("a stale export was still there when the spec ran")
if (!both.ok) throw new Error("two fresh exports were rejected")

fs.writeFileSync(file, Buffer.from("old good export"))
fs.writeFileSync(paragraphsFile, Buffer.from("old good paragraphs"))
const onlyDeck = await freshBrowserExport({
  file,
  also: [paragraphsFile],
  run: async () => {
    fs.writeFileSync(file, fresh)
  },
})
if (onlyDeck.ok) throw new Error("a spec that wrote no exported-paragraphs.pptx passed")
if (!onlyDeck.line.includes("wrote no tests/browser/exported-paragraphs.pptx")) throw new Error(onlyDeck.line)
if (onlyDeck.line.includes("exported-deck.pptx")) throw new Error(onlyDeck.line)
if (fs.existsSync(paragraphsFile)) throw new Error("the stale exported-paragraphs.pptx was kept")

const singleFailureSample = `[WebServer] $ tsc -b && vite build
[WebServer] (!) Some chunks are larger than 500 kB after minification. Consider:
[WebServer] - Using dynamic import() to code-split the application

Running 1 test using 1 worker

[1/1] tests/browser/thin-deck.spec.ts:128:1 › an edit to Hello! survives reload and exports @export
  1) tests/browser/thin-deck.spec.ts:128:1 › an edit to Hello! survives reload and exports @export ────

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: "Hello!"
    Received: "Something else"

      140 |   await expect(box).toHaveText("Hello!")
    > 141 |   expect(value).toBe("Hello!")
          |                 ^
      142 | })

        at /home/quanvm/.../thin-deck.spec.ts:141:17

    Error Context: test-results/thin-deck-an-edit-to-Hello-survives-reload-and-exports/error-context.md


  1 failed
    tests/browser/thin-deck.spec.ts:128:1 › an edit to Hello! survives reload and exports @export ──────
`

const singleFailure = playwrightFailureLines(singleFailureSample)
if (!singleFailure.includes("thin-deck.spec.ts:128:1")) {
  throw new Error("failure lines missed the test file and location")
}
if (!singleFailure.includes("Error: expect(received).toBe(expected)")) {
  throw new Error("failure lines missed the assertion error")
}
if (!singleFailure.includes('> 141 |   expect(value).toBe("Hello!")')) {
  throw new Error("failure lines missed the code snippet")
}
if (!singleFailure.includes("at /home/quanvm/.../thin-deck.spec.ts:141:17")) {
  throw new Error("failure lines missed the stack trace")
}
if (singleFailure.includes("[WebServer]")) {
  throw new Error("failure lines kept webserver noise")
}
if (singleFailure.includes("Running 1 test")) {
  throw new Error("failure lines kept runner banner")
}
if (singleFailure.includes("[1/1]")) {
  throw new Error("failure lines kept progress line")
}
if (singleFailure.includes("Error Context:")) {
  throw new Error("failure lines kept error context")
}
if (singleFailure.includes("1 failed")) {
  throw new Error("failure lines kept summary")
}

const timeoutFailureSample = `Running 1 test using 1 worker

[1/1] tests/browser/slide-export.spec.ts:112:1 › timeout test @export
  1) tests/browser/slide-export.spec.ts:112:1 › timeout test @export ────

    TimeoutError: locator.click: Timeout 5000ms exceeded.
    Call log:
      - waiting for getByRole('button', { name: 'Add slide' })


      118 |   await expect(entry(page, 1)).toBeVisible()
    > 119 |   await page.getByRole("button", { name: "Add slide" }).click()
          |                                                         ^
      120 |   await expect(page.locator("[data-slide-entry]")).toHaveCount(3)

        at /home/quanvm/.../slide-export.spec.ts:119:57

    Error Context: test-results/slide-export-timeout/error-context.md


  1 failed
    tests/browser/slide-export.spec.ts:112:1 › timeout test @export ────
`

const timeoutFailure = playwrightFailureLines(timeoutFailureSample)
if (!timeoutFailure.includes("TimeoutError: locator.click: Timeout 5000ms exceeded.")) {
  throw new Error("failure lines missed the timeout error")
}
if (!timeoutFailure.includes("waiting for getByRole('button', { name: 'Add slide' })")) {
  throw new Error("failure lines missed the call log")
}

const multiFailureSample = `Running 2 tests using 1 worker

[1/2] tests/browser/box-export.spec.ts:76:1 › first
  1) tests/browser/box-export.spec.ts:76:1 › first ────

    Error: expected 1 to be 2

      75 |
    > 76 | expect(1).toBe(2)
         |           ^

        at /home/quanvm/.../box-export.spec.ts:76:11

[2/2] tests/browser/box-export.spec.ts:80:1 › second
  2) tests/browser/box-export.spec.ts:80:1 › second ────

    Error: expected 3 to be 4

      79 |
    > 80 | expect(3).toBe(4)
         |           ^

        at /home/quanvm/.../box-export.spec.ts:80:11

  2 failed
`

const multiFailure = playwrightFailureLines(multiFailureSample)
if (!multiFailure.includes("box-export.spec.ts:76:1") || !multiFailure.includes("box-export.spec.ts:80:1")) {
  throw new Error("failure lines missed one of the multiple failures")
}

if (playwrightFailureLines("arbitrary error") !== "arbitrary error") {
  throw new Error("plain error was not kept as-is")
}

if (playwrightFailureLines("") !== "") {
  throw new Error("empty string returned non-empty")
}

const failedPlaywrightSpec = await freshBrowserExport({
  file,
  run: async () => {
    const error = new Error("pnpm exec playwright test failed")
    error.stdout = singleFailureSample
    error.stderr = "[WebServer] chunk warning"
    throw error
  },
})
if (failedPlaywrightSpec.ok) throw new Error("a failed playwright spec passed")
if (!failedPlaywrightSpec.detail.includes("thin-deck.spec.ts:128:1")) {
  throw new Error("playwright failure details were not extracted in freshBrowserExport")
}
if (failedPlaywrightSpec.detail.includes("[WebServer]")) {
  throw new Error("webserver chunk warning leaked into detail")
}

console.log("browser export tests passed")
