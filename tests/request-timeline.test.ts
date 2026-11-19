import { describe, expect, it } from "vitest"
import { watchRequests } from "./request-timeline"

type Listener = (value: never) => void

function fakeContext() {
  const listeners = new Map<string, Listener[]>()
  return {
    on(event: string, listener: Listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener])
    },
    emit(event: string, value: unknown) {
      for (const listener of listeners.get(event) ?? []) listener(value as never)
    },
  }
}

function asked(method: string, url: string, failure: string | null = null) {
  return { method: () => method, url: () => url, failure: () => (failure === null ? null : { errorText: failure }) }
}

describe("the request timeline of a browser test", () => {
  it("lists each request the page asked, in order, with when it was asked and how it was answered", () => {
    const context = fakeContext()
    let clock = 1000
    const timeline = watchRequests(context, () => clock)
    const open = asked("POST", "http://127.0.0.1:4400/decks/open")
    const script = asked("GET", "http://127.0.0.1:4400/assets/index-abc.js")
    const commit = asked("POST", "http://127.0.0.1:4400/decks/commit?try=1")
    const watch = asked("POST", "http://127.0.0.1:4400/decks/watch")
    clock = 1012
    context.emit("request", open)
    context.emit("request", script)
    clock = 1040
    context.emit("response", { status: () => 200, request: () => open })
    context.emit("request", commit)
    context.emit("request", watch)
    clock = 1100
    context.emit("response", { status: () => 413, request: () => commit })
    context.emit("requestfailed", asked("POST", "http://127.0.0.1:4400/decks/other", "net::ERR_ABORTED"))
    context.emit("requestfailed", Object.assign(watch, { failure: () => ({ errorText: "net::ERR_FAILED" }) }))
    expect(timeline()).toBe(
      [
        "+12 ms POST /decks/open -> 200 at +40 ms",
        "+40 ms POST /decks/commit -> 413 at +100 ms",
        "+40 ms POST /decks/watch -> net::ERR_FAILED at +100 ms",
      ].join("\n"),
    )
  })

  it("says when a request had no answer by the end of the test", () => {
    const context = fakeContext()
    const timeline = watchRequests(context, () => 0)
    context.emit("request", asked("POST", "http://127.0.0.1:4400/mcp"))
    expect(timeline()).toBe("+0 ms POST /mcp -> no answer")
  })
})
