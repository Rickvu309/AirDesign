---
name: issue-tree
description: "Before you break a question into causes or options, read the script that draws a MECE tree left to right with a status on each leaf."
---

# Issue tree

A question on the left splits into 2 to 4 branches, and each branch into the hypotheses that would answer it. Each leaf ends in a status: proven, disproven or open. The lines and boxes leading to a proven leaf take the accent and the proven leaf is bold, so the path the team followed reads at a glance and the rest stays grey.

## When

- Why something happened, or how to reach a goal, when the answer has more than one possible cause or lever: a diagnosis, the plan for an investigation.
- 2 or 3 levels under the question, and up to 12 leaves. With more, give each branch its own slide and keep the whole tree, leaves cut, as the overview.
- Steps in order are a `diagrams/process-flow`; parts that call each other are a `diagrams/architecture`.

## The rules

- MECE: no hypothesis fits two branches, and together the branches cover the question. Make the first split exhaustive by construction, such as "they know about it / they do not", so it has no third case.
- Write each leaf as a claim a test can settle: "Bookings count at signature, finance at payment", not "Data issues". Once tested, end it with the evidence in a few words: "12 of 12 accounts".
- `status` on every leaf: `proven`, `disproven` or `open`. The word sits beside the leaf, so the status never rests on colour alone.
- A node with children has no status: its children carry it. A node splits into 2 to 4 children; a split into one is no split.
- The title states what the tree found: the proven cause, or the open question left.

## The script

Change the values at the top: the slide, the tree's box on the slide, the question and the tree. The rest measures the words and places every layer.

