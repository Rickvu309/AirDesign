function answerOf(type, text) {
  const rows = text.split("\n").filter((line) => line.trim() !== "")
  if (type.includes("ndjson")) return { lines: rows.map((line) => JSON.parse(line)) }
  const data = rows.flatMap((line) => (line.startsWith("data: ") ? [JSON.parse(line.slice(6))] : []))
  if (type.includes("event-stream")) return { events: data }
  return text.length === 0 ? {} : JSON.parse(text)
}

export async function call(origin, method, pathname, body, cookie, headers = {}) {
  const response = await fetch(`${origin}${pathname}`, {
    method,
    headers: { "content-type": "application/json", ...headers, ...(cookie === undefined ? {} : { cookie }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  let json
  try {
    json = answerOf(response.headers.get("content-type") ?? "", text)
  } catch {
    json = { text: text.slice(0, 200) }
  }
  const cookies = response.headers.getSetCookie().map((header) => header.split(";")[0])
  return { status: response.status, json, cookie: cookies[0], cookies }
}
