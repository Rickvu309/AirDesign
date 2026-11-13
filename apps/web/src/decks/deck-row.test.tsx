import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DeckTableHeader } from "@/decks/deck-row"

describe("deck list heads", () => {
  it("keeps the design screen's sort marks", () => {
    expect(renderToStaticMarkup(<DeckTableHeader />)).toContain("<svg")
  })

  it("are plain headings with no sort mark where the list does not sort", () => {
    const html = renderToStaticMarkup(<DeckTableHeader sortMarks={false} />)
    expect(html).not.toContain("<svg")
    expect(html).not.toContain("<button")
    for (const head of ["Name", "Edited", "Created"]) expect(html).toContain(head)
  })
})
