import fs from "node:fs"
import path from "node:path"

export function playwrightFailureLines(output) {
  if (typeof output !== "string" || output.trim() === "") return ""
  const clean = output.replace(/\u001b\[[0-9;]*m/g, "")
  const lines = clean.split("\n")
  const blocks = []
  let current = null

  for (const line of lines) {
    if (/^\s*\d+\)\s+/.test(line)) {
      if (current !== null) blocks.push(current.join("\n").trimEnd())
      current = [line]
      continue
    }
    if (current !== null) {
      if (
        /^\s*Error Context:/.test(line) ||
        /^\s*\d+\s+failed/.test(line) ||
        (line.trim() !== "" && !line.startsWith(" "))
      ) {
        blocks.push(current.join("\n").trimEnd())
        current = null
        continue
      }
      current.push(line)
    }
  }
  if (current !== null) blocks.push(current.join("\n").trimEnd())

  if (blocks.length > 0) return blocks.join("\n\n").trim()
  return clean.trim()
}

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
    const text =
      error?.stdout !== undefined || error?.stderr !== undefined
        ? [error.stdout, error.stderr].filter(Boolean).join("\n")
        : error instanceof Error
          ? error.message
          : String(error)
    specError = playwrightFailureLines(text)
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
