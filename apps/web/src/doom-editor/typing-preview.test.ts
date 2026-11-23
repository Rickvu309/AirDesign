import * as doom from "@airdesign/doom"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { typingPreview } from "./typing-preview"

const typed = (chars: string): readonly doom.Write[] => [{ node: doom.nodeId("t:1"), prop: "name", value: chars }]

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it("shows the latest typing at most every 150 ms, and the end of typing at once", () => {
  const preview = typingPreview()
  const heard = vi.fn()
  preview.subscribe(heard)
  const [a, ab, abc] = [typed("a"), typed("ab"), typed("abc")]
  preview.set(a)
  preview.set(ab)
  expect(preview.writes()).toEqual([])
  vi.advanceTimersByTime(150)
  expect(preview.writes()).toBe(ab)
  expect(heard).toHaveBeenCalledTimes(1)
  preview.set(abc)
  preview.set([])
  expect(preview.writes()).toEqual([])
  expect(heard).toHaveBeenCalledTimes(2)
  vi.advanceTimersByTime(150)
  expect(heard).toHaveBeenCalledTimes(2)
})
