import { airaPictureCap, type ResultBlock } from "@airdesign/catalog"
import { expect, it } from "vitest"
import { cappedPictures, toolAnswer } from "./aira-answers"

const picture: ResultBlock = { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "/9j/" } }

it("keeps whole answers while one message holds ten pictures or fewer, and puts notes in place of the pictures of an answer past that", () => {
  const first = toolAnswer(
    "call_1",
    "read",
    true,
    Array.from({ length: airaPictureCap - 1 }, () => picture),
  )
  const second = toolAnswer("call_2", "read", true, [
    { type: "text", text: "Slide 2 (257) at revision 4:" },
    picture,
    picture,
  ])
  const [kept, capped] = cappedPictures([first, second])
  expect(kept).toBe(first)
  expect(capped?.content).toEqual([
    { type: "text", text: "Slide 2 (257) at revision 4:" },
    { type: "text", text: "A picture was here. Read with picture again to see the slide now." },
    { type: "text", text: "A picture was here. Read with picture again to see the slide now." },
  ])
  expect(toolAnswer("call_3", "nothing to see", false)).toEqual({
    type: "tool_result",
    tool_use_id: "call_3",
    content: "nothing to see",
    is_error: true,
  })
})
