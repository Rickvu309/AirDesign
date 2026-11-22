import { expect, it } from "vitest"
import { withCurrentKeys } from "./current-keys.js"
import { readTextValue } from "./text-value.js"

it("shows a stored text with an older key under today's name, the same paragraphs", () => {
  const stored = '[{"from":0,"lineSpacing":150000,"runs":[{"from":-1,"text":"Quarterly plan"}]}]'
  const shown = withCurrentKeys(stored)
  expect(shown).toContain('"lineHeight":150000')
  expect(shown).not.toContain("lineSpacing")
  expect(readTextValue(shown)).toEqual(readTextValue(stored))
})

it("hands back every other value as the same string", () => {
  const today = '[{"from":0,"lineHeight":150000,"runs":[{"from":-1,"text":"Quarterly plan"}]}]'
  expect(withCurrentKeys(today)).toBe(today)
  const plain = '[{"from":0,"lineSpacing":120000}]'
  expect(withCurrentKeys(plain)).toBe(plain)
  const typed = 'He wrote "lineSpacing": 2'
  expect(withCurrentKeys(typed)).toBe(typed)
})
