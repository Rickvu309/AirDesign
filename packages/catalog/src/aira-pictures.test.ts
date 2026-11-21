import { expect, it } from "vitest"

import {
  airaPictureCap,
  pictureLeftOut,
  picturesIn,
  readTurn,
  sentWithoutPictures,
  type ModelMessage,
} from "./aira-turn.js"
import { pictureBytes } from "./slide-pictures-wire.js"

const deck = "airadeck"
const read = (id: string) => ({
  type: "tool_use",
  id,
  name: "airdesign_read_deck",
  input: { deck, slide: "256", picture: true },
})
const image = (data = "/9j/4AAQSkZJRg==") => ({
  type: "image",
  source: { type: "base64", media_type: "image/jpeg", data },
})
const pictured = (id: string, images = [image()]) => ({
  type: "tool_result",
  tool_use_id: id,
  content: [{ type: "text", text: "Slide 1 (256) at revision 4:" }, ...images],
})
const asked = { role: "user", content: "Look at slide one." }
const reading = (id: string) => ({ role: "assistant", content: [read(id)] })

it("reads a picture in the newest answer and refuses one sent again in an older answer", () => {
  const newest = [asked, reading("toolu_a"), { role: "user", content: [pictured("toolu_a")] }]
  const read = readTurn({ deck, messages: newest })
  expect(read.ok).toBe(true)
  if (read.ok) expect(picturesIn(read.messages)).toEqual([image()])
  const older = [
    ...newest,
    reading("toolu_b"),
    { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_b", content: "{}" }] },
  ]
  expect(readTurn({ deck, messages: older })).toEqual({ ok: false })
  const kept = [
    asked,
    reading("toolu_a"),
    sentWithoutPictures({ role: "user", content: [pictured("toolu_a")] } as unknown as ModelMessage),
    reading("toolu_b"),
    { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_b", content: "{}" }] },
  ]
  const healed = readTurn({ deck, messages: kept })
  expect(healed.ok).toBe(true)
  expect(JSON.stringify(kept)).toContain(pictureLeftOut)
})

it("refuses a picture that is not a JPEG, too large, not base64, or one past the cap", () => {
  const turn = (images: unknown[]) => [
    asked,
    reading("toolu_a"),
    { role: "user", content: [pictured("toolu_a", images as never)] },
  ]
  const png = { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } }
  expect(readTurn({ deck, messages: turn([png]) })).toEqual({ ok: false })
  expect(readTurn({ deck, messages: turn([image("A".repeat(pictureBytes + 4))]) })).toEqual({ ok: false })
  expect(readTurn({ deck, messages: turn([image("not base64!")]) })).toEqual({ ok: false })
  const url = { type: "image", source: { type: "url", url: "https://example.com/a.jpg" } }
  expect(readTurn({ deck, messages: turn([url]) })).toEqual({ ok: false })
  expect(readTurn({ deck, messages: turn(Array.from({ length: airaPictureCap }, () => image())) }).ok).toBe(true)
  expect(readTurn({ deck, messages: turn(Array.from({ length: airaPictureCap + 1 }, () => image())) })).toEqual({
    ok: false,
  })
})
