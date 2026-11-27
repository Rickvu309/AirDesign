---
name: process-flow
description: "Before you draw a process, read the script that lays out 3 to 6 steps left to right with attached arrows."
---

# Process flow

Steps in order, left to right, an arrow from each step to the next. Under each step, one line says who does it and how. The step the title is about is filled with the accent.

## When

- A sequence a reader follows once, start to end: how an order ships, how a refund gets approved.
- 3 to 6 steps. With more, merge steps, or split the flow over two slides, one per phase.
- A step that loops back or splits in two is a system: draw it with `diagrams/architecture`.

## The rules

- Name each step with a verb and its object, in one to four words: "Pick and pack", not "Fulfilment".
- `how` is the mechanism: who does the step and how, with a number when you have one. "Warehouse team, within two hours", not "Efficient handling". A step with no mechanism is a theme, not a step.
- One step in the accent: the one the title names. The others stay neutral.
- Arrows only join a step to the next one, attached at both ends, so they follow when a step moves.

## The script

Change the values at the top: the slide, the flow's box on the slide, the steps and the step to accent. The rest measures the words and places every layer.

```js
const slide = "<slide id>"
const box = { x: 120, y: 280, w: 1680, h: 680 }
const steps = [
  { name: "Take the order", how: "Stores, web and app feed one queue" },
  { name: "Pick and pack", how: "Warehouse team, within two hours" },
  { name: "Hand to carrier", how: "Two carriers, one pickup a day" },
  { name: "Deliver", how: "Next day for 94% of parcels" },
]
const focus = "Pick and pack"

if (steps.length < 3 || steps.length > 6)
  throw new Error(
    `A flow takes 3 to 6 steps and this one has ${steps.length}: merge steps, or split the flow over two slides, one per phase.`,
  )
if (!steps.some((step) => step.name === focus))
  throw new Error(`focus names no step: set it to one of ${steps.map((step) => step.name).join(", ")}.`)
const roomy = steps.length <= 4
const gap = roomy ? 112 : 72
const w = Math.floor((box.w - gap * (steps.length - 1)) / steps.length)
const pad = roomy ? 28 : 20
const nameOf = (step) => `**${step.name}**`

const flow = insert({ parent: slide, kind: "frame", layout: "none", name: "Process flow", box })
const probe = insert({ parent: flow, kind: "text", text: "-", box: { x: 0, y: 0, w, h: 40 } })
const tall = (text, textStyle, width) => {
  update({ target: probe, text, textStyle, box: { w: width } })
  return get({ target: probe }).box.h
}
const howStyle = roomy ? "body" : "body2"
const nameH = steps.map((step) => tall(nameOf(step), "body", w - 2 * pad))
const boxH = Math.ceil(Math.max(roomy ? 136 : 104, ...nameH.map((h) => h + 2 * pad)))
const howH = Math.ceil(Math.max(...steps.map((step) => tall(step.how, howStyle, w))))
remove({ target: probe })
const below = 24
const blockH = boxH + below + howH
if (blockH > box.h)
  throw new Error(`The flow needs ${blockH} px of height and its box holds ${box.h}: shorten the longest step.`)
const top = Math.round((box.h - blockH) / 2)

const ids = steps.map((step, i) => {
  const x = i * (w + gap)
  const lit = step.name === focus
  const extra = boxH - 2 * pad - nameH[i]
  const id = insert({
    parent: flow,
    kind: "text",
    name: step.name,
    text: nameOf(step),
    textStyle: "body",
    padding: { t: pad + extra / 2, r: pad, b: pad + extra / 2, l: pad },
    fill: lit ? "accent1" : "background2",
    color: lit ? "background" : "text",
    box: { x, y: top, w, h: boxH },
  })
  const how = insert({
    parent: flow,
    kind: "text",
    name: `${step.name} how`,
    text: step.how,
    textStyle: howStyle,
    color: "text2",
    box: { x, y: top + boxH + below, w, h: howH },
  })
  group({ targets: [id, how], layout: "column", gap: below })
  return id
})
ids.slice(1).forEach((id, i) =>
  insert({
    parent: flow,
    kind: "line",
    name: `${steps[i].name} to ${steps[i + 1].name}`,
    from: { layer: ids[i], side: "right" },
    to: { layer: id, side: "left" },
    arrow: "triangle",
  }),
)
get({ target: flow }).problems
```

## After the script

- `problems` is empty, or a step needs fewer words.
- Read the title again: the filled step is the one it names.
- Copy `kit/title-block` above the flow and, when a step carries a number, `kit/source-line` below it.
- Each step is its own layer, named after the step. Move one and its arrows follow. To change the steps, remove the `Process flow` frame and run the script again.
