export function strictPolicy({ connectDomains, resourceDomains }) {
  const resources = resourceDomains.join(" ")
  return [
    "default-src 'none'",
    "base-uri 'none'",
    `script-src 'unsafe-inline' 'wasm-unsafe-eval' ${resources}`,
    `style-src 'unsafe-inline' ${resources}`,
    `img-src data: ${resources}`,
    `font-src ${resources}`,
    `connect-src ${connectDomains.join(" ")}`,
  ].join("; ")
}

export const hostLook = {
  "--color-background-primary": "light-dark(#ffffff, #262624)",
  "--color-text-primary": "light-dark(#141413, #faf9f5)",
  "--color-border-primary": "light-dark(#1f1e1d26, #faf9f526)",
  "--font-sans": '"Anthropic Sans", system-ui, sans-serif',
  "--font-weight-normal": "400",
  "--font-weight-medium": "500",
  "--font-weight-semibold": "600",
}

export function chatHostPage(view, call) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Chat host</title>
<style>
body { margin: 0; padding: 24px; font: 14px system-ui; display: grid; gap: 16px; justify-items: start }
body[data-theme="dark"] { background: #262624; color-scheme: dark }
iframe { display: block; width: 736px; height: 400px; border: 1px solid #ddd; border-radius: 12px }
</style>
</head><body>
<script>
const call = ${JSON.stringify(call)}
const look = ${JSON.stringify(hostLook)}
const answers = new Map()
let asked = 0
window.host = {}
window.frameView = (name, { takesContext = true, streams = false } = {}) => {
  const frame = document.createElement("iframe")
  frame.id = name
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin")
  frame.src = ${JSON.stringify(view)}
  document.body.append(frame)
  const seen = { init: null, heard: [], calls: [], pending: [], cancelled: [], contexts: [], opened: [], sizes: [] }
  window.host[name] = seen
  const held = new Map()
  const send = (message) => frame.contentWindow.postMessage(message, "*")
  window.addEventListener("message", async (event) => {
    if (event.source !== frame.contentWindow) return
    const message = event.data
    seen.heard.push(message.method ?? "answer " + message.id)
    if (message.method === undefined) return void answers.get(message.id)?.(message.result)
    if (message.method === "ui/initialize") {
      seen.init = message.params
      send({ jsonrpc: "2.0", id: message.id, result: {
        protocolVersion: "2026-01-26",
        hostInfo: { name: "chat-host", version: "1.0.0" },
        hostCapabilities: { openLinks: {}, serverTools: {}, ...(takesContext ? { updateModelContext: { text: {} } } : {}) },
        hostContext: { theme: "light", styles: { variables: look }, displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"] },
      } })
    } else if (message.method === "ui/notifications/initialized" && !streams) {
      send({ jsonrpc: "2.0", method: "ui/notifications/tool-input", params: { arguments: call.arguments } })
      send({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: call.result })
    } else if (message.method === "tools/call") {
      const stop = new AbortController()
      held.set(message.id, stop)
      seen.calls.push({ id: message.id, name: message.params.name })
      seen.pending.push(message.id)
      try {
        const answer = await (await fetch("/tools-call", { method: "POST", body: JSON.stringify(message.params), signal: stop.signal })).json()
        send({ ...answer, id: message.id })
      } catch (error) {
        if (error.name !== "AbortError") throw error
      } finally {
        held.delete(message.id)
        seen.pending.splice(seen.pending.indexOf(message.id), 1)
      }
    } else if (message.method === "notifications/cancelled") {
      seen.cancelled.push(message.params.requestId)
      held.get(message.params.requestId)?.abort()
    } else if (message.method === "ui/open-link") {
      seen.opened.push(message.params.url)
      send({ jsonrpc: "2.0", id: message.id, result: {} })
    } else if (message.method === "ui/update-model-context") {
      seen.contexts.push(message.params)
      send({ jsonrpc: "2.0", id: message.id, result: {} })
    } else if (message.method === "ui/notifications/size-changed") {
      seen.sizes.push(message.params)
      frame.style.height = message.params.height + "px"
    }
  })
}
window.tell = (name, method, params) =>
  document.getElementById(name).contentWindow.postMessage({ jsonrpc: "2.0", method, params }, "*")
window.ask = (name, method, params) =>
  new Promise((resolve) => {
    asked += 1
    const id = "host-" + asked
    answers.set(id, (result) => {
      answers.delete(id)
      resolve({ id, result })
    })
    document.getElementById(name).contentWindow.postMessage({ jsonrpc: "2.0", id, method, params }, "*")
  })
window.tearDown = async (name) => {
  const seen = window.host[name]
  const pending = [...seen.pending]
  const heard = seen.heard.length
  const cancelled = seen.cancelled.length
  const { id, result } = await window.ask(name, "ui/resource-teardown", { reason: "The person closed the chat" })
  return { id, result, pending, heard: seen.heard.slice(heard), cancelled: seen.cancelled.slice(cancelled) }
}
window.frameView("view")
</script>
</body></html>`
}
