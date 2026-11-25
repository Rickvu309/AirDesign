import { airaFontRequest } from "@/copy/aira-copy"
import { catalog, projectTools } from "@airdesign/catalog"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { AiraEnd, AiraExchange, AiraStep, ToolState } from "@/aira/aira-loop"
import { ExchangeView } from "@/aira/aira-reply"
import { stepLine } from "@/aira/aira-steps"
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

describe("a step that is running", () => {
  it("shows the spinner as its one working signal and leaves its words still", () => {
    const steps: AiraStep[] = [
      { kind: "tool", id: "t1", name: "airdesign_read_deck", state: "done" },
      { kind: "tool", id: "t2", name: "airdesign_edit_deck", state: "working" },
    ]
    const markup = view(exchange(steps, "working"))
    expect(marks(markup)).toContain("progress")
    expect(markup).not.toContain("shimmer")
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

describe("a request Aira's changes were undone from", () => {
  function offered(of: AiraExchange) {
    return plain(
      renderToStaticMarkup(
        <ExchangeView exchange={of} resets={undefined} onUndo={() => undefined} onRetry={undefined} />,
      ),
    )
  }

  const edited: AiraStep[] = [{ kind: "tool", id: "t1", name: "airdesign_edit_deck", state: "done" }]

  it("says the changes are undone and offers Undo no more", () => {
    const markup = offered(exchange(edited, "undone", ["r1"]))
    expect(markup).toContain(airaCopy.undone)
    expect(markup).not.toContain(`>${productCopy.undo}<`)
  })

  it("names the layers the undo kept because they were changed after Aira made them", () => {
    const one = offered({ ...exchange(edited, "undone", ["r1"]), kept: ["“Revenue”"] })
    expect(one).toContain(`${airaCopy.undone} “Revenue” stays because it was changed after Aira made it.`)
    const two = offered({ ...exchange(edited, "undone", ["r1"]), kept: ["a group", "“Revenue”"] })
    expect(two).toContain("A group and “Revenue” stay because they were changed after Aira made them.")
  })

  it("names a deleted component whose update the undo skipped", () => {
    const markup = offered({ ...exchange(edited, "undone", ["r1"]), skipped: ["“Tile”"] })
    expect(markup).toContain(`${airaCopy.undone} The component “Tile” was deleted, so its update wasn't undone.`)
  })

  it("names what stays and offers Undo again when the undo landed nothing, as the Agents panel does", () => {
    const markup = offered({ ...exchange(edited, "done", ["r1"]), left: ["“Card”"], waiting: ["“Logo”"] })
    expect(markup).toContain(
      "“Card” stays where it is, because the place it came from has changed. “Logo” can't come back until the frame it was in is back.",
    )
    expect(markup).not.toContain(airaCopy.undone)
    expect(markup).not.toContain(airaCopy.undoRefused)
    expect(markup).toContain(productCopy.undo)
  })

  it("says the undo was refused and still offers Undo, which works again once the newer change is undone", () => {
    const markup = offered({ ...exchange(edited, "done", ["r1"]), undoRefused: true })
    expect(markup).toContain(airaCopy.undoRefused)
    expect(markup).toContain(productCopy.undo)
  })

  it("says an undo failed and offers Undo again", () => {
    const markup = offered({ ...exchange(edited, "done", ["r1"]), undoFailed: true })
    expect(markup).toContain(airaCopy.undoFailed)
    expect(markup).toContain(productCopy.undo)
    expect(markup).not.toMatch(/<button[^>]*\sdisabled=""/u)
  })
})

it("names the missing glyphs and layers and offers a font fix instead of a plain retry", () => {
  const refused = exchange([
    {
      kind: "tool",
      id: "t1",
      name: "airdesign_edit_deck",
      state: "refused",
      refusal: "fonts",
      fontIssue: { kind: "coverage", characters: "収益", layers: ["t:2", "t:3"], layerNames: [] },
    },
  ])
  const markup = view(refused, () => undefined)
  expect(markup).not.toContain("t:2")
  expect(markup).not.toContain("t:3")
  expect(markup).toContain("2 text layers")
  expect(markup).toContain(airaCopy.fixFonts)
  expect(markup).not.toContain(airaCopy.retry)
})

it("clears the font refusal after the same bake succeeds in the turn", () => {
  const markup = view(
    exchange([
      {
        kind: "tool",
        id: "t1",
        name: "airdesign_edit_deck",
        state: "refused",
        refusal: "fonts",
        fontIssue: { kind: "coverage", characters: "収益", layers: ["t:2"], layerNames: [], target: "t:1" },
      },
      { kind: "tool", id: "t2", name: "airdesign_edit_deck", state: "done", bakedLayouts: ["t:1"] },
    ]),
    () => undefined,
  )
  expect(markup).not.toContain(airaCopy.fixFonts)
  expect(markup).not.toContain("Auto layout is still on")
})

it("shows only the latest reason for a frame Aira tried twice", () => {
  const issue = { characters: "", layers: ["t:2"], layerNames: ["Revenue"], target: "t:1" }
  const markup = view(
    exchange([
      {
        kind: "tool",
        id: "t1",
        name: "airdesign_edit_deck",
        state: "refused",
        refusal: "fonts",
        fontIssue: { ...issue, kind: "coverage" },
      },
      {
        kind: "tool",
        id: "t2",
        name: "airdesign_edit_deck",
        state: "refused",
        refusal: "fonts",
        fontIssue: { ...issue, kind: "pending" },
      },
    ]),
    () => undefined,
  )
  expect(markup).toContain("A font hasn’t loaded")
  expect(markup).toContain("Try again when the text updates.")
  expect(markup).not.toContain("Aira can switch fonts")
  expect(markup).not.toContain("Couldn't edit slides")
})

it("asks Aira to retry every change in the refused batch with the fonts fixed", () => {
  const request = airaFontRequest(["t:2"], "t:1")
  expect(request).toContain("Retry the whole refused edit_deck batch")
  expect(request).toContain("Include every other change in the batch")
  expect(request).toContain("None of that batch landed")
})

it("names the text Aira cannot shape and offers the Design panel", () => {
  const markup = view(
    exchange([
      {
        kind: "tool",
        id: "t1",
        name: "airdesign_edit_deck",
        state: "refused",
        refusal: "fonts",
        fontIssue: {
          kind: "shaping",
          characters: "",
          layers: ["t:2"],
          layerNames: ["Greeting"],
          shaping: ["Arabic text"],
        },
      },
    ]),
    () => undefined,
  )
  expect(markup).toContain("Arabic text in “Greeting”")
  expect(markup).toContain("None of the changes in this edit were applied.")
  expect(markup).toContain("You can remove auto layout in the Design panel.")
  expect(markup).not.toContain(airaCopy.retry)
})
