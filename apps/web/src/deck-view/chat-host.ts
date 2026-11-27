type Message = {
  readonly jsonrpc?: unknown
  readonly id?: number | string
  readonly method?: string
  readonly params?: { readonly arguments?: unknown; readonly structuredContent?: unknown }
  readonly result?: unknown
  readonly error?: { readonly message?: unknown }
}

export type HostLine = {
  readonly post: (message: unknown) => void
  readonly listen: (heard: (message: Message) => void) => () => void
}

export type Shown = { readonly deck: string; readonly slide?: string }

export type Viewed = {
  readonly deck: string
  readonly slide: string
  readonly slideNumber: number
  readonly selected: readonly string[]
}

export type ChatHost = {
  readonly callTool: (name: string, args: object) => Promise<unknown>
  readonly openLink: (url: string) => void
  readonly sizeTo: (size: { readonly width: number; readonly height: number }) => void
  readonly onShown: (watcher: (shown: Shown | null) => void) => () => void
  readonly tellModel: (viewed: Viewed) => void
}

const protocolVersion = "2026-01-26"

const recordOf = (raw: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof raw === "object" && raw !== null ? (raw as Readonly<Record<string, unknown>>) : undefined

function deckOf(raw: unknown): string | undefined {
  const fields = recordOf(raw)
  if (typeof fields?.deck === "string") return fields.deck
  const open = recordOf(fields?.openDeck)
  if (typeof open?.deck === "string") return open.deck
  const [latest] = Array.isArray(fields?.decks) ? fields.decks : []
  const listed = recordOf(latest)
  return typeof listed?.deck === "string" ? listed.deck : undefined
}

function slideOf(raw: unknown): string | undefined {
  const screenshots = recordOf(raw)?.screenshots
  const [first] = Array.isArray(screenshots) ? screenshots : []
  return typeof first === "string" ? first : undefined
}

function selectedWords(selected: readonly string[]): string {
  if (selected.length === 0) return ""
  return ` and has selected ${selected.length === 1 ? "layer" : "layers"} ${selected.join(", ")}`
}

export function modelContextOf(viewed: Viewed) {
  const { deck, slide, slideNumber, selected } = viewed
  return {
    content: [
      {
        type: "text",
        text: `In the AirDesign deck view the person is on slide ${String(slideNumber)} (${slide}) of deck ${deck}${selectedWords(selected)}.`,
      },
    ],
    structuredContent: { deck, slide, slideNumber, selected },
  }
}

export function parentLine(): HostLine {
  return {
    post: (message) => window.parent.postMessage(message, "*"),
    listen: (heard) => {
      const listener = (event: MessageEvent) => {
        if (event.source === window.parent) heard(event.data as Message)
      }
      window.addEventListener("message", listener)
      return () => window.removeEventListener("message", listener)
    },
  }
}

export async function connectChatHost(line: HostLine): Promise<ChatHost> {
  let next = 0
  const waiting = new Map<number | string, { resolve: (result: unknown) => void; reject: (error: Error) => void }>()
  const watchers = new Set<(shown: Shown | null) => void>()
  let shown: Shown | null | undefined
  let named: string | undefined
  const show = (next: Shown | null) => {
    shown = next
    for (const watcher of watchers) watcher(next)
  }
  line.listen((message) => {
    if (message?.jsonrpc !== "2.0") return
    if (message.method === undefined) {
      const pending = message.id === undefined ? undefined : waiting.get(message.id)
      if (pending === undefined) return
      waiting.delete(message.id!)
      if (message.error === undefined) pending.resolve(message.result)
      else pending.reject(new Error(String(message.error.message)))
      return
    }
    if (message.id !== undefined) line.post({ jsonrpc: "2.0", id: message.id, result: {} })
    else if (message.method === "ui/notifications/tool-input") {
      named = deckOf(message.params?.arguments)
      if (named !== undefined) show({ deck: named })
    } else if (message.method === "ui/notifications/tool-result") {
      const fields = message.params?.structuredContent
      const deck = deckOf(fields) ?? named
      const slide = slideOf(fields)
      show(deck === undefined ? null : slide === undefined ? { deck } : { deck, slide })
    }
  })
  const request = (method: string, params: object) =>
    new Promise<unknown>((resolve, reject) => {
      next += 1
      waiting.set(next, { resolve, reject })
      line.post({ jsonrpc: "2.0", id: next, method, params })
    })
  const initialized = await request("ui/initialize", {
    protocolVersion,
    appInfo: { name: "AirDesign", version: "1.0.0" },
    appCapabilities: { availableDisplayModes: ["inline"] },
  })
  line.post({ jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} })
  const takesContext = recordOf(recordOf(initialized)?.hostCapabilities)?.updateModelContext !== undefined
  let told = ""
  return {
    callTool: async (name, args) => recordOf(await request("tools/call", { name, arguments: args }))?.structuredContent,
    openLink: (url) => void request("ui/open-link", { url }).catch(() => undefined),
    sizeTo: (size) => line.post({ jsonrpc: "2.0", method: "ui/notifications/size-changed", params: size }),
    onShown: (watcher) => {
      watchers.add(watcher)
      if (shown !== undefined) watcher(shown)
      return () => watchers.delete(watcher)
    },
    tellModel: (viewed) => {
      const context = modelContextOf(viewed)
      const said = JSON.stringify(context)
      if (!takesContext || said === told) return
      told = said
      void request("ui/update-model-context", context).catch(() => undefined)
    },
  }
}
