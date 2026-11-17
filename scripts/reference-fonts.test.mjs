import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
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
for (const name of ["fonts-crosextra-carlito", "fonts-crosextra-caladea", "fonts-liberation-sans-narrow"]) {
  const pinned = pins.packages.find((entry) => entry.file.includes(`/${name}_`))
  if (pinned === undefined || !/^[0-9a-f]{64}$/.test(pinned.sha256))
    fail(`reference-fonts.json does not pin ${name} to a sha256`)
}
const twins = JSON.parse(fs.readFileSync(new URL("../packages/fonts/src/twins.json", import.meta.url), "utf8"))
const catalog = JSON.parse(fs.readFileSync(new URL("../packages/fonts/src/catalog.json", import.meta.url), "utf8"))
if (!twins.some((alias) => alias.family === "Arial Narrow" && alias.prefer === "Liberation Sans Narrow"))
  fail("reference-fonts.json does not draw Arial Narrow in Liberation Sans Narrow, its metric twin")
if (JSON.stringify(renderSettings.fonts) !== JSON.stringify({ ...pins, aliases: twins, revision: catalog.revision }))
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
const otherPins = path.join(tools, "fonts", "0123456789abcdef")
fs.mkdirSync(otherPins, { recursive: true })
fs.writeFileSync(path.join(otherPins, "installed"), "")
const result = spawnSync("/usr/bin/bash", [script, "true"], {
  env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home, PPTX_TOOLS: tools },
  encoding: "utf8",
  timeout: 30000,
})
const fontFolder = path.join(tools, "fonts")
const marks = fs.existsSync(fontFolder)
  ? fs.readdirSync(fontFolder, { recursive: true }).filter((name) => String(name).endsWith("installed"))
  : []
const kept = marks.some((name) => !String(name).startsWith("0123456789abcdef"))
const othersKept = fs.existsSync(path.join(otherPins, "installed"))
fs.rmSync(home, { recursive: true, force: true })
if (result.status === 0) fail("pptx-tools.sh accepted a font package that does not match its pinned checksum")
if (!result.stderr.includes("does not match its pinned checksum"))
  fail(`pptx-tools.sh did not say why it refused the fonts: ${result.stderr}`)
if (kept) fail("pptx-tools.sh marked fonts installed after a checksum failure")
if (!othersKept)
  fail("pptx-tools.sh removed the fonts another set of pins installed, which a concurrent run may be using")

const shared = fs.mkdtempSync(path.join(os.tmpdir(), "reference-fonts-"))
const sharedBin = path.join(shared, "bin")
fs.mkdirSync(sharedBin)
for (const [name, body] of [
  ["soffice", "exit 0"],
  ["pdftoppm", "exit 0"],
  ["dotnet", 'echo "8.0.100 [/fake]"'],
])
  fs.writeFileSync(path.join(sharedBin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 })
fs.symlinkSync(process.execPath, path.join(sharedBin, "node"))
const sharedTools = path.join(shared, "tools")
const stamp = createHash("sha256")
  .update(fs.readFileSync(new URL("./reference-fonts.json", import.meta.url)))
  .digest("hex")
  .slice(0, 16)
fs.mkdirSync(path.join(sharedTools, "fonts", stamp), { recursive: true })
fs.writeFileSync(path.join(sharedTools, "fonts", stamp, "installed"), "")
const configFor = (base) => {
  fs.writeFileSync(base, "<fontconfig/>")
  const shown = spawnSync("/usr/bin/bash", [script, "printenv", "FONTCONFIG_FILE"], {
    env: { PATH: `${sharedBin}:/usr/bin:/bin`, HOME: shared, PPTX_TOOLS: sharedTools, FONTCONFIG_FILE: base },
    encoding: "utf8",
    timeout: 30000,
  })
  const file = shown.stdout.trim()
  return { file, text: file === "" ? "" : fs.readFileSync(file, "utf8") }
}
const first = configFor(path.join(shared, "first.conf"))
const second = configFor(path.join(shared, "second.conf"))
const again = configFor(path.join(shared, "first.conf"))
fs.rmSync(shared, { recursive: true, force: true })
if (first.file === second.file)
  fail("pptx-tools.sh writes one fontconfig file for every run, so a run with another base swaps a running one's fonts")
if (!first.text.includes("first.conf") || !second.text.includes("second.conf"))
  fail("pptx-tools.sh does not include each run's own base fontconfig")
if (again.file !== first.file) fail("pptx-tools.sh writes a new fontconfig file for a run whose fonts did not change")

console.log("reference-fonts tests passed")
