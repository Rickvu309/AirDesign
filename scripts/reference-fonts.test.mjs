import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { renderSettings } from "./pptx-render.mjs"

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const script = new URL("./pptx-tools.sh", import.meta.url).pathname

const pins = JSON.parse(fs.readFileSync(new URL("./reference-fonts.json", import.meta.url), "utf8"))
for (const family of ["carlito", "caladea"]) {
  const pinned = pins.packages.find((entry) => entry.file.includes(`fonts-crosextra-${family}_`))
  if (pinned === undefined || !/^[0-9a-f]{64}$/.test(pinned.sha256))
    fail(`reference-fonts.json does not pin fonts-crosextra-${family} to a sha256`)
}
if (JSON.stringify(renderSettings.fonts) !== JSON.stringify(pins))
  fail(
    "the render cache key does not carry the pinned reference fonts, so renders made with other fonts would be reused",
  )

const run = fs.readFileSync(new URL("./paint-fidelity-run.mjs", import.meta.url), "utf8")
if (/chromium\.launch\(/.test(run)) fail("paint-fidelity-run.mjs launches Chromium without its library folder")

const home = fs.mkdtempSync(path.join(os.tmpdir(), "reference-fonts-"))
const bin = path.join(home, "bin")
fs.mkdirSync(bin)
const fake = (name, body) => fs.writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 })
fs.symlinkSync(process.execPath, path.join(bin, "node"))
fake("soffice", "exit 0")
fake("pdftoppm", "exit 0")
fake("dotnet", 'echo "8.0.100 [/fake]"')
fake("curl", 'while [ "$#" -gt 0 ]; do [ "$1" = "-o" ] && out="$2"; shift; done; echo "not a font package" > "$out"')
const tools = path.join(home, "tools")
const result = spawnSync("/usr/bin/bash", [script, "true"], {
  env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home, PPTX_TOOLS: tools },
  encoding: "utf8",
  timeout: 30000,
})
const fontFolder = path.join(tools, "fonts")
const kept = fs.existsSync(fontFolder) && fs.readdirSync(fontFolder).some((name) => name.startsWith("installed"))
fs.rmSync(home, { recursive: true, force: true })
if (result.status === 0) fail("pptx-tools.sh accepted a font package that does not match its pinned checksum")
if (!result.stderr.includes("does not match its pinned checksum"))
  fail(`pptx-tools.sh did not say why it refused the fonts: ${result.stderr}`)
if (kept) fail("pptx-tools.sh marked fonts installed after a checksum failure")

console.log("reference-fonts tests passed")
