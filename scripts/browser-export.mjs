import fs from "node:fs"

export async function freshBrowserExport({ file, run }) {
  fs.rmSync(file, { force: true })
  const started = Date.now()
  let specError = ""
  let specFailed = false
  try {
    await run()
  } catch (error) {
    specFailed = true
    specError = error instanceof Error ? error.message : String(error)
  }
  const seconds = (Date.now() - started) / 1000
  if (!specFailed && fs.existsSync(file)) return { ok: true, seconds, line: "", detail: "" }
  const line = [
    specFailed ? "browser export spec failed" : "",
    fs.existsSync(file) ? "" : "browser export spec wrote no tests/browser/exported-deck.pptx",
  ]
    .filter((part) => part !== "")
    .join("; ")
  return { ok: false, seconds, line, detail: specError }
}
