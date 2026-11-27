---
name: process-flow
description: "A script that lays out 3 to 6 steps left to right with arrows between them. Read it before you draw a process."
---

# Process flow

Shows 3 to 6 steps in order, left to right, with an arrow from each step to the next. Under each step sit one or two short points: who does it, how long it takes, how much. The step the title is about takes the accent.

## Plan it

- 3 to 6 steps, each named in one to three words: "Pick and pack".
- One or two points a step, a few words each. With 5 or 6 steps, one point each.
- More than 6 steps: merge steps, or split the flow over two slides, one per phase.
- A step that loops back or splits in two is not a flow. Draw it as an architecture diagram, or as two flows.

## Draw it

Fill in the first block with your steps, then send it and the second block, unchanged, as one `airdesign_execute` script. Here `slide` is a new slide; give an existing slide's id to draw on it. In the same script, copy `kit/title-block` and `kit/source-line` onto the slide.

```js
const slide = insert({ kind: "slide" })
const steps = [
  { name: "Take the order", points: ["Web, app and stores", "One queue for all"] },
  { name: "Pick and pack", points: ["Within two hours", "92% of orders today"] },
  { name: "Ship", points: ["Two carriers", "Next day for the rest"] },
]
const focus = "Pick and pack"
```

```js
const area = { x: 120, y: 300, w: 1680, h: 640 }
if (steps.length < 3 || steps.length > 6)
  throw new Error("A flow takes 3 to 6 steps: merge steps, or split the flow over two slides.")
const gap = 96
const w = Math.floor((area.w - gap * (steps.length - 1)) / steps.length)
const roomy = steps.length <= 4
const boxH = roomy ? 176 : 144
const placed = []
const boxes = steps.map((step, i) => {
  const x = area.x + i * (w + gap)
  const box = insert({
    parent: slide,
    kind: "shape",
    shape: "rect",
    name: step.name,
    text: roomy ? step.name : `**${step.name}**`,
    textStyle: roomy ? "heading" : "body",
    align: "left",
    alignV: "center",
    padding: 24,
    fill: "background2",
    stroke: step.name === focus ? "accent1" : "none",
    strokeWidth: 3,
    box: { x, y: area.y, w, h: boxH },
  })
  const points = insert({
    parent: slide,
    kind: "text",
    name: `${step.name} points`,
    text: step.points.map((point) => `- ${point}`).join("\n"),
    textStyle: roomy ? "body" : "body2",
    color: "text2",
    box: { x, y: area.y + boxH + 32, w, h: 64 },
  })
  placed.push(box, points)
  return box
})
boxes.slice(1).forEach((box, i) =>
  insert({
    parent: slide,
    kind: "line",
    name: `${steps[i].name} to ${steps[i + 1].name}`,
    from: { layer: boxes[i], side: "right" },
    to: { layer: box, side: "left" },
    arrow: "triangle",
  }),
)
const tallest = Math.max(...placed.map((each) => get({ target: each }).box).map((box) => box.y + box.h)) - area.y
const shift = Math.round(Math.max(0, (area.h - tallest) / 2))
for (const each of placed) {
  const box = get({ target: each }).box
  update({ target: each, box: { ...box, y: box.y + shift } })
}
;({ steps: boxes, problems: get({ target: slide }).problems })
```

The answer gives each step's box id in order, and the slide's problems. Fix every problem it lists.

## How the layout works

- Columns: the steps share 1680 px with 96 between for the arrows. Up to 4 steps, names take `heading` and points `body`. With 5 or 6, names take bold `body` and points `body2`.
- Arrows: each one joins a step's right side to the next step's left side, so it stays on both when you move a step.
- Height: the block sits in the middle of the body area, from y 300 to 940, measured after the points are set. Points that run long push it up, never past y 300.
