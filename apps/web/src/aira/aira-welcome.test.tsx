import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AiraWelcome } from "@/aira/aira-welcome"
import { airaCopy } from "@/copy/aira-copy"
import { productCopy } from "@/copy/product-copy"

function shownText(markup: string): string[] {
  return markup
    .replace(/<[^>]+>/g, "\n")
    .replaceAll("&#x27;", "'")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

describe("Aira's welcome", () => {
  it("shows Aira's name and one line, with nothing to pick", () => {
    const markup = renderToStaticMarkup(<AiraWelcome />)
    expect(shownText(markup)).toEqual([productCopy.agentName, airaCopy.welcome])
    expect(markup).not.toContain("<button")
  })

  it("says where Aira is not offered, in place of the line, and that the person can keep editing", () => {
    expect(shownText(renderToStaticMarkup(<AiraWelcome notOffered />))).toEqual([
      productCopy.agentName,
      `${airaCopy.notOffered} ${airaCopy.notOfferedBody}`,
    ])
  })
})
