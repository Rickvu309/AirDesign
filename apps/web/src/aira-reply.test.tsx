import { catalog, projectTools } from "@airdesign/catalog"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { AiraEnd, AiraExchange, AiraStep, ToolState } from "@/aira-loop"
import { ExchangeView } from "@/aira-reply"
import { stepLine } from "@/aira-steps"
import { airaCopy } from "@/copy/aira-copy"
import { productCopy } from "@/copy/product-copy"

const states: readonly ToolState[] = ["working", "done", "refused", "stopped"]
const markOf: Readonly<Record<ToolState, string>> = {
  working: "progress",
  done: "check",
  refused: "x",
  stopped: "x",
}

function exchange(steps: readonly AiraStep[], end: AiraEnd = "done", runs: readonly string[] = []): AiraExchange {
  return { asked: "Make the title shorter", steps, end, runs }
}

function view(of: AiraExchange, onRetry?: () => void) {
  return renderToStaticMarkup(<ExchangeView exchange={of} resets={undefined} onUndo={undefined} onRetry={onRetry} />)
}

function plain(markup: string): string {
  return markup.replaceAll("&#x27;", "'")
}

function marks(markup: string): string[] {
  return [...markup.matchAll(/data-step-mark="([a-z]+)"/gu)].map((found) => found[1] ?? "")
}

describe("a step Aira takes", () => {
  it("shows a progress mark while it runs, a check when it is done, and a cross when it was refused or stopped, for every step word", () => {
    for (const { name } of projectTools(catalog)) {
      for (const state of states) {
        const words = stepLine(name, state)
        if (words === null) continue
        const markup = view(
          exchange([{ kind: "tool", id: "t1", name, state }], state === "working" ? "working" : "done"),
        )
        expect(plain(markup), `${name} ${state}`).toContain(words)
        expect(marks(markup), `${name} ${state}`).toEqual([markOf[state]])
      }
    }
  })

  it("marks the summary of several finished steps and each step it opens to", () => {
    const steps: AiraStep[] = [
      { kind: "tool", id: "t1", name: "airdesign_read_deck", state: "done" },
      { kind: "tool", id: "t2", name: "airdesign_edit_deck", state: "done" },
    ]
    expect(marks(view(exchange(steps)))).toEqual(["check"])
  })

  it("moves nothing for a person who asked for reduced motion", () => {
    const markup = view(
      exchange([{ kind: "tool", id: "t1", name: "airdesign_edit_deck", state: "working" }], "working"),
    )
    expect(markup).toMatch(/data-step-mark="progress"[^>]*class="[^"]*motion-safe:animate-spin/u)
    expect(markup).not.toMatch(/data-step-mark="progress"[^>]*class="[^"]*(?<!motion-safe:)animate-spin/u)
  })
})

describe("a request that could not finish", () => {
  it("offers Try again when it failed and a retry can work", () => {
    expect(view(exchange([], "failed"), () => undefined)).toContain(airaCopy.retry)
  })

  it("offers no Try again when nothing can be retried", () => {
    expect(view(exchange([], "failed"))).not.toContain(airaCopy.retry)
    for (const end of ["out-of-usage", "signed-out", "country", "off", "malformed"] as const) {
      expect(
        view(exchange([], end), () => undefined),
        end,
      ).not.toContain(airaCopy.retry)
    }
  })

  it("says what is true when Aira is switched off or the chat cannot be sent, and offers Undo only when runs landed", () => {
    const off = plain(view(exchange([], "off"), () => undefined))
    expect(off).toContain(airaCopy.offTitle)
    expect(off).toContain(airaCopy.offBody)
    expect(off).not.toContain(airaCopy.failedTitle)
    const malformed = plain(view(exchange([], "malformed"), () => undefined))
    expect(malformed).toContain(airaCopy.malformedTitle)
    expect(malformed).toContain(airaCopy.malformedBody)
    expect(malformed).not.toContain(productCopy.undo)
    const landed = plain(
      renderToStaticMarkup(
        <ExchangeView
          exchange={exchange([], "off", ["r1"])}
          resets={undefined}
          onUndo={() => undefined}
          onRetry={undefined}
        />,
      ),
    )
    expect(landed).toContain(airaCopy.keptNote)
    expect(landed).toContain(productCopy.undo)
  })

  it("says plainly that Aira is not offered in the person's country or region", () => {
    const markup = view(exchange([], "country"), () => undefined)
    expect(plain(markup)).toContain(airaCopy.notOffered)
    expect(markup).not.toContain(airaCopy.failedTitle)
  })

  it("names what failed and the next step", () => {
    expect(airaCopy.failedNothing).toMatch(/try again/iu)
    expect(airaCopy.failedKept).toMatch(/try again/iu)
  })
})
