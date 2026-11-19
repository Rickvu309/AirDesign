import { expect, type Page, type Request } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { forward, openClean, settled, signInBrowser, test } from "./api-stack"

test.use({ viewport: { width: 1600, height: 1000 } })

const saved = "Saved"
const saving = "Saving…"
const offline = "Offline, saved on this device"
const unreached = "Unable to reach AirDesign"

function saveStatus(page: Page) {
  return page.locator("[data-save-status]")
}

async function browserNetwork(page: Page, online: boolean): Promise<void> {
  await page.evaluate((online) => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: online })
    window.dispatchEvent(new Event(online ? "online" : "offline"))
  }, online)
}

async function typeAtEnd(page: Page, text: string): Promise<void> {
  const editor = page.locator('[contenteditable="true"]')
  await editor.dblclick()
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
  const statusBox = await saveStatus(page).boundingBox()
  expect(statusBox?.width).toBeLessThanOrEqual(1)
  expect(statusBox?.height).toBeLessThanOrEqual(1)
  const revision = async () => (await stack.post("/decks/open", { deck }, cookie)).json.revision as number
  const before = await revision()
  const released = Promise.withResolvers<void>()
  const held = Promise.withResolvers<void>()
  await page.route("**/decks/commit", async (route) => {
    held.resolve()
    await released.promise
    await route.fallback()
  })
  try {
    await typeAtEnd(page, "!")
    await held.promise
    await expect(saveStatus(page)).toHaveText(saving)
    expect(await revision()).toBe(before)
  } finally {
    released.resolve()
  }
  await expect(saveStatus(page)).toHaveText(saved, { timeout: 15_000 })
  expect(await revision()).toBe(before + 1)
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
  let first: Request | undefined
  await page.route(commit, async (route) => {
    if (cut > 0) return route.fallback()
    cut += 1
    first = route.request()
    const landed = await route.fetch({
      url: `${stack.origin}/decks/commit`,
      headers: await route.request().allHeaders(),
    })
    return route.fulfill({ response: landed, body: (await landed.text()).slice(0, 10) })
  })
  const acknowledged = page.waitForResponse(
    (response) => commit(new URL(response.url())) && response.request() !== first,
    { timeout: 15_000 },
  )
  await typeAtEnd(page, "!")
  await expect.poll(() => cut).toBe(1)
  const retried = await acknowledged
  expect(retried.request().postData()).toBe(first?.postData())
  expect(await retried.json()).toMatchObject({ ok: true, revision: before + 1 })
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

test("going offline and back while a resend is on the wire reads Saved once it lands", async ({
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
  let down = true
  let held = 0
  let release = () => undefined as void
  const released = new Promise<void>((resolve) => (release = resolve))
  await page.route(
    (url) => url.pathname === "/decks/commit",
    async (route) => {
      if (down) return route.abort("connectionfailed")
      held += 1
      await released
      await route.fallback()
    },
  )
  await typeAtEnd(page, "!")
  await expect(saveStatus(page)).toHaveText(unreached)
  down = false
  await expect.poll(() => held, { timeout: 15_000 }).toBe(1)
  await browserNetwork(page, false)
  await expect(saveStatus(page)).toHaveText(offline)
  await browserNetwork(page, true)
  await expect(saveStatus(page)).toHaveText(unreached)
  release()
  await expect.poll(revision).toBe(before + 1)
  await expect(saveStatus(page)).toHaveText(saved)
})

for (const [step, button] of [
  ["an added slide", "Add slide"],
  ["an added text box", "Add text"],
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
    const released = Promise.withResolvers<void>()
    const held = Promise.withResolvers<void>()
    await page.route("**/decks/commit", async (route) => {
      held.resolve()
      await released.promise
      await route.fallback()
    })
    try {
      await page.getByRole("button", { name: button, exact: true }).click()
      await held.promise
      await expect(saveStatus(page)).toHaveText(saving)
    } finally {
      released.resolve()
    }
    await expect(saveStatus(page)).toHaveText(saved)
  })
}

function addSlide(page: Page) {
  return page.getByRole("button", { name: "Add slide", exact: true }).click()
}

function slide(page: Page, number: number, count: number) {
  return page.getByRole("button", { name: slideListCopy.slideName(number, count), exact: true })
}

async function typeOnFirstSlide(page: Page) {
  await slide(page, 1, 2).click()
  await typeAtEnd(page, "!")
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.text })).toBeEnabled()
}

