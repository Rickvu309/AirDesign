import { describe, expect, it } from "vitest"
import { rules } from "./testing/problem-rules.js"
import { type TreeNode, type TreeSlide, doomFromTree } from "./doom-tree.js"
import { layoutProblems, type ProblemRules } from "./layout-problems.js"
import type { Color } from "./paint.js"
import { block, label, measure, plainTheme, spot, swatches } from "./testing/doom-fixtures-art.js"

const contrast: ProblemRules = { ...rules, contrast: { min: 4.5, large: { size: 40, min: 3 } } }

const ink = (color: Color, size = 20) => ({ spans: [{ end: 16, color, size }] })
const fill = (color: Color, opacity?: number) => ({
  fills: [{ kind: "solid" as const, color, ...(opacity === undefined ? {} : { opacity }) }],
})

function found(children: readonly TreeNode[], slide: TreeSlide["props"] = {}, given = contrast) {
  const grown = doomFromTree({ theme: plainTheme, slides: [{ props: slide, children }] })
  return { ids: grown.ids, problems: layoutProblems(grown.doom, grown.slides, measure, given) }
}

describe("layout problems: words too faint on what is painted behind them", () => {
  it("names white words on a pale card, with the ratio measured and the minimum", () => {
    const { ids, problems } = found([
      {
        ...block("Card", 600, 200, { box: spot(100, 100, 600, 200), ...fill({ var: "background2" }) }),
        children: [label("Words", "Revenue grew 18%", { box: spot(20, 20, 400, 60) }, ink({ var: "background" }))],
      },
    ])
    expect(problems).toEqual([{ code: "low-contrast", node: ids.Words, ratio: 1.16, min: 4.5 }])
  })

  it("stays quiet for white words on a dark card and for dark words on the slide", () => {
    const { problems } = found([
      {
        ...block("Card", 600, 200, { box: spot(100, 100, 600, 200), ...fill({ var: "text" }) }),
        children: [label("On card", "Revenue grew 18%", { box: spot(20, 20, 400, 60) }, ink({ var: "background" }))],
      },
      label("On slide", "Revenue grew 18%", { box: spot(100, 500, 400, 60) }),
    ])
    expect(problems).toEqual([])
  })

  it("judges words against the slide's own fill when nothing else lies under them", () => {
    const words = label("Words", "Revenue grew 18%", { box: spot(100, 100, 400, 60) }, ink({ var: "background" }))
    expect(found([words], fill({ var: "text" })).problems).toEqual([])
    expect(found([words]).problems).toMatchObject([{ code: "low-contrast", ratio: 1, min: 4.5 }])
  })

  it("asks less of words at the large size the rule names", () => {
    const grey = swatches.grey
    const small = found([label("Words", "Revenue grew 18%", { box: spot(100, 100, 900, 80) }, ink(grey, 39))])
    const large = found([label("Words", "Revenue grew 18%", { box: spot(100, 100, 900, 80) }, ink(grey, 40))])
    expect(small.problems).toEqual([{ code: "low-contrast", node: small.ids.Words, ratio: 3.54, min: 4.5 }])
    expect(large.problems).toEqual([])
  })

  it("blends faded words and a tinted, see-through card into what they cover", () => {
    const faded = found([
      label("Words", "Revenue grew 18%", { box: spot(100, 100, 400, 60), opacity: 0.25 }, ink({ var: "text" })),
    ])
    expect(faded.problems).toMatchObject([{ code: "low-contrast", node: faded.ids.Words, ratio: 1.75 }])
    const tinted = found([
      {
        ...block("Card", 600, 200, { box: spot(100, 100, 600, 200), ...fill({ var: "accent1", tint: 0.8 }) }),
        children: [label("Words", "Revenue grew 18%", { box: spot(20, 20, 400, 60) }, ink({ var: "background" }))],
      },
    ])
    expect(tinted.problems).toMatchObject([{ code: "low-contrast", node: tinted.ids.Words, ratio: 1.53 }])
    const sheer = found([
      block("Card", 600, 200, { box: spot(100, 100, 600, 200), ...fill({ var: "text" }, 0.1) }),
      label("Words", "Revenue grew 18%", { box: spot(120, 120, 400, 60) }, ink({ var: "background" })),
    ])
    expect(sheer.problems).toMatchObject([{ code: "low-contrast", node: sheer.ids.Words, ratio: 1.23 }])
  })

  it("judges a lower sibling only where it covers the words, and leaves a split backdrop alone", () => {
    const covered = found([
      block("Band", 1920, 300, { box: spot(0, 80, 1920, 300), ...fill({ var: "text" }) }),
      label("Words", "Revenue grew 18%", { box: spot(100, 100, 400, 60) }, ink({ var: "background" })),
    ])
    expect(covered.problems).toEqual([])
    const split = found([
      block("Band", 1920, 300, { box: spot(0, 120, 1920, 300), ...fill({ var: "text" }) }),
      label("Words", "Revenue grew 18%", { box: spot(100, 100, 400, 60) }, ink({ var: "background" })),
    ])
    expect(split.problems.filter((problem) => problem.code === "low-contrast")).toEqual([])
  })

  it("judges nothing when the rules name no contrast", () => {
    const words = label("Words", "Revenue grew 18%", { box: spot(100, 100, 400, 60) }, ink({ var: "background" }))
    expect(found([words], {}, rules).problems).toEqual([])
  })
})
