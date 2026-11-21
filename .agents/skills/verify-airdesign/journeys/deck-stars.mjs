import path from "node:path"
import { expect } from "@playwright/test"

export default async function drive(kit) {
  const {
    repo,
    page,
    context,
    signIn,
    post,
    mailParts,
    capture,
    note,
    deckRoutes,
    signInRoutes,
    holdReply,
    failReply,
  } = kit
  const { cookie, email } = await signIn()
  note(`signed in as ${email} through the emailed code`)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  const serverStar = async (as = cookie) =>
    (await post(deckRoutes.list, {}, as)).json.decks?.find((entry) => entry.deck === deck)?.starred
  const starred = page.getByRole("navigation", { name: "Starred" })
  const starredLink = starred.getByRole("link", { name: "clean" })
  await expect
    .poll(async () => (await post(deckRoutes.list, {}, cookie)).json.decks?.find((entry) => entry.deck === deck)?.name)
    .toBe("clean")

  await page.goto("/")
  await expect(page.getByRole("heading", { name: "clean", exact: true })).toBeVisible()
  await expect(starred).toContainText("Star a deck to keep it here.")
  await capture("home-no-stars")
  await page.getByRole("button", { name: "Star clean" }).click()
  await expect(starredLink).toHaveAttribute("href", `/deck/${deck}`)
  await expect(page.getByRole("button", { name: "Remove star from clean" })).toBeFocused()
  await capture("starred")
  await expect.poll(() => serverStar()).toBe(true)
  note(`Star clean: the sidebar lists clean under Starred at once, and ${deckRoutes.list.path} says starred: true`)
  await page.reload()
  await expect(starredLink).toBeVisible()
  note("after a reload the deck is still under Starred")

  const restoreStar = await failReply(deckRoutes.star)
  const { release } = await holdReply(deckRoutes.star)
  await page.getByRole("button", { name: "Remove star from clean" }).click()
  await expect(starred).toContainText("Star a deck to keep it here.")
  await capture("unstar-held")
  expect(await serverStar()).toBe(true)
  await release()
  await page.reload()
  await expect(starred).toContainText("Star a deck to keep it here.")
  expect(await serverStar()).toBe(true)
  await capture("unstar-failed-still-shown")
  note(
    "Remove star while the send was held, then failed: Home showed no star at once and after a reload; the server still said starred",
  )
  await restoreStar()
  await page.reload()
  await expect.poll(() => serverStar()).toBe(false)
  note(`after the network came back, a reload sent the queued removal: ${deckRoutes.list.path} says starred: false`)

  await page.getByRole("button", { name: "Star clean" }).click()
  await expect.poll(() => serverStar()).toBe(true)
  await page.getByRole("button", { name: email }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/airdesign\.app\/sign-in/)

  const second = await signIn()
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "No decks yet" })).toBeVisible()
  await expect(starred).toContainText("Star a deck to keep it here.")
  await expect(starred.getByRole("link")).toHaveCount(0)
  await capture("second-account-no-stars")
  note(`a second account (${second.email}) on the same browser sees no Starred decks`)

  await post(signInRoutes.email, { email })
  const { code } = await mailParts(email)
  const back = await post(signInRoutes.code, { email, code })
  const split = back.cookie.indexOf("=")
  await context.addCookies([
    {
      name: back.cookie.slice(0, split),
      value: back.cookie.slice(split + 1),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ])
  await page.goto("/")
  await expect(starredLink).toBeVisible()
  await capture("signed-back-in")
  note(`signed out, signed in as ${second.email}, then back in as ${email}: clean is under Starred again`)
}
