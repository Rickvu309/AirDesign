import { airaPictureBytes, airaPictureCap, pictureNotFitted, readTurn, type ResultBlock } from "@airdesign/catalog"
import { expect, it } from "vitest"
import { cappedPictures, toolAnswer } from "./aira-answers"

const picture = (data = "/9j/"): ResultBlock => ({
  type: "image",
  source: { type: "base64", media_type: "image/jpeg", data },
})
const label: ResultBlock = { type: "text", text: "Slide 2 (257) at revision 4:" }
const note = { type: "text", text: pictureNotFitted }

it("keeps ten pictures in one message and puts a note in place of each one past that", () => {
  const first = toolAnswer(
    "call_1",
    "read",
    true,
    Array.from({ length: airaPictureCap - 1 }, () => picture()),
  )
  const second = toolAnswer("call_2", "read", true, [label, picture(), picture()])
  const [kept, capped] = cappedPictures([first, second])
  expect(kept).toEqual(first)
  expect(capped?.content).toEqual([label, picture(), note])
})

it("puts a note in place of a picture that would take the turn past its bytes, and the turn still reads", () => {
  const half = "A".repeat(airaPictureBytes / 2 - 4)
  const answer = toolAnswer("call_1", "read", true, [label, picture(half), picture(half), picture(half), picture()])
  const [fitted] = cappedPictures([answer])
  expect(fitted?.content).toEqual([label, picture(half), picture(half), note, picture()])
  const messages = [
    { role: "user", content: "Look" },
    {
      role: "assistant",
      content: [{ type: "tool_use", id: "call_1", name: "airdesign_read_deck", input: { deck: "airadeck" } }],
    },
    { role: "user", content: [fitted] },
  ]
  expect(readTurn({ deck: "airadeck", messages }).ok).toBe(true)
  expect(
    readTurn({ deck: "airadeck", messages: [...messages.slice(0, 2), { role: "user", content: [answer] }] }),
  ).toEqual({
    ok: false,
  })
})

it("answers a failed call as an error with its words", () => {
  expect(toolAnswer("call_3", "nothing to see", false)).toEqual({
    type: "tool_result",
    tool_use_id: "call_3",
    content: "nothing to see",
    is_error: true,
  })
})
