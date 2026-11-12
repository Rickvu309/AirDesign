import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { test, type BrowserContext, type Page } from "@playwright/test"

type Kit = { readonly capture: (label: string) => Promise<string> }
type Helper = {
  readonly journeyKit: (given: {
    run: string
    name: string
    page: Page
    context: BrowserContext
  }) => Promise<{ kit: Kit; out: string }>
  readonly journeyFile: (name: string) => string
  readonly recordJourney: (run: string, name: string, passed: boolean, out: string) => void
}

const run = process.env.VERIFY_AIRDESIGN_RUN ?? ""
const helperFile = join(process.cwd(), ".agents/skills/verify-airdesign/bin/verify-airdesign.mjs")

test.use({ baseURL: process.env.VERIFY_AIRDESIGN_ORIGIN })

async function drive(name: string, page: Page, context: BrowserContext): Promise<void> {
  const { journeyKit, journeyFile, recordJourney } = (await import(pathToFileURL(helperFile).href)) as Helper
  const { kit, out } = await journeyKit({ run, name, page, context })
  const { default: journey } = (await import(pathToFileURL(journeyFile(name)).href)) as {
    default: (given: Kit) => Promise<void>
  }
  try {
    await journey(kit)
    recordJourney(run, name, true, out)
  } catch (error) {
    await kit.capture("failure").catch(() => undefined)
    recordJourney(run, name, false, out)
    throw error
  }
}

for (const name of [
  "speaker-notes",
  "open-edit-save",
  "blank-deck",
  "blank-slides",
  "element-index",
  "commit-once",
  "deck-list-trash",
  "slide-paint",
  "cleared-browser",
  "delete-account",
  "move-resize",
  "aira-turn",
  "connected-agents",
  "aira-panel",
  "aira-slides",
]) {
  test(name, async ({ page, context }) => {
    await drive(name, page, context)
  })
}
