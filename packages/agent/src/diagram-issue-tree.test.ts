import { guide, guides } from "@airdesign/taste"
import { describe, expect, it } from "vitest"

import {
  clean,
  type Drawing,
  near,
  recipe,
  refused,
  sample,
  styles,
  wellJoined,
  withData,
} from "./testing/diagram-drawing.js"

type Branch = { readonly text: string; readonly status?: string; readonly children?: readonly Branch[] }

function treeDrawn(drawing: Drawing, question: string, tree: readonly Branch[]) {
  const all: { readonly item: Branch; readonly depth: number; readonly parent: Branch | null }[] = []
  const walk = (item: Branch, depth: number, parent: Branch | null): void => {
    all.push({ item, depth, parent })
    for (const child of item.children ?? []) walk(child, depth + 1, item)
  }
  const root: Branch = { text: question, children: tree }
  walk(root, 0, null)
  const boxes = all.map(({ item }) => drawing.named(item.text))
  const boxOf = (item: Branch) => drawing.named(item.text)
  wellJoined(boxes, drawing.lines)
  const proven = (item: Branch): boolean =>
    item.children === undefined ? item.status === "proven" : item.children.some(proven)

  const joins = all.filter(({ parent }) => parent !== null)
  expect(drawing.lines.map((line) => `${line.from} ${line.to}`).sort()).toEqual(
    joins.map(({ item, parent }) => `${boxOf(parent!).id} ${boxOf(item).id}`).sort(),
  )
  for (const line of drawing.lines) {
    const [from, to] = [boxes.find((box) => box.id === line.from)!, boxes.find((box) => box.id === line.to)!]
    expect(near(line.points[0]!.x, from.box.x + from.box.w), line.name).toBe(true)
    expect(near(line.points.at(-1)!.x, to.box.x), line.name).toBe(true)
    const item = all.find(({ item }) => boxOf(item).id === line.to)!.item
    expect(line.stroke.includes("accent1"), line.name).toBe(proven(item))
  }

  const columns = new Map<number, Set<number>>()
  for (const { item, depth } of all) columns.set(depth, (columns.get(depth) ?? new Set()).add(boxOf(item).box.x))
  for (const [depth, xs] of columns) expect(xs.size, `level ${String(depth)} is one column`).toBe(1)
  const lefts = [...columns.keys()].toSorted().map((depth) => [...columns.get(depth)!][0]!)
  for (const [at, x] of lefts.slice(1).entries()) expect(x).toBeGreaterThan(lefts[at]!)

  for (const { item } of all) {
    const kids = (item.children ?? []).map((kid) => boxOf(kid).box)
    if (kids.length === 0) continue
    const own = boxOf(item).box
    const middle = own.y + own.h / 2
    expect(middle, item.text).toBeGreaterThanOrEqual(kids[0]!.y)
    expect(middle, item.text).toBeLessThanOrEqual(kids.at(-1)!.y + kids.at(-1)!.h)
    for (const [at, kid] of kids.slice(1).entries()) expect(kid.y, item.text).toBeGreaterThan(kids[at]!.y)
    expect(boxOf(item).stroke.includes("accent1"), item.text).toBe(proven(item))
  }
  for (const { item } of all.filter(({ item }) => item.children === undefined)) {
    expect(boxOf(item).stroke.includes("accent1"), item.text).toBe(false)
  }

  const leaves = all.filter(({ item }) => item.children === undefined)
  const right = new Set(leaves.map(({ item }) => boxOf(item).box.x + boxOf(item).box.w))
  expect(right.size, "leaves end on one edge").toBe(1)
  const words: Record<string, string> = { proven: "Proven", disproven: "Disproven", open: "Open" }
  const tokens: Record<string, string> = { proven: "accent1", disproven: "text2", open: "text" }
  const statusX = new Set<number>()
  for (const { item } of leaves) {
    const status = drawing.named(`${item.text} status`)
    const leaf = boxOf(item).box
    expect(status.text, item.text).toBe(words[item.status!])
    expect(JSON.parse(status.color), item.text).toMatchObject({ var: tokens[item.status!] })
    expect(status.box.x, item.text).toBeGreaterThan(leaf.x + leaf.w)
    expect(near(status.box.y + status.box.h / 2, leaf.y + leaf.h / 2), item.text).toBe(true)
    statusX.add(status.box.x)
  }
  expect(statusX.size, "statuses in one column").toBe(1)
}

