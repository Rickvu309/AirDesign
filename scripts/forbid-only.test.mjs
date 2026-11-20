import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const fail = (message) => {
  throw new Error(message)
}

const setting = (config, key, ci) => {
  const env = { ...process.env }
  if (ci === undefined) delete env.CI
  else env.CI = ci
  const script = `const config = (await import(${JSON.stringify(config)})).default; console.log(String(${key}))`
  return execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: root,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim()
}

const expectSetting = (what, actual, expected) => {
  if (actual !== expected) fail(`${what}: got ${actual}, want ${expected}`)
}

const vitest = path.join(root, "vitest.config.mts")
expectSetting("vitest on ci allows a committed .only", setting(vitest, "config.test.allowOnly", "true"), "false")
expectSetting("vitest on ci allows a committed .only with CI=1", setting(vitest, "config.test.allowOnly", "1"), "false")
expectSetting("vitest here allows .only", setting(vitest, "config.test.allowOnly", undefined), "true")

const playwright = path.join(root, "playwright.config.ts")
expectSetting("playwright on ci allows a committed .only", setting(playwright, "config.forbidOnly", "true"), "true")
expectSetting(
  "playwright on ci allows a committed .only with CI=1",
  setting(playwright, "config.forbidOnly", "1"),
  "true",
)
expectSetting("playwright here forbids .only", setting(playwright, "config.forbidOnly", undefined), "false")

console.log("forbid only tests passed")
