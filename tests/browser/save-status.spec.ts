import { expect, type Page } from "@playwright/test"
import { forward, openClean, signInBrowser, test } from "./api-stack"

test.use({ viewport: { width: 1600, height: 1000 } })

const saved = "Saved"
const saving = "Saving…"
const offline = "Offline, saved on this device"
const unreached = "Unable to reach AirDesign"

function saveStatus(page: Page) {
  return page.locator("[data-save-status]")
}

async function typeAtEnd(page: Page, text: string): Promise<void> {
  const editor = page.locator('[contenteditable="true"]')
  await editor.click()
  await page.keyboard.press("End")
  await editor.pressSequentially(text, { delay: 50 })
}

test("an edit reads Saving while its commit waits and Saved once it lands on the server", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  await expect(saveStatus(page)).toHaveText(saved)
  const revision = async () => (await stack.post("/decks/open", { deck }, cookie)).json.revision as number
  const before = await revision()
  let held = 0
  await page.route(
    (url) => url.pathname === "/decks/commit",
    async (route) => {
      held += 1
      await new Promise((resolve) => setTimeout(resolve, 2500))
      await route.fallback()
    },
  )
  await typeAtEnd(page, "!")
  await expect(saveStatus(page)).toHaveText(saving)
  expect(await revision()).toBe(before)
  await expect(saveStatus(page)).toHaveText(saved, { timeout: 15_000 })
  expect(held).toBeGreaterThan(0)
  expect(await revision()).toBeGreaterThan(before)
})

test("a server that cannot be reached reads the unreached words, then Saved once it answers with no new edit", async ({
  page,
  context,
  stack,
}) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await openClean(page)
  const blocked = (url: URL) => url.pathname.startsWith("/decks/")
  await page.route(blocked, (route) => route.abort("connectionfailed"))
  await typeAtEnd(page, "!")
  await expect(saveStatus(page)).toHaveText(unreached)
  await page.unroute(blocked)
  await expect(saveStatus(page)).toHaveText(saved, { timeout: 15_000 })
})

const unreadable = [
  { name: "an error page from the proxy", status: 500, contentType: "text/html", body: "<html>Error</html>" },
  {
    name: "the server's own failure",
    status: 500,
    contentType: "application/json",
    body: '{"ok":false,"refusal":"server"}',
  },
]

for (const answer of unreadable) {
  test(`${answer.name} reads the unreached words, then Saved once the server answers with no new edit`, async ({
    page,
    context,
    stack,
  }) => {
    const cookie = await stack.signIn()
    await signInBrowser(context, cookie)
    await forward(page, stack)
    const deck = await openClean(page)
    const revision = async () => (await stack.post("/decks/open", { deck }, cookie)).json.revision as number
    const before = await revision()
    const commit = (url: URL) => url.pathname === "/decks/commit"
    await page.route(commit, (route) =>
      route.fulfill({ status: answer.status, contentType: answer.contentType, body: answer.body }),
    )
    await typeAtEnd(page, "!")
    await expect(saveStatus(page)).toHaveText(unreached)
    await page.unroute(commit)
    await expect(saveStatus(page)).toHaveText(saved, { timeout: 15_000 })
    expect(await revision()).toBe(before + 1)
  })
}

test("an edit that landed but whose answer came back cut off lands once when it is sent again", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  const revision = async () => (await stack.post("/decks/open", { deck }, cookie)).json.revision as number
  const before = await revision()
  const commit = (url: URL) => url.pathname === "/decks/commit"
  let cut = 0
  await page.route(commit, async (route) => {
    if (cut > 0) return route.fallback()
    cut += 1
    const landed = await route.fetch({
      url: `${stack.origin}/decks/commit`,
      headers: await route.request().allHeaders(),
    })
    return route.fulfill({ response: landed, body: (await landed.text()).slice(0, 10) })
  })
  await typeAtEnd(page, "!")
  await expect.poll(() => cut).toBe(1)
  await expect(saveStatus(page)).toHaveText(saved, { timeout: 15_000 })
  expect(await revision()).toBe(before + 1)
})

test("going offline reads Offline before any edit, and Saved again when the browser is back", async ({
  page,
  context,
  stack,
}) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await openClean(page)
  await expect(saveStatus(page)).toHaveText(saved)
  await context.setOffline(true)
  await expect(saveStatus(page)).toHaveText(offline)
  await context.setOffline(false)
  await expect(saveStatus(page)).toHaveText(saved)
})

for (const [step, button] of [
  ["an added slide", "Add slide"],
  ["an added text box", "Add text box"],
] as const) {
  test(`${step} reads Saving while its commit waits and Saved once the server takes it`, async ({
    page,
    context,
    stack,
  }) => {
    await signInBrowser(context, await stack.signIn())
    await forward(page, stack)
    await openClean(page)
    await expect(saveStatus(page)).toHaveText(saved)
    let release = () => undefined as void
    const released = new Promise<void>((resolve) => (release = resolve))
    await page.route(
      (url) => url.pathname === "/decks/commit",
      async (route) => {
        await released
        await route.fallback()
      },
    )
    await page.getByRole("button", { name: button, exact: true }).click()
    await expect(saveStatus(page)).toHaveText(saving)
    release()
    await expect(saveStatus(page)).toHaveText(saved)
  })
}

const refusals = [
  {
    refusal: "storage",
    status: 200,
    says: "Unable to save. AirDesign's storage failed, so edits are saved on this device. Reload to try again.",
  },
  {
    refusal: "size",
    status: 413,
    says: "Unable to save. These edits are larger than a deck allows, so they stay on this device. Export to keep a copy.",
  },
]

for (const answer of refusals) {
  test(`a commit the server refuses with ${answer.refusal} says why it is not saved and is not sent again`, async ({
    page,
    context,
    stack,
  }) => {
    const cookie = await stack.signIn()
    await signInBrowser(context, cookie)
    await forward(page, stack)
    const deck = await openClean(page)
    const revision = async () => (await stack.post("/decks/open", { deck }, cookie)).json.revision as number
    const before = await revision()
    let sent = 0
    await page.route(
      (url) => url.pathname === "/decks/commit",
      (route) => {
        sent += 1
        return route.fulfill({ status: answer.status, json: { ok: false, refusal: answer.refusal } })
      },
    )
    await typeAtEnd(page, "!")
    await expect(saveStatus(page)).toHaveText("Unable to save")
    await expect(page.getByText(answer.says)).toBeVisible()
    const refused = sent
    await page.waitForTimeout(2500)
    expect(sent).toBe(refused)
    await expect(saveStatus(page)).toHaveText("Unable to save")
    expect(await revision()).toBe(before)
  })
}

test("a commit answered newer shows that AirDesign has a new version with Reload, and sends nothing more", async ({
  page,
  context,
  stack,
}) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await openClean(page)
  let sent = 0
  await page.route(
    (url) => url.pathname === "/decks/commit",
    (route) => {
      sent += 1
      return route.fulfill({ status: 200, json: { ok: false, refusal: "newer" } })
    },
  )
  await typeAtEnd(page, "!")
  await expect(page.getByText("AirDesign has a new version")).toBeVisible()
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible()
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
  const refused = sent
  await page.waitForTimeout(2500)
  expect(sent).toBe(refused)
})
