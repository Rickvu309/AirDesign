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
  "slide-layouts",
  "element-edits",
  "picture-add",
  "shape-insert",
  "element-order",
  "slide-background",
  "shape-fill",
  "line-style",
  "shape-effects",
  "shape-geometry",
  "opacity",
  "text-type",
  "commit-once",
  "deck-list-trash",
  "deck-stars",
  "slide-paint",
  "cleared-browser",
  "delete-account",
  "move-resize",
  "connected-agents",
  "slide-commands",
  "person-undo",
  "usage-page",
  "sign-in-mail",
  "sign-in-pages",
  "landing-pages",
  "typed-reload",
  "deck-names",
  "slide-charts",
  "signed-out-deck",
]) {
  test(name, async ({ page, context }) => {
    await drive(name, page, context)
  })
}

test.describe("recorded Aira", () => {
  test.describe.configure({ mode: "default" })
  for (const name of ["element-index", "aira-turn", "aira-panel", "aira-slides", "aira-head", "agent-after-open"]) {
    test(name, async ({ page, context }) => {
      await drive(name, page, context)
    })
  }
})
