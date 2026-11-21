import { EventEmitter } from "node:events"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { browserCookies } from "./browser-cookies.mjs"
import { replyRoutes } from "./reply-routes.mjs"
import { journeyFile, journeyName, mailsIn } from "./verify-airdesign.mjs"

const shipped = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../journeys")

describe("journey file", () => {
  it("finds a shipped journey by its name", () => {
    expect(journeyFile("deck-names")).toBe(path.join(shipped, "deck-names.mjs"))
    expect(journeyName("deck-names")).toBe("deck-names")
  })

  it("takes a scratch journey by its path and names its evidence after the file", () => {
    expect(journeyFile("/home/someone/tmp/seams.mjs")).toBe("/home/someone/tmp/seams.mjs")
    expect(journeyFile("scratch/seams.mjs")).toBe(path.resolve("scratch/seams.mjs"))
    expect(journeyName("/home/someone/tmp/seams.mjs")).toBe("seams")
  })
})

describe("sign-in cookies", () => {
  it("gives the browser the session and the account cookie the sign-in set, as production does", () => {
    expect(browserCookies(["airdesign.session=abc", "airdesign.account=d1"])).toEqual([
      expect.objectContaining({ name: "airdesign.session", value: "abc", httpOnly: true, domain: "127.0.0.1" }),
      expect.objectContaining({ name: "airdesign.account", value: "d1", httpOnly: false, domain: "127.0.0.1" }),
    ])
  })
})

describe("stack mail", () => {
  it("reads each whole mail line and leaves the line the stack is still appending", () => {
    const whole = JSON.stringify({ to: "a@example.com", text: "Your code is 123456" })
    const writing = JSON.stringify({ to: "b@example.com", text: "Your code is 654321" }).slice(0, 20)
    expect(mailsIn(`${whole}\n${writing}`)).toEqual([{ to: "a@example.com", text: "Your code is 123456" }])
    expect(mailsIn(`${whole}\n`)).toHaveLength(1)
    expect(mailsIn("")).toEqual([])
  })
})

function pageRoutes() {
  const page = new EventEmitter()
  const handlers = new Map()
  page.route = async (match, route) => handlers.set(match, route)
  page.unroute = async (match, route) => {
    expect(handlers.get(match)).toBe(route)
    handlers.delete(match)
  }
  return {
    page,
    send(url, route) {
      return [...handlers].find(([match]) => match(new URL(url)))?.[1](route)
    },
  }
}

const origin = "http://127.0.0.1:1234"
const entry = { path: "/some-route" }
const address = origin + entry.path

describe("journey replies", () => {
  it("holds the catalog route until released and then lets it through", async () => {
    const { page, send } = pageRoutes()
    const { release } = await replyRoutes(page, origin).holdReply(entry, { search: "?name=one" })
    const route = { fallback: vi.fn() }
    expect(send(address + "?name=two", route)).toBeUndefined()
    expect(send("https://another.example" + entry.path + "?name=one", route)).toBeUndefined()
    const pending = send(address + "?name=one", route)
    expect(route.fallback).not.toHaveBeenCalled()
    await release()
    await pending
    expect(route.fallback).toHaveBeenCalledOnce()
    expect(send(address + "?name=one", route)).toBeUndefined()
  })

  it("can hold a reply after it reaches the server", async () => {
    const { page, send } = pageRoutes()
    const { received, release } = await replyRoutes(page, origin).holdReply(entry, { afterServer: true })
    const response = {}
    const route = { fetch: vi.fn(async () => response), fulfill: vi.fn(async () => undefined) }
    const pending = send(address, route)
    expect(await received).toBe(response)
    expect(route.fulfill).not.toHaveBeenCalled()
    await release()
    await pending
    expect(route.fulfill).toHaveBeenCalledWith({ response })
  })

  it("settles a server reply when the browser already canceled the request", async () => {
    const { page, send } = pageRoutes()
    const { received, release } = await replyRoutes(page, origin).holdReply(entry, { afterServer: true })
    const route = {
      fetch: vi.fn(async () => ({})),
      fulfill: vi.fn(async () => {
        throw new Error("route.fulfill: Route is already handled!")
      }),
    }
    const pending = send(address, route)
    await received
    await release()
    await expect(pending).resolves.toBeUndefined()
  })

  it("starts a timed hold when the first matching request arrives", async () => {
    vi.useFakeTimers()
    try {
      const { page, send } = pageRoutes()
      const { release } = await replyRoutes(page, origin).holdReply(entry, { forMs: 100 })
      await vi.advanceTimersByTimeAsync(100)
      const route = { fallback: vi.fn() }
      const pending = send(address, route)
      await vi.advanceTimersByTimeAsync(99)
      expect(route.fallback).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      await pending
      expect(route.fallback).toHaveBeenCalledOnce()
      await release()
    } finally {
      vi.useRealTimers()
    }
  })

  it("releases all outstanding holds when the journey ends", async () => {
    const { page, send } = pageRoutes()
    const siteOrigin = "http://127.0.0.1:2345"
    const replies = replyRoutes(page, origin, siteOrigin)
    await replies.holdReply(entry)
    await replies.holdReply({ path: "/another-route" })
    const route = { fallback: vi.fn() }
    const pending = [send(address, route), send(siteOrigin + "/another-route", route)]
    expect(route.fallback).not.toHaveBeenCalled()
    await replies.releaseHeldReplies()
    await Promise.all(pending)
    expect(route.fallback).toHaveBeenCalledTimes(2)
  })

  it("settles a held request when the page closes", async () => {
    const { page, send } = pageRoutes()
    await replyRoutes(page, origin).holdReply(entry)
    const route = { fallback: vi.fn() }
    const pending = send(address, route)
    page.emit("close")
    await pending
    expect(route.fallback).not.toHaveBeenCalled()
  })

  it("sends the first request to the server, drops its reply, and blocks retries until restored", async () => {
    const { page, send } = pageRoutes()
    const { dropped, restore } = await replyRoutes(page, origin).dropReply(entry)
    const request = {}
    const response = {}
    const first = { request: () => request, fetch: vi.fn(async () => response), abort: vi.fn() }
    const retry = { fetch: vi.fn(), abort: vi.fn() }
    await Promise.all([send(address, first), send(address, retry)])
    expect(await dropped).toEqual({ request, response })
    expect(first.fetch).toHaveBeenCalledOnce()
    expect(first.abort).toHaveBeenCalledWith("connectionfailed")
    expect(retry.fetch).not.toHaveBeenCalled()
    expect(retry.abort).toHaveBeenCalledWith("connectionfailed")
    await restore()
    expect(send(address, retry)).toBeUndefined()
  })

  it("answers with a chosen HTTP failure until restored", async () => {
    const { page, send } = pageRoutes()
    const json = { ok: false }
    const restore = await replyRoutes(page, origin).failReply(entry, { status: 503, json })
    const route = { fulfill: vi.fn(async () => undefined) }
    await send(address, route)
    expect(route.fulfill).toHaveBeenCalledWith({ status: 503, json })
    await restore()
    expect(send(address, route)).toBeUndefined()
  })

  it("fails the connection when no HTTP failure is supplied", async () => {
    const { page, send } = pageRoutes()
    await replyRoutes(page, origin).failReply(entry)
    const route = { abort: vi.fn() }
    await send(address, route)
    expect(route.abort).toHaveBeenCalledWith("connectionfailed")
  })
})
