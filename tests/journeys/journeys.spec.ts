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
  "appearance-presets",
  "shape-geometry",
  "corners",
  "opacity",
  "table-fill",
  "text-type",
  "text-fields",
  "text-style-weight",
  "dynamic-fonts",
  "picture-icon",
  "theme",
  "commit-once",
  "deck-list-trash",
  "deck-grid-motion",
  "deck-stars",
  "slide-paint",
  "cleared-browser",
  "delete-account",
  "move-resize",
  "connected-agents",
  "slide-commands",
  "grid-row-add",
  "grid-gap-add",
  "person-undo",
  "usage-page",
  "account-name",
  "sign-in-mail",
  "sign-in-pages",
  "landing-pages",
  "typed-reload",
  "deck-names",
  "slide-charts",
  "signed-out-deck",
  "connector-follow",
]) {
  test(name, async ({ page, context }) => {
    await drive(name, page, context)
  })
}

test.describe("recorded Aira", () => {
  test.describe.configure({ mode: "default" })
  for (const name of [
    "element-index",
    "aira-turn",
    "aira-panel",
    "aira-slides",
    "aira-head",
    "agent-after-open",
    "group-elements",
    "connector-diagram",
    "agent-bench-recorded",
  ]) {
    test(name, async ({ page, context }) => {
      await drive(name, page, context)
    })
  }
})
