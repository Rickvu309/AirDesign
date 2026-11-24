import * as doom from "@airdesign/doom"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { typingPreview } from "./typing-preview"

const typed = (chars: string): readonly doom.Write[] => [{ node: doom.nodeId("t:1"), prop: "name", value: chars }]
const [first, second] = [doom.nodeId("slide:1"), doom.nodeId("slide:2")]

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it("shows the latest typing at most every 150 ms, and the end of typing at once", () => {
  const preview = typingPreview()
  const heard = vi.fn()
  preview.subscribe(heard)
  const [a, ab, abc] = [typed("a"), typed("ab"), typed("abc")]
  preview.set(a, first)
  preview.set(ab, first)
  expect(preview.writesOn(first)).toEqual([])
  vi.advanceTimersByTime(150)
  expect(preview.writesOn(first)).toBe(ab)
  expect(heard).toHaveBeenCalledTimes(1)
  preview.set(abc, first)
  preview.set([], undefined)
  expect(preview.writesOn(first)).toEqual([])
  expect(heard).toHaveBeenCalledTimes(2)
  vi.advanceTimersByTime(150)
  expect(heard).toHaveBeenCalledTimes(2)
})

it("keeps the typing on the slide it was typed on while another slide is shown", () => {
  const preview = typingPreview()
  const words = typed("Typed then left")
  preview.set(words, first)
  vi.advanceTimersByTime(150)
  expect(preview.writesOn(first)).toBe(words)
  expect(preview.writesOn(second)).toEqual([])
  const later = typed("Typed then left behind")
  preview.set(later, first)
  vi.advanceTimersByTime(150)
  expect(preview.writesOn(first)).toBe(later)
  expect(preview.writesOn(second)).toEqual([])
})