```js
const slide = "<slide id>"
const box = { x: 120, y: 280, w: 1680, h: 680 }
const question = "Why do so few managers open the sales dashboard?"
const tree = [
  {
    text: "They do not know it exists",
    children: [
      { text: "It is missing from manager onboarding", status: "proven" },
      { text: "The launch email reached team leads only", status: "disproven" },
    ],
  },
  {
    text: "They know it but do not use it",
    children: [
      {
        text: "They do not trust the numbers",
        children: [
          { text: "Bookings count at signature, finance at payment: 12 of 12 accounts", status: "proven" },
          { text: "Refunds arrive a week late", status: "open" },
        ],
      },
      { text: "It is slow to load", status: "disproven" },
      { text: "It answers questions they do not ask", status: "open" },
    ],
  },
]

const words = { proven: "Proven", disproven: "Disproven", open: "Open" }
const nodes = []
const walk = (item, depth, parent) => {
  const node = { text: item.text, status: item.status, depth, parent, kids: [] }
  nodes.push(node)
  const children = item.children ?? []
  if (children.length > 0 && (children.length < 2 || children.length > 4))
    throw new Error(`"${item.text}" splits into ${children.length}: a split takes 2 to 4 parts.`)
  if (children.length > 0 && item.status !== undefined)
    throw new Error(`"${item.text}" has children, so its status comes from them: remove its status.`)
  if (children.length === 0 && words[item.status] === undefined)
    throw new Error(`"${item.text}" needs a status: proven, disproven or open.`)
  node.kids = children.map((child) => walk(child, depth + 1, node))
  return node
}
const root = { text: question, depth: 0, parent: null, kids: [] }
nodes.push(root)
if (tree.length < 2 || tree.length > 4)
  throw new Error(`The question splits into ${tree.length}: a split takes 2 to 4 branches.`)
root.kids = tree.map((item) => walk(item, 1, root))
const leaves = nodes.filter((node) => node.kids.length === 0)
const levels = Math.max(...leaves.map((leaf) => leaf.depth))
if (levels < 2 || levels > 3) throw new Error(`The tree has ${levels} levels under the question: use 2 or 3.`)
if (leaves.length > 12)
  throw new Error(`The tree has ${leaves.length} leaves: keep 12 at most, or give each branch its own slide.`)

const gap = levels === 2 ? 56 : 48
const statusW = 170
const widths = levels === 2 ? [280, 300] : [240, 240, 240]
const colX = [0]
widths.forEach((w, d) => colX.push(colX[d] + w + gap))
const leafRight = box.w - statusW - 24
const widthOf = (node) => (node.kids.length === 0 ? leafRight - colX[node.depth] : widths[node.depth])
const lit = (node) => (node.kids.length === 0 ? node.status === "proven" : node.kids.some(lit))

const frame = insert({ parent: slide, kind: "frame", layout: "none", name: "Issue tree", box })
const probe = insert({ parent: frame, kind: "text", text: "-", box: { x: 0, y: 0, w: 100, h: 40 } })
const padOf = (node) => (node.kids.length === 0 ? { t: 5, r: 12, b: 5, l: 12 } : { t: 14, r: 14, b: 14, l: 14 })
const measure = (node, textStyle) => {
  const pad = padOf(node)
  node.style = textStyle
  node.words = node.kids.length > 0 || node.status === "proven" ? `**${node.text}**` : node.text
  update({ target: probe, text: node.words, textStyle, box: { w: widthOf(node) - pad.l - pad.r } })
  node.h = Math.ceil(get({ target: probe }).box.h) + pad.t + pad.b
}
const space = (node) => (node.depth === 0 ? 24 : node.kids.every((kid) => kid.kids.length === 0) ? 8 : 16)
const sized = (node) =>
  node.kids.length === 0
    ? (node.size = node.h)
    : (node.size = Math.max(
        node.h,
        node.kids.reduce((sum, kid) => sum + sized(kid), 0) + space(node) * (node.kids.length - 1),
      ))
for (const node of nodes) measure(node, node.kids.length > 0 || leaves.length <= 8 ? "body2" : "caption")
if (sized(root) > box.h && leaves.length <= 8) for (const leaf of leaves) measure(leaf, "caption")
remove({ target: probe })
if (sized(root) > box.h)
  throw new Error(
    `The tree needs ${root.size} px of height and its box holds ${box.h}: shorten the longest leaves, or give each branch its own slide.`,
  )

const place = (node, top) => {
  if (node.kids.length === 0) return (node.y = top)
  const span = node.kids.reduce((sum, kid) => sum + kid.size, 0) + space(node) * (node.kids.length - 1)
  let at = top + (node.size - span) / 2
  for (const kid of node.kids) {
    place(kid, at)
    at += kid.size + space(node)
  }
  const first = node.kids[0]
  const last = node.kids.at(-1)
  const middle = (first.y + first.h / 2 + last.y + last.h / 2) / 2
  node.y = Math.min(Math.max(middle - node.h / 2, top), top + node.size - node.h)
}
place(root, (box.h - root.size) / 2)

for (const node of nodes)
  node.id = insert({
    parent: frame,
    kind: "shape",
    shape: "rect",
    name: node.text,
    text: node.words,
    textStyle: node.style,
    align: "left",
    alignV: "center",
    padding: padOf(node),
    fill: node.kids.length > 0 ? "background2" : "none",
    color: node.status === "disproven" ? "text2" : "text",
    stroke: node.kids.length > 0 && lit(node) ? "accent1" : "none",
    strokeWidth: 3,
    box: { x: colX[node.depth], y: Math.round(node.y), w: widthOf(node), h: node.h },
  })
const joined = nodes.filter((node) => node.parent !== null)
for (const node of joined.toSorted((p, q) => lit(p) - lit(q)))
  insert({
    parent: frame,
    kind: "line",
    name: `${node.parent.text} to ${node.text}`,
    route: "elbow",
    from: { layer: node.parent.id, side: "right" },
    to: { layer: node.id, side: "left" },
    lane: colX[node.parent.depth] + widths[node.parent.depth] + gap / 2,
    stroke: lit(node) ? "accent1" : "text2",
    strokeWidth: lit(node) ? 3 : 2,
  })
for (const leaf of leaves)
  insert({
    parent: frame,
    kind: "shape",
    shape: "rect",
    fill: "none",
    name: `${leaf.text} status`,
    text: words[leaf.status],
    textStyle: "label",
    color: leaf.status === "proven" ? "accent1" : leaf.status === "disproven" ? "text2" : "text",
    align: "left",
    alignV: "center",
    padding: 0,
    box: { x: leafRight + 24, y: Math.round(leaf.y), w: statusW, h: leaf.h },
  })
get({ target: frame }).problems
```

## After the script

- `problems` is empty, or a leaf needs fewer words.
- Read the title again: it names what the accented path found.
- Copy `kit/title-block` above the tree, in a second `airdesign_execute` call when the tree has more than 8 leaves, since one call makes at most 100 changes.
- Each node is its own layer, named after its words. Move one and its lines follow. To change the tree, remove the `Issue tree` frame and run the script again.

## How the layout works

- Columns: the question, then one column a level, joined by elbow lines that leave a parent's right side and meet each child's left side. A leaf above the last level stretches to the leaves' right edge, so every status lines up in one column.
- Rows: each leaf is as tall as its words. A parent sits level with the middle of its children, and branches of the question sit 32 px apart.
- Type: nodes in `body2`, the question and branches in bold. With more than 8 leaves, or when the tree runs out of height, leaves drop to `caption`.
