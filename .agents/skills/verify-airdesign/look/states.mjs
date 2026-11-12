import { existsSync } from "node:fs"
import path from "node:path"
import { expect } from "@playwright/test"

const editor = "/screens/s42-02-editor-agent-run-complete"

export async function openDeck(page, file, slide) {
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
  if (slide === undefined) return
  const entry = page.locator(`[data-slide-entry="${Number(slide)}"]`)
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
}

async function tableCells(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/corpus/nasa-roman-thermal-runtime.pptx"), 10)
  await expect(kit.page.locator("[data-slide-paint] [data-canvas-table]")).toHaveCount(1)
}

async function importedText(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/corpus/nasa-cots-parts-nesc.pptx"), 5)
  await kit.page.evaluate(() => document.fonts.ready)
}

async function listFailed(kit) {
  await kit.signIn()
  await kit.page.route(
    (url) => url.pathname === kit.deckRoutes.list.path,
    (route) => route.abort("failed"),
  )
  await kit.page.goto("/")
  await expect(kit.page.getByRole("alert")).toBeVisible()
}

async function importRefused(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await kit.page.locator("input[type=file]").setInputFiles({
    name: "refused.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: Buffer.from("not a PowerPoint"),
  })
  await expect(kit.page.getByRole("alert")).toBeVisible()
}

async function offline(kit) {
  await reach(find("agent-empty"), kit)
  await kit.context.setOffline(true)
  const text = kit.page.locator('[contenteditable="true"]')
  await text.click()
  await text.press("End")
  await text.press("x")
  await expect(kit.page.getByText("You're offline. Edits are saved on this device.", { exact: true })).toBeVisible()
}

async function outOfUsage(kit) {
  await reach(find("agent-empty"), kit)
  const week = 7 * 24 * 60 * 60 * 1000
  await kit.page.route(
    (url) => url.pathname === kit.airaRoutes.turn.path,
    (route) =>
      route.fulfill({
        status: 402,
        json: {
          ok: false,
          refusal: "allowance",
          usage: { used: 2, allowed: 2, resets: new Date(Math.ceil(Date.now() / week) * week).toISOString() },
        },
      }),
  )
  const composer = kit.page.getByRole("textbox", { name: "Ask Aira" })
  await composer.fill("Make the title bigger")
  await composer.press("Enter")
  await expect(kit.page.getByText("You've hit this week's limit", { exact: true })).toBeVisible()
}

async function usageOpen(kit) {
  await reach(find("agent-empty"), kit)
  await kit.page.locator("[data-editor-panel]").getByRole("button", { name: "Weekly usage" }).click()
  await expect(kit.page.getByRole("region", { name: "Weekly usage" })).toContainText("%")
}

async function notOffered(kit) {
  await kit.signIn()
  await kit.page.route(
    (url) => url.pathname === kit.airaRoutes.usage.path,
    (route) => route.continue({ headers: { ...route.request().headers(), [kit.countryHeader]: "CN" } }),
  )
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(
    kit.page.locator("[data-editor-panel]").getByText("Aira isn't available in your country or region yet.", {
      exact: true,
    }),
  ).toBeVisible()
}

async function askedOnce(kit, ask = "Make the Q3 investor update lead with the number. Keep it calm.") {
  await reach(find("agent-empty"), kit)
  const week = 7 * 24 * 60 * 60 * 1000
  const usage = { used: 0.76, allowed: 2, resets: new Date(Math.ceil(Date.now() / week) * week).toISOString() }
  const text = "Your title now leads with the Q3 number."
  await kit.page.route(
    (url) => url.pathname === kit.airaRoutes.turn.path,
    (route) =>
      route.fulfill({
        contentType: "application/x-ndjson",
        body: `${JSON.stringify({ type: "text", text })}\n${JSON.stringify({ type: "end", ok: true, stop: "end_turn", content: [{ type: "text", text }], usage })}\n`,
      }),
  )
  const composer = kit.page.getByRole("textbox", { name: "Ask Aira" })
  await composer.fill(ask)
  await composer.press("Enter")
  await expect(kit.page.getByText(text, { exact: true })).toBeVisible()
}

async function historyOpen(kit, ask) {
  await askedOnce(kit, ask)
  const panel = kit.page.locator("[data-editor-panel]")
  await panel.getByRole("button", { name: "New chat", exact: true }).click()
  await panel.locator("[data-aira-history]").click()
  await expect(kit.page.locator("[data-aira-chats]")).toBeVisible()
}

async function historyLongTitle(kit) {
  await historyOpen(
    kit,
    "Make the Q3 investor update lead with the number that matters most to the board, then the three risks behind it. Keep it calm.",
  )
}

async function chatRestored(kit) {
  await askedOnce(kit)
  await kit.page.reload()
  await expect(kit.page.getByText("Your title now leads with the Q3 number.", { exact: true })).toBeVisible()
}

async function usagePage(kit) {
  await kit.signIn()
  await kit.page.goto("/settings/usage")
  await expect(kit.page.getByText(/% used$/)).toBeVisible()
}

