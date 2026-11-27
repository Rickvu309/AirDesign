import { execFileSync, spawn } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const hostsDoc = fileURLToPath(new URL("../docs/hosts.md", import.meta.url))

const redPicture =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAeUlEQVR4nO3PQQkAMAzAwCqpf1ETMxF7HINABFzm7H7dcEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFj13PLIEAOXyUUwAAAABJRU5ErkJggg=="

export const markers = { text: "ONLY-TEXT-plum", structured: "ONLY-STRUCTURED-fig", alone: "ONLY-ALONE-pear" }

export const prompt =
  "Call slide_picture, then slide_note. Then answer with one line: colour=<the colour of the picture, or none>; words=<every word that starts with ONLY- in the two answers, or none>."

const tools = [
  {
    name: "slide_picture",
    description: "Returns a picture of the slide.",
    inputSchema: { type: "object", properties: {} },
  },
  { name: "slide_note", description: "Returns the slide's note.", inputSchema: { type: "object", properties: {} } },
]

const toolAnswers = {
  slide_picture: {
    content: [
      { type: "image", data: redPicture, mimeType: "image/png" },
      { type: "text", text: JSON.stringify({ ok: true, word: markers.text }) },
    ],
    structuredContent: { ok: true, word: markers.structured },
  },
  slide_note: { content: [{ type: "text", text: JSON.stringify({ ok: true, word: markers.alone }) }] },
}

const reply = (message) => {
  const result = (value) => ({ jsonrpc: "2.0", id: message.id, result: value })
  if (message.method === "initialize")
    return result({
      protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "probe", version: "1" },
    })
  if (message.method === "tools/list") return result({ tools })
  if (message.method === "tools/call" && toolAnswers[message.params?.name])
    return result(toolAnswers[message.params.name])
  if (message.method === "ping") return result({})
  return { jsonrpc: "2.0", id: message.id, error: { code: -32601, message: `No method ${String(message.method)}` } }
}

export const startProbe = (port) =>
  new Promise((resolve) => {
    const server = createServer((request, response) => {
      if (request.url !== "/mcp") return response.writeHead(404).end()
      if (request.method !== "POST") return response.writeHead(405, { allow: "POST" }).end()
      let body = ""
      request.on("data", (chunk) => (body += chunk))
      request.on("end", () => {
        const message = JSON.parse(body)
        if (message.id === undefined) return response.writeHead(202).end()
        response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(reply(message)))
      })
    })
    server.listen(port, "127.0.0.1", () => resolve(server))
  })

export const judge = (transcript) => {
  const blocks = transcript
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .flatMap((line) => JSON.parse(line).message?.content ?? [])
    .filter((block) => typeof block === "object")
  const names = new Map(blocks.filter((block) => block.type === "tool_use").map((block) => [block.id, block.name]))
  const received = (tool) => {
    const answer = blocks.find(
      (block) => block.type === "tool_result" && names.get(block.tool_use_id)?.endsWith(`__${tool}`),
    )
    if (!answer) throw new Error(`The model did not call ${tool}, so nothing was measured.`)
    return Array.isArray(answer.content) ? answer.content : [{ type: "text", text: String(answer.content) }]
  }
  const picture = received("slide_picture")
  const note = JSON.stringify(received("slide_note"))
  return {
    image: picture.some((block) => block.type === "image"),
    text: JSON.stringify(picture).includes(markers.text),
    structured: JSON.stringify(picture).includes(markers.structured),
    alone: note.includes(markers.alone),
  }
}

export const withRow = (doc, host, row) => {
  const lines = doc.split("\n")
  const at = lines.findIndex((line) => line.startsWith(`| ${host} `))
  if (at < 0) throw new Error(`docs/hosts.md has no row for ${host}.`)
  return [...lines.slice(0, at), row, ...lines.slice(at + 1)].join("\n")
}

const yesNo = (seen) => (seen ? "yes" : "no")

const recordClaudeCode = async () => {
  const probe = await startProbe(0)
  const config = {
    mcpServers: { probe: { type: "http", url: `http://127.0.0.1:${String(probe.address().port)}/mcp` } },
  }
  const folder = mkdtempSync(path.join(tmpdir(), "host-probe-"))
  const run = spawn(
    "claude",
    [
      ...["-p", prompt, "--output-format", "stream-json", "--verbose", "--model", "haiku"],
      ...["--mcp-config", JSON.stringify(config), "--strict-mcp-config", "--setting-sources", ""],
      ...[
        "--no-session-persistence",
        "--tools",
        "",
        "--allowedTools",
        "mcp__probe__slide_picture",
        "mcp__probe__slide_note",
      ],
    ],
    { cwd: folder, stdio: ["ignore", "pipe", "inherit"] },
  )
  let transcript = ""
  run.stdout.on("data", (chunk) => (transcript += chunk))
  const status = await new Promise((resolve) => run.on("close", resolve))
  probe.close()
  const saved = path.join(folder, "claude-code.jsonl")
  writeFileSync(saved, transcript)
  if (status !== 0) throw new Error(`claude exited ${String(status)}. Transcript: ${saved}`)
  const seen = judge(transcript)
  const version = execFileSync("claude", ["--version"], { encoding: "utf8" }).split(" ")[0]
  const date = new Date().toISOString().slice(0, 10)
  const row = `| Claude Code ${version} | ${date} | ${[seen.image, seen.text, seen.structured, seen.alone].map(yesNo).join(" | ")} |`
  writeFileSync(hostsDoc, withRow(readFileSync(hostsDoc, "utf8"), "Claude Code", row))
  process.stdout.write(`${row}\nWrote docs/hosts.md. Transcript: ${saved}\n`)
}

const serve = async (port) => {
  await startProbe(port)
  process.stdout.write(
    `Probe at http://127.0.0.1:${String(port)}/mcp\nPublic URL: npx cloudflared tunnel --url http://127.0.0.1:${String(port)}\nPrompt: ${prompt}\n`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, port] = process.argv.slice(2)
  if (command === "serve") await serve(Number(port ?? 8787))
  else if (command === undefined) await recordClaudeCode()
  else {
    process.stderr.write("Usage: node scripts/host-probe.mjs [serve [port]]\n")
    process.exit(1)
  }
}
