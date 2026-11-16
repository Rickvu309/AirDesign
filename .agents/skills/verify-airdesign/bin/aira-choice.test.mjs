import { describe, expect, it } from "vitest"
import { airaArgs, airaChoice, airaFlags } from "./aira-choice.mjs"

const efforts = ["low", "medium", "high", "xhigh", "max"]
const key = "sk-test-not-real"

describe("airaChoice", () => {
  it("a launch with no Aira flags keeps the recorded streams and today's model and effort", () => {
    expect(airaChoice([], {}, efforts)).toEqual({ ok: true, choice: {} })
  })

  it("names the key's variable, model and effort, and never carries the key itself", () => {
    const chosen = airaChoice(
      ["--model-key-env", "BENCH_KEY", "--model", "claude-opus-5-5", "--effort", "high"],
      { BENCH_KEY: key },
      efforts,
    )
    expect(chosen).toEqual({ ok: true, choice: { keyEnv: "BENCH_KEY", model: "claude-opus-5-5", effort: "high" } })
    expect(JSON.stringify(chosen)).not.toContain(key)
  })

  it("refuses an empty key variable without printing anything from the environment", () => {
    const refused = airaChoice(["--model-key-env", "BENCH_KEY"], { BENCH_KEY: "" }, efforts)
    expect(refused).toEqual({ ok: false, message: "--model-key-env BENCH_KEY names an empty or unset variable" })
  })

  it("refuses an effort the API does not take", () => {
    expect(airaChoice(["--effort", "extreme"], {}, efforts)).toEqual({
      ok: false,
      message: "--effort extreme is not one of low, medium, high, xhigh, max",
    })
  })

  it("refuses a model name that is not a Claude model id", () => {
    expect(airaChoice(["--model", "gpt"], {}, efforts).ok).toBe(false)
  })

  it("turns a choice back into the arguments serve reads", () => {
    const choice = { keyEnv: "K", effort: "medium" }
    expect(airaArgs(choice)).toEqual(["--model-key-env", "K", "--effort", "medium"])
    expect(airaFlags(airaArgs(choice))).toEqual(choice)
  })
})
