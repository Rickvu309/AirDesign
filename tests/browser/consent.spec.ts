import { expect, test, type Page } from "@playwright/test"
import {
  claudeCodeConnect,
  claudeConnect,
  codexConnect,
  otherConnect,
  refusedConnect,
  unavailableConnect,
} from "../../apps/web/src/copy/connect-copy"
import { productCopy } from "../../apps/web/src/copy/product-copy"

test.use({ reducedMotion: "reduce" })

const redirectUri = "https://client.example/callback"
const state = "state /&="
const challenge = "challenge"
const accountEmail = "account@example.com"

function authorizePath(overrides: Record<string, string | null> = {}) {
  const fields: Record<string, string> = {
    response_type: "code",
    client_id: "client-id",
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) delete fields[key]
    else fields[key] = value
  }
  return `/oauth/authorize?${new URLSearchParams(fields)}`
}

const refusedWords = refusedConnect.title

async function expectRefusedInPlace(page: Page) {
  await expect(page.getByRole("heading", { name: refusedWords, exact: true })).toBeVisible()
  await expect(page.getByText(refusedConnect.body, { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: refusedConnect.action, exact: true })).toHaveAttribute("href", "/")
  await expect(page.locator("button")).toHaveCount(0)
  await expect(page).toHaveURL(/\/oauth\/authorize/)
  expect(await page.evaluate(() => Reflect.get(window, "__pwn"))).toBeUndefined()
}

async function answerClient(page: Page, payload: Record<string, unknown>, status = 200) {
  await page.route("**/oauth/client", async (route) => {
    await route.fulfill({ status, json: payload })
  })
  await page.route("**/decks/list", async (route) => {
    await route.fulfill({ json: { ok: true, account: { email: accountEmail }, decks: [] } })
  })
}

async function openConsent(
  page: Page,
  payload: Record<string, unknown> = {
    ok: true,
    client_name: "<img src=x onerror=alert(1)>",
    screen: "claude",
    redirect_host: "claude.ai",
  },
  path = authorizePath(),
) {
  await answerClient(page, payload)
  await page.goto(path)
  await expect(page.getByRole("button", { name: "Allow", exact: true })).toBeVisible()
}

for (const screen of [
  {
    name: "Claude",
    title: claudeConnect.title,
    subtitle: claudeConnect.subtitle,
    ability: claudeConnect.ability,
    footer: claudeConnect.footer,
    screen: "claude",
    marks: 2,
  },
  {
    name: "Claude Code",
    title: claudeCodeConnect.title,
    subtitle: claudeConnect.subtitle,
    ability: claudeCodeConnect.ability,
    footer: claudeCodeConnect.footer,
    screen: "claude-code",
    marks: 2,
  },
  {
    name: "Codex",
    title: codexConnect.title,
    subtitle: claudeConnect.subtitle,
    ability: codexConnect.ability,
    footer: codexConnect.footer,
    screen: "codex",
    marks: 2,
  },
  {
    name: "other",
    title: otherConnect("tool.example").title,
    subtitle: claudeConnect.subtitle,
    ability: otherConnect("tool.example").ability,
    footer: otherConnect("tool.example").footer,
    screen: "other",
    marks: 1,
  },
]) {
  test(`${screen.name} shows its title and mark`, async ({ page }) => {
    await openConsent(page, {
      ok: true,
      client_name: "Claude",
      screen: screen.screen,
      redirect_host: "tool.example",
    })

    await expect(page.getByRole("heading", { name: screen.title, exact: true })).toBeVisible()
    await expect(page.getByText(screen.subtitle, { exact: true })).toBeVisible()
    await expect(page.getByText(screen.ability, { exact: true })).toBeVisible()
    await expect(page.getByText(screen.footer, { exact: true })).toBeVisible()
    await expect(page.getByRole("listitem")).toHaveText(["Read and edit all your decks"])
    await expect(page.getByText(/Uses your weekly usage/)).toHaveCount(0)
    await expect(page.locator("main > section > div").first().locator("svg")).toHaveCount(screen.marks)
    if (screen.screen === "other") await expect(page.getByText("Claude", { exact: true })).toHaveCount(0)
  })
}

test("the consent account shows its email and first initial", async ({ page }) => {
  await openConsent(page)

  await expect(page.getByText(accountEmail, { exact: true })).toHaveCount(1)
  await expect(page.getByText("A", { exact: true })).toBeVisible()
})

