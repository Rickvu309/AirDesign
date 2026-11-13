import { join } from "node:path"
import { pathToFileURL } from "node:url"

const browserHelper = join(process.cwd(), ".agents/skills/verify-airdesign/bin/browser.mjs")

export default async function launch(): Promise<void> {
  const { browserEnv, openBrowser } = (await import(pathToFileURL(browserHelper).href)) as {
    browserEnv: (env: NodeJS.ProcessEnv) => NodeJS.ProcessEnv
    openBrowser: () => Promise<{ close: () => Promise<void> }>
  }
  const libraries = browserEnv(process.env).LD_LIBRARY_PATH
  if (libraries !== undefined) process.env.LD_LIBRARY_PATH = libraries
  const browser = await openBrowser()
  await browser.close()
}
