import { describe, expect, it } from "vitest"
import { fragment } from "./fragment.mjs"

const labels = { before: "main", after: "this PR" }

describe("before-after fragment", () => {
  it("writes the heading, the annotated image and a main | this PR row per state", () => {
    const text = fragment({
      labels,
      images: ["annotated-1.png"],
      rows: [
        { title: "Agent panel, empty", before: "agent-empty-before.png", after: "agent-empty-after.png" },
        { title: "Agent | panel [new]", before: null, beforeOutcome: "new", after: "agent-new-after.png" },
      ],
      link: (file) => `https://example.test/${file}`,
    })
    expect(text).toBe(
      [
        "## Before / after",
        "",
        "![Annotated before and after: Agent panel, empty; Agent panel new](https://example.test/annotated-1.png)",
        "",
        "| main | this PR |",
        "| --- | --- |",
        "| ![main: Agent panel, empty](https://example.test/agent-empty-before.png) | ![this PR: Agent panel, empty](https://example.test/agent-empty-after.png) |",
        "| New in this PR | ![this PR: Agent panel new](https://example.test/agent-new-after.png) |",
        "",
      ].join("\n"),
    )
  })

  it("says the base failed when main could not be captured, and never calls it new", () => {
    const text = fragment({
      labels,
      images: [],
      rows: [
        { title: "Broken on main", before: null, beforeOutcome: "failed", after: "broken-after.png" },
        { title: "Old summary", before: null, after: "old-after.png" },
      ],
    })
    expect(text).toContain("| Failed on main | ![this PR: Broken on main](broken-after.png) |")
    expect(text).toContain("| Failed on main | ![this PR: Old summary](old-after.png) |")
    expect(text).not.toContain("New in this PR")
  })

  it("puts each part of a split image in its own paragraph", () => {
    const text = fragment({ labels, images: ["annotated-1.png", "annotated-2.png"], rows: [] })
    expect(text).toContain("part 1](annotated-1.png)\n\n![Annotated before and after, part 2](annotated-2.png)\n\n|")
  })
})