const leafText =
  "Bookings count at signature while finance counts at payment, so the totals differ in 12 of 12 accounts"
const wordyTree: readonly Branch[] = [
  {
    text: "They do not know the dashboard exists at all",
    children: [
      { text: leafText, status: "proven" },
      { text: `${leafText} again`, status: "disproven" },
      { text: `${leafText} once more`, status: "open" },
    ],
  },
  {
    text: "They know about it but choose to use something else",
    children: [
      { text: `${leafText} in sales`, status: "open" },
      { text: `${leafText} in finance`, status: "disproven" },
      { text: `${leafText} in support`, status: "open" },
    ],
  },
]
const statuses = ["proven", "open", "disproven"] as const
const widestTree: readonly Branch[] = Array.from({ length: 3 }, (_, b) => ({
  text: `Branch ${String(b + 1)}`,
  children: Array.from({ length: 2 }, (_, s) => ({
    text: `Cause ${String(b + 1)}.${String(s + 1)}`,
    children: Array.from({ length: 2 }, (_, l) => ({
      text: `Hypothesis ${String(b + 1)}.${String(s + 1)}.${String(l + 1)} that a test can settle`,
      status: statuses[(b + s + l) % 3]!,
    })),
  })),
}))
const smallestTree: readonly Branch[] = [
  {
    text: "Price",
    children: [
      { text: "Too high", status: "proven" },
      { text: "Too low", status: "disproven" },
    ],
  },
  {
    text: "Product",
    children: [
      { text: "Missing a size", status: "open" },
      { text: "Wrong colour", status: "open" },
    ],
  },
]

describe("the issue tree recipe", () => {
  for (const style of styles)
    it(`draws its sample in ${style}: levels left to right, attached elbows, a status word on every leaf`, async () => {
      treeDrawn(
        await clean(style, recipe("issue-tree")),
        sample("issue-tree", "question"),
        sample("issue-tree", "tree"),
      )
    })

  for (const style of ["consulting", "midnight"]) {
    it(`holds 12 leaves on 3 levels in ${style}`, async () => {
      const question = "Why did repeat orders fall in the second quarter?"
      treeDrawn(await clean(style, withData("issue-tree", { question, tree: widestTree })), question, widestTree)
    })

    it(`holds 6 long leaves on 2 levels in ${style}`, async () => {
      const question = "Why do so few managers open the sales dashboard every week, even after the launch?"
      treeDrawn(await clean(style, withData("issue-tree", { question, tree: wordyTree })), question, wordyTree)
    })
  }

  it("holds the smallest tree: 2 branches of 2 leaves", async () => {
    treeDrawn(
      await clean("neutral", withData("issue-tree", { question: "Why are sales down?", tree: smallestTree })),
      "Why are sales down?",
      smallestTree,
    )
  })

  it("stops with a sentence the agent can act on for a split into one, a missing status, 13 leaves or 4 levels", async () => {
    const one = [smallestTree[0]!, { text: "Product", children: [{ text: "Only", status: "open" }] }]
    expect(await refused(withData("issue-tree", { tree: one }))).toContain('\\"Product\\" splits into 1')
    const bare = [smallestTree[0]!, { text: "Product", children: [{ text: "A" }, { text: "B", status: "open" }] }]
    expect(await refused(withData("issue-tree", { tree: bare }))).toContain("needs a status: proven, disproven or open")
    const many = [
      ...widestTree,
      {
        text: "More",
        children: [
          { text: "M1", status: "open" },
          { text: "M2", status: "open" },
        ],
      },
    ]
    expect(await refused(withData("issue-tree", { tree: many }))).toContain("The tree has 14 leaves")
    const deep = [
      {
        text: "D",
        children: [
          { text: "D1", children: smallestTree },
          { text: "D2", status: "open" },
        ],
      },
      smallestTree[1]!,
    ]
    expect(await refused(withData("issue-tree", { tree: deep }))).toContain("The tree has 4 levels under the question")
  })
})

describe("the diagram skills", () => {
  it("are listed in the index and named in the kit guide", () => {
    const names = guides().map((skill) => skill.name)
    const kit = guide("kit")?.markdown ?? ""
    for (const name of ["diagrams/architecture", "diagrams/process-flow", "diagrams/issue-tree"]) {
      expect(names).toContain(name)
      expect(kit).toContain(`\`${name}\``)
    }
  })
})
