import { availableParallelism } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { FullConfig } from "@playwright/test"
import { onCi, workerOverrideName, workerRefusal } from "../browser-workers.ts"
import { buildSite } from "./site-server.ts"

const browserHelper = join(process.cwd(), ".agents/skills/verify-airdesign/bin/browser.mjs")

export default async function launch(config: FullConfig): Promise<void> {
  const { stripInherited } = await import("../../scripts/test-environment.mjs")
  stripInherited(process.env)
  const refusal = workerRefusal({
    workers: config.workers,
    cores: availableParallelism(),
    ci: onCi(process.env),
    override: process.env[workerOverrideName],
  })
  if (refusal !== undefined) throw new Error(refusal)
  const { browserEnv, openBrowser } = (await import(pathToFileURL(browserHelper).href)) as {
    browserEnv: (env: NodeJS.ProcessEnv) => NodeJS.ProcessEnv
    openBrowser: () => Promise<{ close: () => Promise<void> }>
  }
  const libraries = browserEnv(process.env).LD_LIBRARY_PATH
  if (libraries !== undefined) process.env.LD_LIBRARY_PATH = libraries
  const browser = await openBrowser()
  await browser.close()
  await buildSite()
}
