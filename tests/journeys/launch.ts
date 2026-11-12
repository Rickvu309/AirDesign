import { execFileSync } from "node:child_process"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

const helper = ".agents/skills/verify-airdesign/bin/verify-airdesign.mjs"
const browserHelper = join(process.cwd(), ".agents/skills/verify-airdesign/bin/browser.mjs")

export default async function launch(): Promise<() => void> {
  const { browserEnv } = (await import(pathToFileURL(browserHelper).href)) as {
    browserEnv: (env: NodeJS.ProcessEnv) => NodeJS.ProcessEnv
  }
  const libraries = browserEnv(process.env).LD_LIBRARY_PATH
  if (libraries !== undefined) process.env.LD_LIBRARY_PATH = libraries
  const launched = JSON.parse(
    execFileSync(process.execPath, [helper, "launch", "--no-build"], { encoding: "utf8" }),
  ) as {
    run: string
    origin: string
    evidence: string
  }
  process.env.VERIFY_AIRDESIGN_RUN = launched.run
  process.env.VERIFY_AIRDESIGN_ORIGIN = launched.origin
  process.stdout.write(`journeys run ${launched.run}, evidence ${launched.evidence}\n`)
  return () => {
    execFileSync(process.execPath, [helper, "stop", launched.run], { stdio: "ignore" })
  }
}