export const states = [
  {
    name: "decks-empty",
    design: "/screens/s31-01-decks-browse-empty-first-visit",
    journey: "open-edit-save",
    at: "home-signed-in",
  },
  { name: "decks-failed", design: null, drive: listFailed },
  {
    name: "decks-populated",
    design: "/screens/s31-02-decks-browse-recents-grid",
    journey: "deck-list-trash",
    at: "home-lists-deck",
  },
  { name: "import-refused", design: "/screens/s32-03-decks-new-deck-import-failed", drive: importRefused },
  {
    name: "trash-toast",
    design: "/screens/s33-01-decks-trash-deck-moved-toast",
    journey: "deck-list-trash",
    at: "moved-to-trash",
  },
  {
    name: "trash-populated",
    design: "/screens/s33-02-decks-trash-list",
    journey: "deck-list-trash",
    at: "trash-lists-deck",
  },
  { name: "element-added", design: editor, journey: "element-edits", at: "added-text" },
  { name: "element-deleted", design: editor, journey: "element-edits", at: "deleted-element" },
  { name: "blank-deck", design: editor, journey: "blank-slides", at: "blank-original" },
  { name: "slides-several", design: editor, journey: "blank-slides", at: "layout-placeholders" },
  { name: "editor-text-focused", design: editor, journey: "move-resize", at: "selected" },
  { name: "editor-selected", design: editor, journey: "move-resize", at: "resized" },
  { name: "editor-offline", design: "/screens/s49-02-editor-errors-offline", drive: offline },
  { name: "table-cells", design: null, drive: tableCells },
  { name: "imported-text", design: null, drive: importedText },
  { name: "agent-empty", design: editor, journey: "aira-panel", at: "agent-panel" },
  {
    name: "agent-working",
    design: "/screens/s42-01-editor-agent-working",
    journey: "aira-panel",
    at: "working",
    aira: true,
  },
  { name: "agent-done", design: editor, journey: "aira-panel", at: "done", aira: true },
  {
    name: "agent-failed",
    design: "/screens/s49-01-editor-errors-agent-run-failed",
    journey: "aira-panel",
    at: "failed",
    aira: true,
  },
  { name: "usage-open", design: editor, drive: usageOpen },
  { name: "history-open", design: editor, drive: historyOpen },
  { name: "history-long-title", design: editor, drive: historyLongTitle },
  { name: "chat-restored", design: editor, drive: chatRestored },
  { name: "usage-page", design: "/screens/s81-01-settings-settings-usage-tab", drive: usagePage },
  { name: "agent-out-of-usage", design: "/screens/s92-01-credits-out-of-usage-limit-reached", drive: outOfUsage },
  { name: "agent-not-offered", design: editor, drive: notOffered },
  {
    name: "agents-empty",
    design: "/screens/s81-02-settings-settings-agents-tab",
    journey: "connected-agents",
    at: "agents-empty",
  },
  {
    name: "agents-connected",
    design: "/screens/s81-02-settings-settings-agents-tab",
    journey: "connected-agents",
    at: "agents-connected",
  },
]

export function find(name) {
  const state = states.find((each) => each.name === name)
  if (state === undefined)
    throw new Error(`no state named ${name}; one of ${states.map((each) => each.name).join(", ")}`)
  return state
}

export function matching(pattern = "*") {
  const source = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*")
  return states.filter((state) => new RegExp(`^${source}$`).test(state.name))
}

const journeys = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../journeys")

async function walk(journey, kit, labels, reached) {
  const stop = Symbol(journey)
  const seen = new Set()
  const theirs = kit.journeys && path.join(kit.journeys, `${journey}.mjs`)
  const file = theirs && existsSync(theirs) ? theirs : path.join(journeys, `${journey}.mjs`)
  const { default: drive } = await import(file)
  try {
    await drive({
      ...kit,
      capture: async (label) => {
        if (labels.includes(label) && !seen.has(label)) {
          seen.add(label)
          await reached(label)
        }
        if (labels.every((each) => seen.has(each))) throw stop
        return path.join(kit.out, label)
      },
    })
  } catch (error) {
    if (error !== stop) throw error
  }
  const missed = labels.filter((label) => !seen.has(label))
  if (missed.length > 0) throw new Error(`journey ${journey} never reached ${missed.join(", ")}`)
}

export async function reach(state, kit) {
  if (state.drive) return state.drive(kit)
  await walk(state.journey, kit, [state.at], async () => undefined)
}

export function units(selected) {
  const grouped = new Map()
  const single = []
  for (const state of selected) {
    if (state.drive) single.push({ states: [state], aira: false })
    else {
      const unit = grouped.get(state.journey) ?? { journey: state.journey, states: [], aira: false }
      unit.states.push(state)
      unit.aira ||= state.aira === true
      grouped.set(state.journey, unit)
    }
  }
  return [...grouped.values(), ...single]
}

export async function visit(unit, kit, reached) {
  if (unit.journey === undefined) {
    await unit.states[0].drive(kit)
    await reached(unit.states[0], kit)
    return
  }
  await walk(
    unit.journey,
    kit,
    unit.states.map((state) => state.at),
    (label) =>
      reached(
        unit.states.find((state) => state.at === label),
        kit,
      ),
  )
}

export async function sweep(selected, open, reached, lanes = 3) {
  const waiting = units(selected)
  const failures = []
  const work = async (lane) => {
    for (;;) {
      const at = waiting.findIndex((unit) => lane === 0 || !unit.aira)
      if (at === -1) return
      const [unit] = waiting.splice(at, 1)
      const { kit, close } = await open(unit)
      const done = new Set()
      try {
        await visit(unit, kit, async (state, at) => {
          done.add(state.name)
          await reached(state, at)
        })
      } catch (error) {
        const message = String(error?.message ?? error).split("\n")[0]
        for (const state of unit.states.filter((each) => !done.has(each.name)))
          failures.push({ state: state.name, error: message })
      } finally {
        await close()
      }
    }
  }
  await Promise.all(Array.from({ length: lanes }, (_, lane) => work(lane)))
  return failures
}