test("the other screen uses only its redirect host", async ({ page }) => {
  await openConsent(page, {
    ok: true,
    client_name: "<img src=x onerror=alert(1)>",
    screen: "other",
    redirect_host: "tool.example",
  })

  await expect(page.getByRole("heading", { name: otherConnect("tool.example").title, exact: true })).toBeVisible()
  await expect(page.getByText("Claude", { exact: true })).toHaveCount(0)
  await expect(page.locator("img")).toHaveCount(0)
  await expect(page.getByText("<img src=x onerror=alert(1)>", { exact: true })).toHaveCount(0)
})

test("client check and account lookup send only their agreed bodies", async ({ page }) => {
  let clientBody: unknown
  let accountBody: unknown
  await page.route("**/oauth/client", async (route) => {
    clientBody = route.request().postDataJSON()
    await route.fulfill({
      json: { ok: true, client_name: "ignored", screen: "claude", redirect_host: "claude.ai" },
    })
  })
  await page.route("**/decks/list", async (route) => {
    accountBody = route.request().postDataJSON()
    await route.fulfill({ json: { ok: true, account: { email: accountEmail }, decks: [] } })
  })
  await page.goto(authorizePath({ scope: "everything", resource: "https://api.example/resource" }))
  await expect(page.getByRole("button", { name: "Allow", exact: true })).toBeVisible()

  expect(clientBody).toEqual({
    client_id: "client-id",
    redirect_uri: redirectUri,
    resource: "https://api.example/resource",
  })
  expect(accountBody).toEqual({})
})

for (const refusal of ["client", "redirect", "resource", "field"]) {
  test(`a ${refusal} refusal never shows consent or redirects`, async ({ page }) => {
    await answerClient(page, { ok: false, refusal }, 400)
    await page.goto(authorizePath())

    await expectRefusedInPlace(page)
    await expect(page.getByRole("button", { name: "Allow", exact: true })).toHaveCount(0)
  })
}

test("a signed-out account goes to sign-in with the intact authorization address", async ({ page }) => {
  await answerClient(page, { ok: false, refusal: "session" }, 401)
  await page.route("**/sign-in**", (route) => route.fulfill({ contentType: "text/html", body: "<p>sign in</p>" }))
  await page.goto(authorizePath({ resource: "https://api.example/resource" }))

  await expect(page).toHaveURL((url) => {
    const signIn = new URL(process.env.VITE_SIGN_IN_URL ?? "/sign-in", url.origin)
    const current = new URL(url)
    return (
      current.pathname === signIn.pathname &&
      current.searchParams.get("next") ===
        `/oauth/authorize?${new URLSearchParams({
          response_type: "code",
          client_id: "client-id",
          redirect_uri: redirectUri,
          code_challenge: challenge,
          code_challenge_method: "S256",
          state,
          resource: "https://api.example/resource",
        })}`
    )
  })
})

test("Allow sends only the agreed fields and follows the answered redirect", async ({ page }) => {
  let body: unknown
  let posts = 0
  const target = `${redirectUri}?code=approved`
  await openConsent(
    page,
    {
      ok: true,
      client_name: "ignored",
      screen: "claude",
      redirect_host: "claude.ai",
    },
    authorizePath({ scope: "everything", resource: "https://api.example/resource" }),
  )
  await page.route("**/oauth/approve", async (route) => {
    posts += 1
    body = route.request().postDataJSON()
    await route.fulfill({ json: { ok: true, redirect: target } })
  })
  await page.route("https://client.example/**", async (route) => {
    await route.fulfill({ body: "returned" })
  })

  await page.getByRole("button", { name: "Allow", exact: true }).click()

  await expect(page.getByRole("heading", { name: claudeConnect.connectedTitle, exact: true })).toBeVisible()
  await expect(page.getByText(claudeConnect.connectedSubtitle, { exact: true })).toBeVisible()
  await expect(page).toHaveURL(target)
  expect(posts).toBe(1)
  expect(body).toEqual({
    client_id: "client-id",
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    resource: "https://api.example/resource",
  })
})

test("Allow omits absent state and resource", async ({ page }) => {
  let body: unknown
  await openConsent(
    page,
    { ok: true, client_name: "ignored", screen: "codex", redirect_host: "codex" },
    authorizePath({ state: null, resource: null }),
  )
  await page.route("**/oauth/approve", async (route) => {
    body = route.request().postDataJSON()
    await route.fulfill({ json: { ok: true, redirect: `${redirectUri}?code=approved` } })
  })
  await page.route("https://client.example/**", async (route) => {
    await route.fulfill({ body: "returned" })
  })

  await page.getByRole("button", { name: "Allow", exact: true }).click()
  await expect(page).toHaveURL(`${redirectUri}?code=approved`)

  expect(body).toEqual({
    client_id: "client-id",
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
  })
})

