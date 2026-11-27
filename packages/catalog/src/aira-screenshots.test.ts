import { expect, it } from "vitest"

import {
  airaScreenshotCap,
  screenshotLeftOut,
  screenshotsIn,
  readTurn,
  sentWithoutScreenshots,
  type ModelMessage,
} from "./aira-turn.js"
import { screenshotBytes } from "./slide-screenshots-wire.js"

const deck = "airadeck"
const read = (id: string) => ({
  type: "tool_use",
  id,
  name: "airdesign_execute",
  input: { deck, script: 'screenshot({ target: "s:256" })' },
})
const image = (data = "/9j/4AAQSkZJRg==") => ({
  type: "image",
  source: { type: "base64", media_type: "image/jpeg", data },
})
const screenshotted = (id: string, images = [image()]) => ({
  type: "tool_result",
  tool_use_id: id,
  content: [{ type: "text", text: "Slide 1 (256) at revision 4:" }, ...images],
})
const asked = { role: "user", content: "Look at slide one." }
const reading = (id: string) => ({ role: "assistant", content: [read(id)] })

it("reads a screenshot in the newest answer and refuses one sent again in an older answer", () => {
  const newest = [asked, reading("toolu_a"), { role: "user", content: [screenshotted("toolu_a")] }]
  const read = readTurn({ deck, messages: newest })
  expect(read.ok).toBe(true)
  if (read.ok) expect(screenshotsIn(read.messages)).toEqual([image()])
  const older = [
    ...newest,
    reading("toolu_b"),
    { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_b", content: "{}" }] },
  ]
  expect(readTurn({ deck, messages: older })).toEqual({ ok: false })
  const kept = [
    asked,
    reading("toolu_a"),
    sentWithoutScreenshots({ role: "user", content: [screenshotted("toolu_a")] } as unknown as ModelMessage),
    reading("toolu_b"),
    { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_b", content: "{}" }] },
  ]
  const healed = readTurn({ deck, messages: kept })
  expect(healed.ok).toBe(true)
  expect(JSON.stringify(kept)).toContain(screenshotLeftOut)
})

it("refuses a screenshot that is not a JPEG, too large, not base64, or one past the cap", () => {
  const turn = (images: unknown[]) => [
    asked,
    reading("toolu_a"),
    { role: "user", content: [screenshotted("toolu_a", images as never)] },
  ]
  const png = { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } }
  expect(readTurn({ deck, messages: turn([png]) })).toEqual({ ok: false })
  expect(readTurn({ deck, messages: turn([image("A".repeat(screenshotBytes + 4))]) })).toEqual({ ok: false })
  expect(readTurn({ deck, messages: turn([image("not base64!")]) })).toEqual({ ok: false })
  const url = { type: "image", source: { type: "url", url: "https://example.com/a.jpg" } }
  expect(readTurn({ deck, messages: turn([url]) })).toEqual({ ok: false })
  expect(readTurn({ deck, messages: turn(Array.from({ length: airaScreenshotCap }, () => image())) }).ok).toBe(true)
  expect(readTurn({ deck, messages: turn(Array.from({ length: airaScreenshotCap + 1 }, () => image())) })).toEqual({
    ok: false,
  })
})
