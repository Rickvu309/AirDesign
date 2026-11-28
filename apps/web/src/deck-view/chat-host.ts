type Message = {
  readonly jsonrpc?: unknown
  readonly id?: number | string
  readonly method?: string
  readonly params?: unknown
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

const themes = ["light", "dark"] as const
const displayModes = ["inline", "fullscreen", "pip"] as const
const viewModes = ["inline", "fullscreen"] as const

export type DisplayMode = (typeof displayModes)[number]

type Size = { readonly width: number; readonly height: number }

export type HostContext = {
  readonly theme?: (typeof themes)[number]
  readonly styles?: { readonly variables: Readonly<Record<string, string>> }
  readonly displayMode?: DisplayMode
  readonly availableDisplayModes?: readonly DisplayMode[]
  readonly containerDimensions?: {
    readonly width?: number
    readonly maxWidth?: number
    readonly height?: number
    readonly maxHeight?: number
  }
  readonly safeAreaInsets?: {
    readonly top: number
    readonly right: number
    readonly bottom: number
    readonly left: number
  }
}

export type HostState = { readonly shown: Shown | null | undefined; readonly context: HostContext }

export type ChatHost = {
  readonly callTool: (name: string, args: object, signal?: AbortSignal) => Promise<unknown>
  readonly openLink: (url: string) => void
  readonly sizeTo: (size: Size) => void
  readonly tellModel?: (viewed: Viewed) => void
  readonly requestDisplayMode: (mode: (typeof viewModes)[number]) => Promise<DisplayMode | undefined>
  readonly state: () => HostState
  readonly subscribe: (watcher: () => void) => () => void
  readonly closed: AbortSignal
}

const protocolVersion = "2026-01-26"

const recordOf = (raw: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof raw === "object" && raw !== null ? (raw as Readonly<Record<string, unknown>>) : undefined

const oneOf = <Name extends string>(names: readonly Name[], raw: unknown): Name | undefined =>
  names.find((name) => name === raw)

const numberOf = (raw: unknown): number | undefined =>
  typeof raw === "number" && Number.isFinite(raw) ? raw : undefined

function numbersOf<Key extends string>(raw: unknown, keys: readonly Key[]): Partial<Record<Key, number>> {
  const fields = recordOf(raw)
  const found: Partial<Record<Key, number>> = {}
  for (const key of keys) {
    const value = numberOf(fields?.[key])
    if (value !== undefined) found[key] = value
  }
  return found
}

function insetsOf(raw: unknown): HostContext["safeAreaInsets"] {
  const { top, right, bottom, left } = numbersOf(raw, ["top", "right", "bottom", "left"])
  if (top === undefined || right === undefined || bottom === undefined || left === undefined) return undefined
  return { top, right, bottom, left }
}

function variablesOf(raw: unknown): Readonly<Record<string, string>> | undefined {
  const fields = recordOf(recordOf(raw)?.variables)
  if (fields === undefined) return undefined
  return Object.fromEntries(
    Object.entries(fields).filter(
      (entry): entry is [string, string] => entry[0].startsWith("--") && typeof entry[1] === "string",
    ),
  )
}

function contextOf(raw: unknown): HostContext {
  const fields = recordOf(raw)
  const theme = oneOf(themes, fields?.theme)
  const variables = variablesOf(fields?.styles)
  const displayMode = oneOf(displayModes, fields?.displayMode)
  const offered = fields?.availableDisplayModes
  const box = recordOf(fields?.containerDimensions)
  const insets = insetsOf(fields?.safeAreaInsets)
  return {
    ...(theme === undefined ? {} : { theme }),
    ...(variables === undefined ? {} : { styles: { variables } }),
    ...(displayMode === undefined ? {} : { displayMode }),
    ...(Array.isArray(offered)
      ? { availableDisplayModes: offered.flatMap((mode: unknown) => oneOf(displayModes, mode) ?? []) }
      : {}),
    ...(box === undefined ? {} : { containerDimensions: numbersOf(box, ["width", "maxWidth", "height", "maxHeight"]) }),
    ...(insets === undefined ? {} : { safeAreaInsets: insets }),
  }
}

const hostSized = (context: HostContext) =>
  (context.displayMode ?? "inline") !== "inline" || context.containerDimensions?.height !== undefined

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
  const fields = recordOf(raw)
  const [first] = Array.isArray(fields?.screenshots) ? fields.screenshots : []
  if (typeof first === "string") return first
  return typeof fields?.slide === "string" ? fields.slide : undefined
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

const stopped = () => new DOMException("The view stopped waiting", "AbortError")

export async function connectChatHost(line: HostLine): Promise<ChatHost> {
  let next = 0
  const waiting = new Map<number | string, { resolve: (result: unknown) => void; reject: (error: Error) => void }>()
  const watchers = new Set<() => void>()
  const closing = new AbortController()
  let state: HostState = { shown: undefined, context: {} }
  let named: string | undefined
  let asked: Size | undefined
  const change = (to: Partial<HostState>) => {
    state = { ...state, ...to }
    for (const watcher of watchers) watcher()
  }
  const show = (shown: Shown | null) => change({ shown })
  const fit = () => {
    if (closing.signal.aborted || asked === undefined || hostSized(state.context)) return
    const limit = state.context.containerDimensions?.maxHeight ?? asked.height
    line.post({
      jsonrpc: "2.0",
      method: "ui/notifications/size-changed",
      params: { width: asked.width, height: Math.min(asked.height, limit) },
    })
  }
  const contextChanged = (raw: unknown) => {
    const before = state.context
    change({ context: { ...before, ...contextOf(raw) } })
    const after = state.context
    if (
      hostSized(before) !== hostSized(after) ||
      before.containerDimensions?.maxHeight !== after.containerDimensions?.maxHeight
    )
      fit()
  }
  line.listen((message) => {
    if (message?.jsonrpc !== "2.0") return
    if (closing.signal.aborted && message.method !== "ui/resource-teardown") return
    if (message.method === undefined) {
      const pending = message.id === undefined ? undefined : waiting.get(message.id)
      if (pending === undefined) return
      waiting.delete(message.id!)
      if (message.error === undefined) pending.resolve(message.result)
      else pending.reject(new Error(String(message.error.message)))
      return
    }
    if (message.method === "ui/resource-teardown") closing.abort()
    if (message.id !== undefined) return void line.post({ jsonrpc: "2.0", id: message.id, result: {} })
    const fields = recordOf(message.params)
    if (message.method === "ui/notifications/host-context-changed") contextChanged(message.params)
    else if (message.method === "ui/notifications/tool-input-partial") {
      const deck = recordOf(fields?.arguments)?.deck
      if (typeof deck === "string" && deck !== "" && state.shown?.deck !== deck) show({ deck })
    } else if (message.method === "ui/notifications/tool-input") {
      named = deckOf(fields?.arguments)
      if (named !== undefined) show({ deck: named })
    } else if (message.method === "ui/notifications/tool-result") {
      const result = fields?.structuredContent
      const deck = deckOf(result) ?? named
      const slide = slideOf(result)
      show(deck === undefined ? null : slide === undefined ? { deck } : { deck, slide })
    } else if (message.method === "ui/notifications/tool-cancelled" && state.shown === undefined) show(null)
  })
  const request = (method: string, params: object, stop = closing.signal) =>
    new Promise<unknown>((resolve, reject) => {
      if (stop.aborted) return reject(stopped())
      next += 1
      const id = next
      const cancel = () => {
        waiting.delete(id)
        if (method !== "ui/initialize")
          line.post({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: id } })
        reject(stopped())
      }
      stop.addEventListener("abort", cancel, { once: true })
      const settled = () => stop.removeEventListener("abort", cancel)
      waiting.set(id, {
        resolve: (result) => {
          settled()
          resolve(result)
        },
        reject: (error) => {
          settled()
          reject(error)
        },
      })
      line.post({ jsonrpc: "2.0", id, method, params })
    })
  const initialized = recordOf(
    await request("ui/initialize", {
      protocolVersion,
      appInfo: { name: "AirDesign", version: "1.0.0" },
      appCapabilities: { availableDisplayModes: viewModes },
    }),
  )
  closing.signal.throwIfAborted()
  change({ context: contextOf(initialized?.hostContext) })
  line.post({ jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} })
  const takesContext = recordOf(initialized?.hostCapabilities)?.updateModelContext !== undefined
  let told = ""
  const tellModel = (viewed: Viewed) => {
    const context = modelContextOf(viewed)
    const said = JSON.stringify(context)
    if (said === told) return
    told = said
    void request("ui/update-model-context", context).catch(() => undefined)
  }
  return {
    callTool: async (name, args, signal) =>
      recordOf(
        await request(
          "tools/call",
          { name, arguments: args },
          signal === undefined ? closing.signal : AbortSignal.any([closing.signal, signal]),
        ),
      )?.structuredContent,
    openLink: (url) => void request("ui/open-link", { url }).catch(() => undefined),
    sizeTo: (size) => {
      if (hostSized(state.context)) return
      asked = size
      fit()
    },
    ...(takesContext ? { tellModel } : {}),
    requestDisplayMode: async (mode) => {
      if (state.context.availableDisplayModes?.includes(mode) !== true) return state.context.displayMode
      const answered = await request("ui/request-display-mode", { mode }).catch(() => undefined)
      const displayMode = oneOf(displayModes, recordOf(answered)?.mode)
      if (displayMode !== undefined) contextChanged({ displayMode })
      return state.context.displayMode
    },
    state: () => state,
    subscribe: (watcher) => {
      watchers.add(watcher)
      return () => watchers.delete(watcher)
    },
    closed: closing.signal,
  }
}
