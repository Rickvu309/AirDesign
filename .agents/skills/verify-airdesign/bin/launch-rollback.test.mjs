import { spawn } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, it } from "vitest"
import { alive } from "./leftover-runs.mjs"
import { rollbackLaunch } from "./launch-rollback.mjs"

it("ends a half-started launch: waits for the serve process, tears the run down, removes its scratch folder, keeping the log", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "rollback-"))
  const scratch = path.join(root, "scratch")
  mkdirSync(scratch)
  writeFileSync(path.join(scratch, "stack.log"), "boom")
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" })
  const evidenceLog = path.join(root, "stack.log")
  let stopped = 0
  await rollbackLaunch(child, () => (stopped += 1), scratch, evidenceLog)
  expect(alive(child.pid)).toBe(false)
  expect(stopped).toBe(1)
  expect(existsSync(scratch)).toBe(false)
  expect(readFileSync(evidenceLog, "utf8")).toBe("boom")
  rmSync(root, { recursive: true, force: true })
})
