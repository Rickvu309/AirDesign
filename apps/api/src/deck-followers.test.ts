import { expect, it } from "vitest"
import { DeckFollowers, followGrace } from "./deck-followers.js"

it("counts a deck followed while a tab watches it and for a short grace after its watch answers", () => {
  let now = 0
  const followers = new DeckFollowers(() => now)
  expect(followers.following("deck")).toBe(false)
  const first = followers.follow("deck")
  const second = followers.follow("deck")
  first()
  first()
  expect(followers.following("deck")).toBe(true)
  second()
  now = followGrace - 1
  expect(followers.following("deck")).toBe(true)
  now = followGrace
  expect(followers.following("deck")).toBe(false)
  expect(followers.following("other")).toBe(false)
})
