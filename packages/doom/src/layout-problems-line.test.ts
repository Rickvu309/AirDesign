import { describe, expect, it } from "vitest"
import { type TreeNode, doomFromTree } from "./doom-tree.js"
import { layoutProblems } from "./layout-problems.js"
import { block, label, measure, plainTheme, spot } from "./testing/doom-fixtures-art.js"

function rule(
  name: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  weight = 1,
  dash: "solid" | "dash" = "solid",
): TreeNode {
  return {
    type: "shape",
    name,
    props: {
      box: spot(
        Math.min(start.x, end.x),
        Math.min(start.y, end.y),
        Math.abs(end.x - start.x),
        Math.abs(end.y - start.y),
      ),
      geometry: { kind: "line", start, end, route: "straight", arrows: ["none", "none"] },
      strokes: [{ kind: "solid", color: { var: "text" } }],
      stroke: { weight, align: "center", dash },
    },
  }
}

function found(children: readonly TreeNode[]) {
  const grown = doomFromTree({ theme: plainTheme, slides: [{ children }] })
  return { ids: grown.ids, problems: layoutProblems(grown.doom, grown.slides, measure) }
}

describe("layout problems: strokes through words", () => {
  it("reports a one-pixel rule across words in a table row, naming the actual layers", () => {
    const { ids, problems } = found([
      {
        ...block("Table", 320, 80, { box: spot(100, 100, 320, 80) }),
        children: [label("Region", "North", { box: spot(10, 10, 140, 40) })],
      },
      rule("Note rule", { x: 80, y: 125 }, { x: 400, y: 125 }),
    ])
    expect(problems).toEqual([
      {
        code: "line-crosses-text",
        node: ids.Region,
        with: ids["Note rule"],
      },
    ])
  })

  it("reports each bar value label that a ceiling line crosses", () => {
    const { ids, problems } = found([
      rule("Ceiling", { x: 80, y: 115 }, { x: 500, y: 115 }),
      label("Value one", "+7.0", { box: spot(110, 100, 80, 40) }),
      label("Value two", "190.7", { box: spot(300, 100, 80, 40) }),
    ])
    expect(problems).toMatchObject([
      { code: "line-crosses-text", node: ids["Value one"], with: ids.Ceiling },
      { code: "line-crosses-text", node: ids["Value two"], with: ids.Ceiling },
    ])
  })

  it("exempts the labels inside both boxes a connector attaches to", () => {
    const arrow: TreeNode = {
      type: "shape",
      name: "Connector",
      props: (ids) => ({
        box: spot(150, 125, 200, 0),
        geometry: {
          kind: "line",
          start: { node: ids.Start!, site: "c" },
          end: { node: ids.End!, site: "c" },
          route: "straight",
          arrows: ["none", "arrow"],
        },
        strokes: [{ kind: "solid", color: { var: "text" } }],
      }),
    }
    const { ids, problems } = found([
      {
        ...block("Start", 100, 50, { box: spot(100, 100, 100, 50) }),
        children: [label("First label", "Yes", { box: spot(55, 10, 45, 30) })],
      },
      {
        ...block("End", 100, 50, { box: spot(300, 100, 100, 50) }),
        children: [label("Last label", "Off", { box: spot(5, 10, 45, 30) })],
      },
      label("Crossed label", "Via", { box: spot(220, 110, 60, 30) }),
      arrow,
    ])
    expect(problems).toMatchObject([{ code: "line-crosses-text", node: ids["Crossed label"], with: ids.Connector }])
  })

  it("allows a leader ending at its label and a rule crossing only the label box padding", () => {
    const { problems } = found([
      label("Label", "Target", { box: spot(200, 100, 200, 40) }, { paras: [{ align: "center" }] }),
      rule("Leader", { x: 80, y: 115 }, { x: 285, y: 115 }),
      rule("Divider", { x: 220, y: 80 }, { x: 220, y: 145 }),
    ])
    expect(problems).toEqual([])
  })

  it("uses the visible width and dash gaps of a stroke", () => {
    const { ids, problems } = found([
      label("Over a dash", "A", { box: spot(115, 100, 20, 40) }),
      label("In the gap", "B", { box: spot(175, 100, 20, 40) }),
      rule("Reference", { x: 100, y: 99 }, { x: 500, y: 99 }, 20, "dash"),
    ])
    expect(problems).toMatchObject([{ code: "line-crosses-text", node: ids["Over a dash"], with: ids.Reference }])
  })
})
