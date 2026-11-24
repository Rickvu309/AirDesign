import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { test as base, type BrowserContext, type Page } from "@playwright/test"
import { deckStateFixture, type DeckState } from "../browser/deck-state"

type Kit = { readonly capture: (label: string) => Promise<string> }
type Journey = (kit: Kit) => Promise<void>
type Helper = {
  readonly journeyKit: (given: {
    run: string
    name: string
    page: Page
    context: BrowserContext
  }) => Promise<{ kit: Kit; out: string; runJourney: (journey: Journey) => Promise<void> }>
  readonly journeyFile: (name: string) => string
  readonly recordJourney: (run: string, name: string, passed: boolean, out: string) => void
}

const run = process.env.VERIFY_AIRDESIGN_RUN ?? ""
const helperFile = join(process.cwd(), ".agents/skills/verify-airdesign/bin/verify-airdesign.mjs")

const test = base.extend<{ deckState: DeckState }>({ deckState: deckStateFixture })

test.use({ baseURL: process.env.VERIFY_AIRDESIGN_ORIGIN })

async function drive(name: string, page: Page, context: BrowserContext): Promise<void> {
  const { journeyKit, journeyFile, recordJourney } = (await import(pathToFileURL(helperFile).href)) as Helper
  const { kit, out, runJourney } = await journeyKit({ run, name, page, context })
  const { default: journey } = (await import(pathToFileURL(journeyFile(name)).href)) as {
    default: Journey
  }
  try {
    await runJourney(journey)
    recordJourney(run, name, true, out)
  } catch (error) {
    await kit.capture("failure").catch(() => undefined)
    recordJourney(run, name, false, out)
    throw error
  }
}

for (const name of [
  "aira-panel",
  "linked-offline-undo",
  "linked-label-undo",
  "linked-refused-undo",
  "deck-list-trash",
  "connected-agents",
  "component-paths",
  "path-paint",
  "usage-page",
  "account-name",
  "sign-in-mail",
  "sign-in-pages",
  "landing-pages",
]) {
  test(name, async ({ page, context }) => {
    await drive(name, page, context)
  })
}
