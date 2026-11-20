import assert from "node:assert/strict"
import config from "../playwright.config.ts"
import { runCheck, stepsOf } from "./check.mjs"
import { checkSteps } from "./check-steps.mjs"

for (const server of [config.webServer].flat()) {
  assert.match(server.command, /^node tests\/browser\/font-preview\.mjs \d+$/)
  assert.equal(server.stdout, "pipe", "Playwright must print the preview server's stdout")
  assert.equal(server.stderr, "pipe", "Playwright must print the preview server's stderr")
}

for (const part of ["browser", "design"]) {
  const chosen = checkSteps.stagesFor(part, true, { current: 1, total: 4 })
  const steps = chosen.flatMap((stage) => stage.flatMap(stepsOf))
  assert.equal(checkSteps.kindOf("browser-build"), "build")
  assert.deepEqual(
    steps.find(([name]) => name === "browser-build"),
    ["browser-build", "pnpm", ["build:browser"]],
  )
  assert.equal(steps.find(([name]) => name === "browser-tests")[3].AIRDESIGN_WEB_BUILT, "1")

  for (const buildStatus of [0, 1, "hung"]) {
    const ran = []
    const { failed } = await runCheck({
      chosen,
      all: true,
      lock: async () => () => {},
      run: async ([name]) => {
        ran.push(name)
        return name === "browser-build" ? buildStatus : 0
      },
    })
    assert.deepEqual(ran, ["test-imports", "browser-build", ...(buildStatus === 0 ? ["browser-tests"] : [])])
    assert.deepEqual(failed, buildStatus === 0 ? [] : ["browser-build"])
  }
}
