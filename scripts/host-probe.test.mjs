import { judge, markers, startProbe, withRow } from "./host-probe.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const probe = await startProbe(0)
const url = `http://127.0.0.1:${String(probe.address().port)}/mcp`
const post = async (message) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify(message),
  })
  return { status: response.status, body: response.status === 200 ? await response.json() : null }
}

try {
  const opened = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } })
  same("initialize echoes the host's protocol", opened.body.result.protocolVersion, "2025-06-18")
  same("a notification is accepted", (await post({ jsonrpc: "2.0", method: "notifications/initialized" })).status, 202)

  const listed = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" })
  same(
    "two tools",
    listed.body.result.tools.map((tool) => tool.name),
    ["slide_picture", "slide_note"],
  )

  const picture = (await post({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "slide_picture" } })).body
    .result
  same(
    "slide_picture answers an image and a text, with structuredContent beside",
    picture.content.map((block) => block.type),
    ["image", "text"],
  )
  same("the text block alone holds the text word", picture.content[1].text.includes(markers.text), true)
  same(
    "structuredContent alone holds its word",
    JSON.stringify(picture.structuredContent).includes(markers.structured),
    true,
  )
  same(
    "structuredContent leaves out the text word",
    JSON.stringify(picture.structuredContent).includes(markers.text),
    false,
  )

  const note = (await post({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "slide_note" } })).body.result
  same("slide_note answers text alone", note.structuredContent, undefined)
  same("slide_note's text holds its word", note.content[0].text.includes(markers.alone), true)

  same("GET is refused", (await fetch(url)).status, 405)
} finally {
  probe.close()
}

const transcript = (pictureResult, noteResult) =>
  [
    { type: "assistant", message: { content: [{ type: "tool_use", id: "a", name: "mcp__probe__slide_picture" }] } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "a", content: pictureResult }] } },
    { type: "assistant", message: { content: [{ type: "tool_use", id: "b", name: "mcp__probe__slide_note" }] } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "b", content: noteResult }] } },
  ]
    .map((line) => JSON.stringify(line))
    .join("\n")

same(
  "judges what the model received",
  judge(
    transcript(
      [
        { type: "image", source: { type: "base64", data: "x" } },
        { type: "text", text: `{"word":"${markers.structured}"}` },
      ],
      [{ type: "text", text: markers.alone }],
    ),
  ),
  { image: true, text: false, structured: true, alone: true },
)
same(
  "a host that reads content only",
  judge(
    transcript(
      [
        { type: "image", source: { type: "base64", data: "x" } },
        { type: "text", text: markers.text },
      ],
      markers.alone,
    ),
  ),
  { image: true, text: true, structured: false, alone: true },
)

let refused = ""
try {
  judge(transcript([], []).split("\n").slice(0, 2).join("\n"))
} catch (error) {
  refused = error.message
}
same("refuses a run that skipped a tool", refused, "The model did not call slide_note, so nothing was measured.")

const doc =
  "# Hosts\n\n| Host | Measured |\n|---|---|\n| Claude Code 2.1.1 | 2026-01-01 |\n| claude.ai | not measured |\n"
same(
  "replaces the host's row and keeps the others",
  withRow(doc, "Claude Code", "| Claude Code 2.1.332 | 2026-11-27 |"),
  "# Hosts\n\n| Host | Measured |\n|---|---|\n| Claude Code 2.1.332 | 2026-11-27 |\n| claude.ai | not measured |\n",
)
