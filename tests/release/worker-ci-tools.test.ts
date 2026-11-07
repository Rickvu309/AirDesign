import { readFile } from "node:fs/promises"
import { expect, it } from "vitest"

it("installs every process tool of the worker image in CI before worker tests run", async () => {
  const image = await readFile("Dockerfile", "utf8")
  const ci = await readFile(".github/actions/prepare-worker/action.yml", "utf8")
  const imagePackages = /apt-get install -y --no-install-recommends ([^&]+)&&/.exec(image)?.[1].trim().split(/\s+/) ?? []
  const ciPackages = /apt-get install -y --no-install-recommends ([^\n]+)/.exec(ci)?.[1].trim().split(/\s+/) ?? []
  expect(imagePackages).toContain("tini")
  expect(ciPackages, "container-mode worker tests spawn tini; install it in .github/actions/prepare-worker").toContain("tini")
})
