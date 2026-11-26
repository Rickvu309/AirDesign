import { describe, expect, it } from "vitest"

import { scriptLimits, scriptPool, type Operation } from "./script-pool.js"

const echo: Operation = async (verb, fields) =>
  verb === "refuse" ? { ok: false, message: "Operation 1 (refuse): no." } : { ok: true, value: { verb, fields } }
const scripts = scriptPool(["insert", "refuse"])
const runScript = (script: string, _verbs: readonly string[], operation: Operation, ms?: number) =>
  scripts.run(script, operation, ms)

describe("script pool", () => {
  it("runs a script, answers each operation at once and keeps the last value and the logs", async () => {
    const end = await runScript(
      `const a = insert({ kind: "text", at: 1 }); print("made", a.verb, a.fields.at); console.log({ n: 2 }); [a.verb, 6 * 7]`,
      ["insert"],
      echo,
    )
    expect(end).toEqual({ ok: true, result: ["insert", 42], logs: ["made insert 1", '{"n":2}'] })
  })

  it("throws a refused operation into the script with its line, and a caught one lets it go on", async () => {
    const thrown = await runScript(`const a = 1\nrefuse({})\n`, ["refuse"], echo)
    expect(thrown).toMatchObject({ ok: false, stop: "threw", message: "Operation 1 (refuse): no.", line: 2 })
    const caught = await runScript(`try { refuse({}) } catch (e) { print(e.message) }; "on"`, ["refuse"], echo)
    expect(caught).toEqual({ ok: true, result: "on", logs: ["Operation 1 (refuse): no."] })
  })

  it("stops a busy script at the time cap while the event loop and a second script keep answering", async () => {
    let ticks = 0
    const ticking = setInterval(() => (ticks += 1), 10)
    const started = performance.now()
    const busy = runScript("while (true) {}", [], echo, 1_500)
    await new Promise((resolve) => setTimeout(resolve, 200))
    const second = await runScript("1 + 1", [], echo)
    const answeredAfter = performance.now() - started
    const stopped = await busy
    clearInterval(ticking)
    expect(second).toMatchObject({ ok: true, result: 2 })
    expect(answeredAfter).toBeLessThan(1_000)
    expect(stopped).toMatchObject({ ok: false, stop: "time" })
    expect(ticks).toBeGreaterThan(60)
    expect(await runScript("3", [], echo)).toMatchObject({ ok: true, result: 3 })
  })

  it("stops a script that grows past its memory or its stack", async () => {
    const fits = await runScript("new ArrayBuffer(40 * 1024 * 1024).byteLength", [], echo)
    expect(fits).toMatchObject({ ok: true, result: 40 * 1024 * 1024 })
    const grown = await runScript("new ArrayBuffer(65 * 1024 * 1024)", [], echo)
    expect(grown).toMatchObject({ ok: false, stop: "threw", message: "out of memory" })
    const deep = await runScript("function f(n) { return f(n + 1) + 1 }\nf(0)", [], echo)
    expect(deep).toMatchObject({ ok: false, stop: "threw", message: "stack overflow", line: 1 })
    expect(scriptLimits).toMatchObject({ memory: 64 * 1024 * 1024, stack: 1024 * 1024 })
  })

  it("gives a script no network, no modules, no process and no files", async () => {
    const end = await runScript(
      "[typeof fetch, typeof require, typeof process, typeof XMLHttpRequest, typeof Deno, typeof Bun, typeof setTimeout, typeof globalThis.os, typeof globalThis.std]",
      [],
      echo,
    )
    expect(end).toEqual({ ok: true, result: Array(9).fill("undefined"), logs: [] })
    const imported = await runScript(`import("node:fs")`, [], echo)
    expect(imported.ok ? imported.result : imported).not.toHaveProperty("readFileSync")
  })
})
