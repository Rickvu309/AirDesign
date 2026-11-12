import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { dotnetCandidates, findDotnet, hasSdk8 } from "./dotnet-sdk.mjs"

const fail = (message) => {
  console.error(message)
  process.exit(1)
}
const same = (actual, expected, what) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    fail(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

same(
  dotnetCandidates({ PPTX_DOTNET: "/a/dotnet", DOTNET_ROOT: "/r" }, "/h").map((c) => c.command),
  ["/a/dotnet", "dotnet", "/r/dotnet", "/h/.dotnet/dotnet"],
  "order of places",
)
same(
  dotnetCandidates({}, "/h").map((c) => c.command),
  ["dotnet", "/h/.dotnet/dotnet"],
  "unset places are skipped",
)

same(
  findDotnet({}, { home: "/h", works: (command) => command === "/h/.dotnet/dotnet" }),
  { command: "/h/.dotnet/dotnet" },
  "falls back to the home install",
)
same(
  findDotnet({ PPTX_DOTNET: "/a/dotnet" }, { home: "/h", works: () => true }),
  { command: "/a/dotnet" },
  "PPTX_DOTNET wins",
)

const none = findDotnet({ DOTNET_ROOT: "/r" }, { home: "/h", works: () => false })
for (const place of [
  "dotnet on PATH",
  "$DOTNET_ROOT/dotnet (/r/dotnet)",
  "$HOME/.dotnet/dotnet (/h/.dotnet/dotnet)",
  "dotnet-install",
  "PPTX_DOTNET",
])
  if (!none.problem?.includes(place)) fail(`the problem does not name ${place}: ${none.problem}`)

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "dotnet-sdk-"))
const fake = path.join(folder, "dotnet")
fs.writeFileSync(fake, '#!/bin/sh\necho "8.0.100 [/x]"\n', { mode: 0o755 })
if (!hasSdk8(fake)) fail("an 8.x SDK is not recognised")
fs.writeFileSync(fake, '#!/bin/sh\necho "9.0.100 [/x]"\n', { mode: 0o755 })
if (hasSdk8(fake)) fail("a 9.x SDK counts as 8")
if (hasSdk8(path.join(folder, "missing"))) fail("a missing binary counts as an SDK")

fs.writeFileSync(fake, '#!/bin/sh\necho "8.0.100 [/x]"\n', { mode: 0o755 })
const printed = execFileSync(process.execPath, [new URL("./dotnet-sdk.mjs", import.meta.url).pathname], {
  env: { PATH: "/usr/bin:/bin", HOME: folder, PPTX_DOTNET: fake },
  encoding: "utf8",
}).trim()
same(printed, fake, "the command line prints the binary")
fs.rmSync(folder, { recursive: true, force: true })

const bare = fs.mkdtempSync(path.join(os.tmpdir(), "dotnet-sdk-bare-"))
const shell = spawnSync("bash", [new URL("./pptx-tools.sh", import.meta.url).pathname, "true"], {
  env: { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, HOME: bare },
  encoding: "utf8",
})
fs.rmSync(bare, { recursive: true, force: true })
if (shell.status === 0 || !shell.stderr.includes("Tried:"))
  fail(`the shell wrapper does not report the places tried: ${shell.stderr}`)