async function addThirdSlide(page: Page) {
  await addSlide(page)
  await expect(slide(page, 3, 3)).toBeVisible()
}

for (const { name, edit, sizeRefusal } of [
  { name: "typed edit", edit: typeOnFirstSlide, sizeRefusal: false },
  { name: "added slide", edit: addThirdSlide, sizeRefusal: false },
  { name: "typed edit refused for size", edit: typeOnFirstSlide, sizeRefusal: true },
]) {
  test(`an earlier commit cannot mark a later ${name} Saved`, async ({ page, context, stack }) => {
    const cookie = await stack.signIn()
    await signInBrowser(context, cookie)
    await forward(page, stack)
    const watching = page.waitForRequest("**/decks/watch")
    const deck = await openClean(page)
    await watching
    const revision = async () => (await stack.post("/decks/open", { deck }, cookie)).json.revision as number
    const before = await revision()
    const first = Promise.withResolvers<void>()
    const second = Promise.withResolvers<void>()
    let sent = 0
    await page.route("**/decks/commit", async (route) => {
      sent += 1
      const earlier = sent === 1
      await (earlier ? first.promise : second.promise)
      if (!earlier && sizeRefusal) {
        await route.fulfill({ status: 413, json: { ok: false, refusal: "size" } })
        return
      }
      await route.fallback()
    })

    try {
      await addSlide(page)
      await expect.poll(() => sent).toBe(1)
      await expect(saveStatus(page)).toHaveText(saving)
      await expect(slide(page, 2, 2)).toBeVisible()
      await edit(page)
      first.resolve()
      await expect.poll(() => sent).toBe(2)
      expect(await revision()).toBe(before + 1)
      if (!sizeRefusal) await expect(saveStatus(page)).toHaveText(saving)
    } finally {
      first.resolve()
      second.resolve()
    }

    await expect(saveStatus(page)).toHaveText(sizeRefusal ? "Unable to save" : saved)
    expect(await revision()).toBe(before + (sizeRefusal ? 1 : 2))
  })
}

test("a deck reopened with an edit still on the device reads Saving until that edit lands", async ({
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
  const committing = (url: URL) => url.pathname === "/decks/commit"
  await page.route(committing, (route) => route.abort("connectionfailed"))
  await typeAtEnd(page, "!")
  await expect(saveStatus(page)).toHaveText(unreached)
  await page.unroute(committing)
  let release = () => undefined as void
  const released = new Promise<void>((resolve) => (release = resolve))
  await page.route(committing, async (route) => {
    await released
    await route.fallback()
  })
  await page.reload()
  await settled(page)
  await expect(saveStatus(page)).toHaveText(saving)
  await page.waitForTimeout(1000)
  await expect(saveStatus(page)).toHaveText(saving)
  expect(await revision()).toBe(before)
  release()
  await expect(saveStatus(page)).toHaveText(saved, { timeout: 15_000 })
  expect(await revision()).toBeGreaterThan(before)
})

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
    const indexReached = Promise.withResolvers<void>()
    const releaseIndex = Promise.withResolvers<void>()
    await page.route("**/decks/index", async (route) => {
      indexReached.resolve()
      await releaseIndex.promise
      await route.fallback()
    })
    const deck = await openClean(page)
    const revision = async () => (await stack.post("/decks/open", { deck }, cookie)).json.revision as number
    const before = await revision()
    const watched = Promise.withResolvers<void>()
    await page.route("**/decks/watch", async (route) => {
      await page.unroute("**/decks/watch")
      const watching = page.waitForRequest("**/decks/watch")
      await route.fulfill({ json: { ok: true, deck, revision: before } })
      await watching
      watched.resolve()
    })
    let sent = 0
    await page.route(
      (url) => url.pathname === "/decks/commit",
      (route) => {
        sent += 1
        return route.fulfill({ status: answer.status, json: { ok: false, refusal: answer.refusal } })
      },
    )
    try {
      await indexReached.promise
      await typeAtEnd(page, "!")
      await expect(saveStatus(page)).toHaveText(saving)
    } finally {
      releaseIndex.resolve()
    }
    await watched.promise
    await expect(saveStatus(page)).toHaveText("Unable to save")
    await expect(page.getByText(answer.says)).toBeVisible()
    expect(sent).toBe(1)
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
