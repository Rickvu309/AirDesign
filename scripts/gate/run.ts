import { spawnSync } from "node:child_process"
import { mkdirSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { verificationShards, unitShards, requiresFullGate } from "./plan.ts"

const [command = "all", shard] = process.argv.slice(2)

function npm(args: string[]) {
  const started = performance.now()
  const env = { ...process.env }
  delete env.npm_config_allow_scripts
  const result = spawnSync("npm", args, { stdio: "inherit", env })
  console.log(JSON.stringify({ gateStep: args.join(" "), seconds: (performance.now() - started) / 1000, exit: result.status }))
  if (result.status !== 0) process.exit(result.status ?? 1)
}

async function prepareTests() {
  process.env.TMPDIR ??= join(homedir(), "tmp", "airdesign-gate")
  mkdirSync(process.env.TMPDIR, { recursive: true })
  process.env.AGENT_BROWSER_EXECUTABLE_PATH ??= (await import("playwright")).chromium.executablePath()
}

function runVerification(name: string) {
  const group = verificationShards.find(value => value.name === name)
  if (!group) throw new Error(`Unknown verification shard: ${name}`)
  for (const script of group.scripts) npm(["run", script])
}

switch (command) {
  case "matrix":
    console.log(JSON.stringify({ include: verificationShards }))
    break
  case "changes":
    console.log(String(requiresFullGate(readFileSync(0, "utf8").split("\0").filter(Boolean))))
    break
  case "install":
    npm(["ci"])
    break
  case "build":
    npm(["run", "build"])
    break
  case "setup":
    npm(["ci"])
    npm(["run", "build"])
    break
  case "lint":
  case "typecheck":
    npm(["run", command])
    break
  case "unit":
    await prepareTests()
    if (!unitShards.some(value => value === shard)) throw new Error(`Unknown unit shard: ${shard}`)
    npm(["test", "--", `--shard=${shard}`])
    break
  case "verify":
    await prepareTests()
    runVerification(shard ?? "")
    break
  case "all":
    npm(["ci"])
    npm(["run", "build"])
    npm(["run", "lint"])
    npm(["run", "typecheck"])
    await prepareTests()
    for (const value of unitShards) npm(["test", "--", `--shard=${value}`])
    for (const value of verificationShards) runVerification(value.name)
    break
  default:
    throw new Error(`Unknown gate command: ${command}`)
}
