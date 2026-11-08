import {afterEach,beforeEach,expect,it,vi} from "vitest"
import {checkIdentity} from "../../scripts/live/deployed-identity.ts"

const expected="a".repeat(40),stale="b".repeat(40)
const identity=(sha:string)=>({sha,builtAt:"2026-11-08T20:30:00.000Z"})
const response=(sha:string)=>new Response(JSON.stringify(identity(sha)),{status:200})
beforeEach(()=>vi.useFakeTimers())
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})

it("waits for a stale Pages edge to report the exact expected commit",async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(response(stale)).mockResolvedValueOnce(response(expected))
  vi.stubGlobal("fetch",fetcher)
  const result=checkIdentity("https://site.invalid","/version.json",expected,true).catch(error=>error)
  await vi.advanceTimersByTimeAsync(2000)
  expect(await result).toEqual(identity(expected))
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({cache:"no-store"})
})

it("fails at the fixed two-minute limit if Pages stays stale",async()=>{
  const fetcher=vi.fn().mockImplementation(async()=>response(stale))
  vi.stubGlobal("fetch",fetcher)
  const started=performance.now()
  const result=checkIdentity("https://site.invalid","/version.json",expected,true).catch(error=>error)
  await vi.advanceTimersByTimeAsync(119999)
  expect(fetcher).toHaveBeenCalledTimes(60)
  await vi.advanceTimersByTimeAsync(1)
  expect(await result).toBeInstanceOf(Error)
  expect(String(await result)).toContain("deployed commit does not match --expect-sha")
  expect(performance.now()-started).toBe(120000)
  expect(fetcher).toHaveBeenCalledTimes(60)
})

it("rejects a wrong SHA immediately when propagation waiting is disabled",async()=>{
  const fetcher=vi.fn().mockResolvedValue(response(stale))
  vi.stubGlobal("fetch",fetcher)
  await expect(checkIdentity("https://studio.invalid","/version",expected)).rejects.toThrow("deployed commit does not match --expect-sha")
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(performance.now()).toBe(0)
})

it("never accepts an expected SHA first received after the propagation deadline",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockImplementation(()=>new Promise<Response>(resolve=>setTimeout(()=>resolve(response(expected)),120000))))
  const result=checkIdentity("https://site.invalid","/version.json",expected,true).catch(error=>error)
  await vi.advanceTimersByTimeAsync(120000)
  expect(await result).toBeInstanceOf(Error)
})

it.each([new Response("unavailable",{status:503}),new Response(JSON.stringify({...identity(expected),builtAt:"invalid"}))])("does not hide an invalid identity endpoint behind propagation retries",async value=>{
  const fetcher=vi.fn().mockResolvedValue(value)
  vi.stubGlobal("fetch",fetcher)
  await expect(checkIdentity("https://site.invalid","/version.json",expected,true)).rejects.toThrow()
  expect(fetcher).toHaveBeenCalledTimes(1)
})
