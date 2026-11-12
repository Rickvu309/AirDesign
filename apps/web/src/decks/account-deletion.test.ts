import { expect, it } from "vitest"
import { askDeletion, matchesEmail } from "./account-deletion"

it("matches only a known email, ignoring case and the spaces around what was typed", () => {
  expect(matchesEmail(" Home@Example.com ", "home@example.com")).toBe(true)
  expect(matchesEmail("other@example.com", "home@example.com")).toBe(false)
  expect(matchesEmail("", "")).toBe(false)
  expect(matchesEmail("  ", "")).toBe(false)
})

function answering(status: number): typeof fetch {
  return async () => new Response("{}", { status })
}

it("reports a deleted account, a signed-out person, and every other answer as refused", async () => {
  expect(await askDeletion("home@example.com", answering(200))).toBe("deleted")
  expect(await askDeletion("home@example.com", answering(401))).toBe("signed-out")
  expect(await askDeletion("home@example.com", answering(400))).toBe("refused")
  expect(await askDeletion("home@example.com", answering(500))).toBe("refused")
  expect(
    await askDeletion("home@example.com", async () => {
      throw new TypeError("offline")
    }),
  ).toBe("refused")
})

it("posts the email as json to the account delete route", async () => {
  const seen: { url: string; method: string | undefined; body: unknown }[] = []
  await askDeletion("home@example.com", async (url, init) => {
    seen.push({ url: String(url), method: init?.method, body: JSON.parse(String(init?.body)) })
    return new Response("{}", { status: 200 })
  })
  expect(seen).toEqual([{ url: "/account/delete", method: "POST", body: { email: "home@example.com" } }])
})
