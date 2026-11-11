import fs from "node:fs"
import path from "node:path"

export async function freshBrowserExport({ file, also = [], run }) {
  const files = [file, ...also]
  for (const stale of files) fs.rmSync(stale, { force: true })
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
  const missing = files.filter((written) => !fs.existsSync(written))
  if (!specFailed && missing.length === 0) return { ok: true, seconds, line: "", detail: "" }
  const line = [
    specFailed ? "browser export spec failed" : "",
    ...missing.map((written) => `browser export spec wrote no tests/browser/${path.basename(written)}`),
  ]
    .filter((part) => part !== "")
    .join("; ")
  return { ok: false, seconds, line, detail: specError }
}
