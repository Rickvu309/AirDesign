import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { once } from "node:events"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { setTimeout as pause } from "node:timers/promises"

if (process.platform !== "linux" || !fs.existsSync("/proc")) process.exit(0)

const source = path.resolve(import.meta.dirname, "..")
const root = fs.mkdtempSync(path.join(os.tmpdir(), "gate-stop-"))
const probe = randomUUID()
const env = { ...process.env, GATE_STOP_PROBE: probe }
const git = (...args) => execFileSync("git", args, { cwd: root, env, stdio: "pipe" })
const put = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), text)
}
const entries = (pid) => {
  try {
    return fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0")
  } catch {
    return []
  }
}

let gate
let other
process.on("exit", () => {
  gate?.kill("SIGTERM")
  other?.kill("SIGKILL")
  fs.rmSync(root, { recursive: true, force: true })
})
for (const [signal, code] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
]) {
  process.on(signal, async () => {
    if (gate?.kill("SIGTERM")) await once(gate, "close")
    process.exit(code)
  })
}

fs.cpSync(path.join(source, "scripts"), path.join(root, "scripts"), { recursive: true })
fs.symlinkSync(path.join(source, "node_modules"), path.join(root, "node_modules"), "dir")
put(".node-version", "24\n")
put("pnpm-workspace.yaml", "packages: []\n")
fs.copyFileSync(path.join(source, "metrics.json"), path.join(root, "metrics.json"))
put(".gitignore", "node_modules\n")
put("tests/browser/spec-seconds.json", '{"seconds":{}}')
fs.mkdirSync(path.join(root, "tests/journeys"))
fs.copyFileSync(
  path.join(source, "tests/journeys/journey-shards.mjs"),
  path.join(root, "tests/journeys/journey-shards.mjs"),
)
put("gate-fixture.mjs", 'import { checkSteps } from "./scripts/check-steps.mjs"; checkSteps.cheapGateStages = () => []')
put(
  ".agents/skills/verify-airdesign/bin/verify-airdesign.mjs",
  'console.log(JSON.stringify({ changed: ["scripts/stop-probe.test.mjs"], steps: [{ kind: "script-tests", files: ["scripts/stop-probe.test.mjs"] }] }))',
)
put(
  "scripts/stop-probe.test.mjs",
  `
import { spawn } from "node:child_process"
import fs from "node:fs"
process.on("SIGTERM", () => { fs.writeFileSync("term", "SIGTERM"); process.exit(0) })
const child = spawn(process.execPath, ["-e", "setInterval(() => { if (!require('node:fs').existsSync('.git')) process.exit(0) }, 100)"], {
  detached: true, stdio: "ignore",
})
child.unref()
fs.writeFileSync("ready.tmp", String(child.pid))
fs.renameSync("ready.tmp", "ready")
setTimeout(() => {}, 20000)
`,
)
git("init", "-q")
git(
  "-c",
  "user.name=Fixture",
  "-c",
  "user.email=fixture@example.com",
  "-c",
  "commit.gpgsign=false",
  "commit",
  "--allow-empty",
  "-qm",
  "Start fixture",
)

gate = spawn(process.execPath, ["--import", "./gate-fixture.mjs", "scripts/gate.mjs", "--base", "HEAD"], {
  cwd: root,
  env,
})
const closed = once(gate, "close")
let output = ""
for (const stream of [gate.stdout, gate.stderr]) stream.on("data", (chunk) => (output += chunk))
const deadline = Date.now() + 12_000
while (!fs.existsSync(path.join(root, "ready")) && gate.exitCode === null && Date.now() < deadline) await pause(20)
assert.ok(fs.existsSync(path.join(root, "ready")), `script-tests never started the probe:\n${output}`)
const nested = Number(fs.readFileSync(path.join(root, "ready"), "utf8"))
const inherited = new Set(Object.keys(env))
const token = entries(nested).find(
  (entry) => entry.startsWith("AIRDESIGN_GATE_RUN_") && !inherited.has(entry.split("=")[0]),
)
other = spawn(process.execPath, ["-e", "setTimeout(() => {}, 20000)"], {
  env: { ...env, [`AIRDESIGN_GATE_RUN_${randomUUID().replaceAll("-", "")}`]: "1" },
  stdio: "ignore",
})
other.unref()

gate.kill("SIGINT")
assert.deepEqual(await closed, [130, null], output)
assert.ok(token, "the detached grandchild did not inherit the gate's token")
assert.equal(fs.readFileSync(path.join(root, "term"), "utf8"), "SIGTERM")
assert.deepEqual(
  fs.readdirSync("/proc").filter((pid) => /^\d+$/.test(pid) && entries(pid).includes(token)),
  [],
  "a process with the stopped gate's token survived",
)
assert.ok(entries(other.pid).includes(`GATE_STOP_PROBE=${probe}`), "the other run was stopped")