test("Allow can be clicked twice but posts once", async ({ page }) => {
  let posts = 0
  await openConsent(page)
  await page.route("**/oauth/approve", async (route) => {
    posts += 1
    await route.fulfill({ json: { ok: true, redirect: `${redirectUri}?code=approved` } })
  })
  await page.route("https://client.example/**", async (route) => {
    await route.fulfill({ body: "returned" })
  })

  await page.getByRole("button", { name: "Allow", exact: true }).evaluate((element) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })

  await expect(page).toHaveURL(`${redirectUri}?code=approved`)
  expect(posts).toBe(1)
})

test("an approve refusal shows the refused words and does not navigate", async ({ page }) => {
  await openConsent(page)
  await page.route("**/oauth/approve", async (route) => {
    await route.fulfill({ status: 400, json: { ok: false, refusal: "challenge" } })
  })

  await page.getByRole("button", { name: "Allow", exact: true }).click()

  await expectRefusedInPlace(page)
})

test("Deny posts nothing and preserves the callback query and state", async ({ page }) => {
  let approvePosts = 0
  const callbackWithQuery = `${redirectUri}?keep=yes&error=old`
  await answerClient(page, {
    ok: true,
    client_name: "ignored",
    screen: "claude-code",
    redirect_host: "claude.ai",
  })
  await page.route("**/oauth/approve", async (route) => {
    approvePosts += 1
    await route.fulfill({ json: { ok: true, redirect: `${redirectUri}?code=unexpected` } })
  })
  await page.route("https://client.example/**", async (route) => {
    await route.fulfill({ body: "returned" })
  })
  await page.goto(authorizePath({ redirect_uri: callbackWithQuery }))
  await page.getByRole("button", { name: productCopy.cancel, exact: true }).click()

  await expect(page).toHaveURL((url) => {
    const current = new URL(url)
    return (
      current.origin === "https://client.example" &&
      current.pathname === "/callback" &&
      current.searchParams.get("keep") === "yes" &&
      current.searchParams.get("error") === "access_denied" &&
      current.searchParams.get("state") === state
    )
  })
  expect(approvePosts).toBe(0)
})

for (const invalid of [
  { name: "an unsupported response type", query: { response_type: "token" }, error: "unsupported_response_type" },
  { name: "a missing challenge", query: { code_challenge: null }, error: "invalid_request" },
]) {
  test(`${invalid.name} redirects after validation without approval`, async ({ page }) => {
    let approvePosts = 0
    await answerClient(page, {
      ok: true,
      client_name: "ignored",
      screen: "claude",
      redirect_host: "claude.ai",
    })
    await page.route("**/oauth/approve", async (route) => {
      approvePosts += 1
      await route.fulfill({ json: { ok: true, redirect: `${redirectUri}?code=unexpected` } })
    })
    await page.route("https://client.example/**", async (route) => {
      await route.fulfill({ body: "returned" })
    })
    await page.goto(authorizePath(invalid.query))

    await expect(page).toHaveURL((url) => {
      const current = new URL(url)
      return current.searchParams.get("error") === invalid.error && current.searchParams.get("state") === state
    })
    expect(approvePosts).toBe(0)
  })
}

test("nothing is posted to approve before Allow", async ({ page }) => {
  let approvePosts = 0
  await page.route("**/oauth/approve", async (route) => {
    approvePosts += 1
    await route.fulfill({ json: { ok: true, redirect: `${redirectUri}?code=unexpected` } })
  })
  await openConsent(page)

  expect(approvePosts).toBe(0)
  await expect(page).toHaveURL(/\/oauth\/authorize/)
})

test("loading status offers no decision before the client is validated", async ({ page }) => {
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/oauth/client", async (route) => {
    await held
    await route.fulfill({
      json: { ok: true, client_name: "ignored", screen: "claude", redirect_host: "claude.ai" },
    })
  })
  await page.route("**/decks/list", async (route) => {
    await route.fulfill({ json: { ok: true, account: { email: accountEmail }, decks: [] } })
  })
  const asked = page.waitForRequest("**/oauth/client")
  await page.goto(authorizePath())
  await asked
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve))))

  await expect(page.locator("button")).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Connect an agent", exact: true })).toBeVisible()
  await expect(page.getByRole("status")).toHaveText("Loading connection request…")
  await expect(page.getByText("Claude wants to use AirDesign")).toHaveCount(0)

  release()

  await expect(page.getByRole("button", { name: "Allow", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: productCopy.cancel, exact: true })).toBeVisible()
})

const hostileAddress = "javascript:window.__pwn=1"

