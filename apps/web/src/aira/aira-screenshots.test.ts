import { readTurn } from "@airdesign/catalog"
import { expect, it } from "vitest"
import { airaChat } from "./aira-loop"
import { asking, call, deck, edit, ended, read, scripted } from "./testing/aira-loop-script"

const data = "/9j/4AAQSkZJRgABAQ=="
const label = "Slide 1 (256) at revision 4:"
const seen = {
  structuredContent: { ok: true, revision: 4 },
  content: [
    { type: "text", text: "Read revision 4." },
    { type: "text", text: '{"ok":true,"revision":4}' },
    { type: "text", text: label },
    { type: "image", data, mimeType: "image/jpeg" },
  ],
}

it("hands Aira the screenshot the read answered, in the next turn only, and keeps it out of the history after", async () => {
  const look = call("call_1", edit, { deck, script: 'screenshot({ target: "s:256" })' })
  const again = call("call_2", read, {})
  const link = scripted(
    [{ lines: [ended([look])] }, { lines: [ended([again])] }, { lines: [ended([{ type: "text", text: "Done" }])] }],
    [seen, { structuredContent: { ok: true, revision: 4 } }],
  )
  const { done } = await asking(airaChat(deck), "Look at slide one", link)
  const [, second, third] = link.turnsSent()
  const answered = second?.at(-1) as { content: { content: unknown }[] }
  expect(answered.content[0]?.content).toEqual([
    { type: "text", text: "Read revision 4." },
    { type: "text", text: '{"ok":true,"revision":4}' },
    { type: "text", text: label },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
  ])
  expect(readTurn({ deck, messages: second }).ok).toBe(true)
  expect(JSON.stringify(third)).not.toContain(data)
  expect(JSON.stringify(third)).toContain(label)
  expect(readTurn({ deck, messages: third }).ok).toBe(true)
  expect(JSON.stringify(done.history)).not.toContain(data)
})
