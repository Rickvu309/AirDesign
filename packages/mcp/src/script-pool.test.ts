import { describe, expect, it } from "vitest"

import { scriptLimits, scriptPool, type Operation } from "./script-pool.js"

const echo: Operation = async (verb, fields) =>
  verb === "refuse" ? { ok: false, message: "Operation 1 (refuse): no." } : { ok: true, value: { verb, fields } }
const scripts = scriptPool(["insert", "refuse"])
const runScript = (script: string, account = "account-a", ms: number = scriptLimits.ms) =>
  scripts.run({ account, script, operation: echo, ms })

describe("script pool", () => {
  it("answers another account in under a second while one account submits four looping scripts", async () => {
    const loops = Array.from({ length: 4 }, () => runScript("while (true) {}", "account-a", 1_500))
    const started = performance.now()
    const other = await runScript("1 + 1", "account-b")
    const answeredAfter = performance.now() - started
    const ended = await Promise.all(loops)

    expect(other).toMatchObject({ ok: true, result: 2 })
    expect(answeredAfter).toBeLessThan(1_000)
    expect(ended).toMatchObject([
      { ok: false, stop: "time" },
      { ok: false, stop: "time" },
      { ok: false, stop: "busy" },
      { ok: false, stop: "busy" },
    ])
  })

  it("runs a script, answers each operation at once and keeps the last value and the logs", async () => {
    const end = await runScript(
      `const a = insert({ kind: "text", at: 1 }); print("made", a.verb, a.fields.at); console.log({ n: 2 }); [a.verb, 6 * 7]`,
    )
    expect(end).toEqual({ ok: true, result: ["insert", 42], logs: ["made insert 1", '{"n":2}'] })
  })

  it("throws a refused operation into the script with its line, and a caught one lets it go on", async () => {
    const thrown = await runScript(`const a = 1\nrefuse({})\n`)
    expect(thrown).toMatchObject({ ok: false, stop: "threw", message: "Operation 1 (refuse): no.", line: 2 })
    const caught = await runScript(`try { refuse({}) } catch (e) { print(e.message) }; "on"`)
    expect(caught).toEqual({ ok: true, result: "on", logs: ["Operation 1 (refuse): no."] })
  })

  it("stops a busy script at the time cap while the event loop and a second script keep answering", async () => {
    let ticks = 0
    const ticking = setInterval(() => (ticks += 1), 10)
    const started = performance.now()
    const busy = runScript("while (true) {}", "account-a", 1_500)
    await new Promise((resolve) => setTimeout(resolve, 200))
    const second = await runScript("1 + 1", "account-b")
    const answeredAfter = performance.now() - started
    const stopped = await busy
    clearInterval(ticking)
    expect(second).toMatchObject({ ok: true, result: 2 })
    expect(answeredAfter).toBeLessThan(1_000)
    expect(stopped).toMatchObject({ ok: false, stop: "time" })
    expect(ticks).toBeGreaterThan(60)
    expect(await runScript("3")).toMatchObject({ ok: true, result: 3 })
  })

  it("stops a script that grows past its memory or its stack", async () => {
    const fits = await runScript("new ArrayBuffer(40 * 1024 * 1024).byteLength")
    expect(fits).toMatchObject({ ok: true, result: 40 * 1024 * 1024 })
    const grown = await runScript("new ArrayBuffer(65 * 1024 * 1024)")
    expect(grown).toMatchObject({ ok: false, stop: "threw", message: "out of memory" })
    const deep = await runScript("function f(n) { return f(n + 1) + 1 }\nf(0)")
    expect(deep).toMatchObject({ ok: false, stop: "threw", message: "stack overflow", line: 1 })
    expect(scriptLimits).toMatchObject({ memory: 64 * 1024 * 1024, stack: 1024 * 1024 })
  })

  it("gives a script no network, no modules, no process and no files", async () => {
    const end = await runScript(
      "[typeof fetch, typeof require, typeof process, typeof XMLHttpRequest, typeof Deno, typeof Bun, typeof setTimeout, typeof globalThis.os, typeof globalThis.std]",
    )
    expect(end).toEqual({ ok: true, result: Array(9).fill("undefined"), logs: [] })
    const imported = await runScript(`import("node:fs")`)
    expect(imported.ok ? imported.result : imported).not.toHaveProperty("readFileSync")
  })
})