test("an approve answer that is not http or https shows the refused words and goes nowhere", async ({ page }) => {
  await page.clock.install()
  await openConsent(page)
  await page.route("**/oauth/approve", async (route) => {
    await route.fulfill({ json: { ok: true, redirect: hostileAddress } })
  })

  await page.getByRole("button", { name: "Allow", exact: true }).click()

  await expectRefusedInPlace(page)
  await expect(page.getByRole("heading", { name: claudeConnect.connectedTitle, exact: true })).toHaveCount(0)
  await page.clock.runFor(2000)
  await expectRefusedInPlace(page)
})

test("Deny with a cleared address that is not http or https shows the refused words and goes nowhere", async ({
  page,
}) => {
  await openConsent(
    page,
    { ok: true, client_name: "ignored", screen: "claude", redirect_host: "claude.ai" },
    authorizePath({ redirect_uri: `${hostileAddress};//` }),
  )

  await page.getByRole("button", { name: productCopy.cancel, exact: true }).click()

  await expectRefusedInPlace(page)
})

for (const invalid of [
  { name: "an unsupported response type", query: { response_type: "token" } },
  { name: "a missing challenge", query: { code_challenge: null } },
]) {
  test(`${invalid.name} with a cleared address that is not http or https goes nowhere`, async ({ page }) => {
    await answerClient(page, { ok: true, client_name: "ignored", screen: "claude", redirect_host: "claude.ai" })

    await page.goto(authorizePath({ ...invalid.query, redirect_uri: `${hostileAddress};//` }))

    await expectRefusedInPlace(page)
  })
}

test("Switch signs out and returns to this consent request after sign-in", async ({ page }) => {
  let signOuts = 0
  await openConsent(page)
  await page.route("**/sign-out", async (route) => {
    signOuts += 1
    await route.fulfill({ json: { ok: true } })
  })
  await page.route("**/sign-in**", (route) => route.fulfill({ contentType: "text/html", body: "<p>sign in</p>" }))

  await page.getByRole("button", { name: "Switch", exact: true }).click()

  await expect(page).toHaveURL((url) => {
    const signIn = new URL(process.env.VITE_SIGN_IN_URL ?? "/sign-in", url.origin)
    return url.pathname === signIn.pathname && new URL(url).searchParams.get("next") === authorizePath()
  })
  expect(signOuts).toBe(1)
})

test("Switch offers recovery when sign-out fails", async ({ page }) => {
  await openConsent(page)
  await page.route("**/sign-out", (route) => route.fulfill({ status: 500, json: { ok: false } }))

  await page.getByRole("button", { name: "Switch", exact: true }).click()

  await expect(page.getByRole("link", { name: unavailableConnect.action })).toHaveAttribute("href", authorizePath())
  await expect(page).toHaveURL(/\/oauth\/authorize/)
})

for (const width of [320, 390, 1470]) {
  test(`consent and recovery fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await openConsent(page, { ok: true, screen: "other", redirect_host: "a-very-long-agent-hostname.example.com" })
    for (const name of [productCopy.cancel, "Allow", "Switch"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeInViewport()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await answerClient(page, { ok: false, refusal: "client" }, 400)
    await page.reload()
    await expect(page.getByRole("link", { name: "Back to AirDesign" })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  })
}

test("the account lookup shows loading status and approval prevents another decision", async ({ page }) => {
  let releaseAccount: () => void = () => {}
  const accountWait = new Promise<void>((resolve) => {
    releaseAccount = resolve
  })
  await answerClient(page, { ok: true, screen: "claude", redirect_host: "claude.ai" })
  await page.route("**/decks/list", async (route) => {
    await accountWait
    await route.fulfill({ json: { ok: true, account: { email: accountEmail }, decks: [] } })
  })
  await page.goto(authorizePath())
  await expect(page.getByRole("heading", { name: "Claude wants to use AirDesign" })).toBeVisible()
  await expect(page.getByRole("status")).toHaveText("Loading connection request…")
  releaseAccount()
  await expect(page.getByRole("button", { name: "Allow", exact: true })).toBeVisible()
  let releaseApproval: () => void = () => {}
  const approvalWait = new Promise<void>((resolve) => {
    releaseApproval = resolve
  })
  await page.route("**/oauth/approve", async (route) => {
    await approvalWait
    await route.fulfill({ status: 503, json: { ok: false } })
  })
  await page.getByRole("button", { name: "Allow", exact: true }).click()
  await expect(page.getByRole("button", { name: "Allowing…" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Allowing…" })).toHaveAttribute("aria-busy", "true")
  await expect(page.getByRole("button", { name: productCopy.cancel, exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Switch", exact: true })).toBeDisabled()
  releaseApproval()
  await expect(page.getByRole("link", { name: unavailableConnect.action })).toBeVisible()
})
