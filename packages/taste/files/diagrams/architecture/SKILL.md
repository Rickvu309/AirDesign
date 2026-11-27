---
name: architecture
description: "Before you draw a system, read the script that lays out its parts in layers with attached arrows, one path in the accent and numbered callouts."
---

# Architecture diagram

Which part of a system calls which, in layers from its users to its data, for builders who need the shape first. One accent path carries the title's point, such as the route a payment takes.

## When

- 2 to 4 layers of 1 to 4 boxes. With more, split over two slides: the whole at low detail, then the part the title is about.
- Steps in order with no branches are a `diagrams/process-flow`.

## The rules

- Layers run `down`, or `right` when boxes are few and names long: clients, then the edge or services, then data.
- Name each box with what it is, in one to three words: "Payments", "Orders DB". No icons or logos.
- An edge joins neighbouring layers, or neighbours in one layer. One that skips a layer means a box is in the wrong layer.
- `path` lists, in order, the boxes the title names. They and the edges between them take the accent. One path a slide.
- `callouts` tie up to three boxes to numbered takeaways beside the diagram. Each states a finding about its part, not its name. Leave it empty when the title says it all.

## The script

Change the values at the top. The rest places every layer, or stops with a sentence to act on.

```js
const slide = "<slide id>"
const box = { x: 120, y: 280, w: 1680, h: 680 }
const direction = "down"
const layers = [
  { name: "Clients", boxes: ["Web app", "Mobile app"] },
  { name: "Edge", boxes: ["API gateway"] },
  { name: "Services", boxes: ["Orders", "Payments", "Accounts"] },
  { name: "Data", boxes: ["Orders DB", "Ledger", "Users DB"] },
]
const edges = [
  ["Web app", "API gateway"],
  ["Mobile app", "API gateway"],
  ["API gateway", "Orders"],
  ["API gateway", "Payments"],
  ["API gateway", "Accounts"],
  ["Orders", "Orders DB"],
  ["Payments", "Ledger"],
  ["Accounts", "Users DB"],
]
const path = ["Mobile app", "API gateway", "Payments", "Ledger"]
const callouts = [
  ["API gateway", "The gateway checks every token, so no service checks again"],
  ["Ledger", "Each payment is written to the ledger once and never edited"],
]

if (direction !== "down" && direction !== "right") throw new Error('Set direction to "down" or "right".')
if (layers.length < 2 || layers.length > 4)
  throw new Error(`A system takes 2 to 4 layers, not ${layers.length}: merge layers, or split it over two slides.`)
const most = Math.max(...layers.map((l) => l.boxes.length))
if (most > 4) throw new Error("A layer holds at most 4 boxes: split the system over two slides.")
if (callouts.length > 3) throw new Error("Tie at most 3 callouts to the text: keep the ones the title needs.")
const row = {}
layers.forEach(({ boxes }, r) => boxes.forEach((name) => (row[name] = r)))
for (const name of [...edges.flat(), ...path, ...callouts.map(([name]) => name)])
  if (row[name] === undefined) throw new Error(`${name} is in no layer: add it to one, or fix its spelling.`)
path.slice(1).forEach((name, k) => {
  if (!edges.some(([a, b]) => a === path[k] && b === name))
    throw new Error(`The path goes from ${path[k]} to ${name}, which no edge joins: add the edge, or fix the path.`)
})

const down = direction === "down"
const pad = 14
const mark = 44
const markRoom = mark + 16
const diagram = insert({ parent: slide, kind: "frame", layout: "none", name: "Architecture", box })
const probe = insert({ parent: diagram, kind: "text", text: "-", box: { x: 0, y: 0, w: 100, h: 40 } })
const tall = (text, w) => {
  update({ target: probe, text, textStyle: "body2", box: { w } })
  return Math.ceil(get({ target: probe }).box.h)
}
const takeW = 440
const takeH = callouts.map(([, text]) => tall(text, takeW - markRoom))
if (takeH.reduce((sum, h) => sum + h + 40, -40) > box.h)
  throw new Error("The takeaways are taller than the diagram: shorten them.")
const areaW = callouts.length > 0 ? box.w - takeW - 64 : box.w
const label = down ? 160 : 72
const lenMain = down ? box.h : areaW
const lenCross = (down ? areaW : box.h) - label
const fit = down ? (lenCross - 64 * (most - 1)) / most : (lenMain - 160 * (layers.length - 1)) / layers.length
const wide = Math.min(360, Math.floor(fit))
const deep = Math.max(72, 2 * pad + Math.max(...layers.flatMap((l) => l.boxes.map((n) => tall(n, wide - 2 * pad)))))
remove({ target: probe })
const [boxMain, boxCross] = down ? [deep, wide] : [wide, deep]
if (boxCross * most + 24 * (most - 1) > lenCross)
  throw new Error("The boxes are too tall to stack in one layer: shorten the longest name, or use direction down.")
const gapMain = (lenMain - boxMain * layers.length) / (layers.length - 1)
const spread = Math.min(64, (lenCross - boxCross * most) / Math.max(1, most - 1))

const slot = {}
layers.forEach(({ boxes }, r) => {
  const mid = (boxes.length - 1) / 2
  const pull = (name) => {
    const before = edges.flatMap(([a, b]) => (b === name ? [a] : a === name ? [b] : [])).filter((o) => row[o] === r - 1)
    return before.length ? before.reduce((sum, o) => sum + slot[o], 0) / before.length : boxes.indexOf(name) - mid
  }
  boxes.toSorted((p, q) => pull(p) - pull(q)).forEach((name, i) => (slot[name] = i - mid))
})
for (const [a, b] of edges) {
  const apart = Math.abs(row[a] - row[b])
  if (apart > 1 || (apart === 0 && Math.abs(slot[a] - slot[b]) !== 1))
    throw new Error(`${a} to ${b} would cross other boxes: join neighbours only, or move a box to another layer.`)
}

const crossOf = (name) => Math.round(label + lenCross / 2 + slot[name] * (boxCross + spread) - boxCross / 2)
const mainOf = (r) => Math.round(r * (boxMain + gapMain))
const rect = (main, cross, sizeMain, sizeCross) =>
  down ? { x: cross, y: main, w: sizeCross, h: sizeMain } : { x: main, y: cross, w: sizeMain, h: sizeCross }
const place = (name) => rect(mainOf(row[name]), crossOf(name), boxMain, boxCross)
const ahead = down ? ["bottom", "top"] : ["right", "left"]
const beside = down ? ["right", "left"] : ["bottom", "top"]
const sides = edges.map(([a, b]) => {
  const pair = row[a] === row[b] ? beside : ahead
  return (row[b] - row[a] || slot[b] - slot[a]) > 0 ? pair : pair.toReversed()
})
const at = edges.map(() => [])
const onSide = {}
edges.forEach((edge, i) =>
  edge.forEach((name, end) =>
    (onSide[`${name} ${sides[i][end]}`] ??= []).push({ i, end, toward: slot[edge[1 - end]] }),
  ),
)
for (const list of Object.values(onSide)) {
  list.sort((p, q) => p.toward - q.toward)
  list.forEach(({ i, end }, k) => (at[i][end] = (k + 1) / (list.length + 1)))
}
const port = (i, end) => Math.round(crossOf(edges[i][end]) + at[i][end] * boxCross)
const orders = (list) =>
  list.length <= 1
    ? [list]
    : list.flatMap((e, k) => orders([...list.slice(0, k), ...list.slice(k + 1)]).map((rest) => [e, ...rest]))
const between = (c, e) => c > Math.min(e.top, e.low) && c < Math.max(e.top, e.low)
const crossing = (e, f) => (e.low === f.top ? 100 : 0) + between(f.top, e) + between(e.low, f)
const cost = (order) => order.reduce((sum, e, k) => sum + order.slice(k + 1).reduce((n, f) => n + crossing(e, f), 0), 0)
const lane = []
layers.slice(1).forEach((_, gap) => {
  const spanning = edges.flatMap(([a, b], i) =>
    Math.min(row[a], row[b]) === gap && row[a] !== row[b] ? [{ i, up: row[a] < row[b] ? 0 : 1 }] : [],
  )
  for (const { i, up } of spanning) {
    const taken = spanning.filter((f) => f.i !== i).map((f) => port(f.i, 1 - f.up))
    const toward = Math.sign(port(i, 1 - up) - port(i, up)) || 1
    while (taken.some((c) => Math.abs(c - port(i, up)) < 16) && Math.abs(at[i][up] - 0.5) < 0.4)
      at[i][up] += toward * 0.05
  }
  const bent = spanning
    .map(({ i, up }) => ({ i, top: port(i, up), low: port(i, 1 - up) }))
    .filter((e) => e.top !== e.low)
  const room = gapMain - 48
  if (bent.length > 6 || (bent.length > 0 && room / (bent.length + 1) < 12))
    throw new Error(
      `No room for ${bent.length} bending lines between ${layers[gap].name} and ${layers[gap + 1].name}: shorten the names, use fewer layers, or split over two slides.`,
    )
  const best = orders(bent).reduce((a, b) => (cost(b) < cost(a) ? b : a))
  best.forEach(({ i }, k) => (lane[i] = Math.round(mainOf(gap) + boxMain + 24 + (room * (k + 1)) / (best.length + 1))))
})

const shape = (name, more) => insert({ parent: diagram, kind: "shape", name, text: name, ...more })
const id = {}
layers.forEach((layer, r) => {
  shape(layer.name, {
    textStyle: "label",
    color: "text2",
    fill: "none",
    padding: 0,
    align: "left",
    alignV: down ? "center" : "top",
    box: rect(mainOf(r), 0, boxMain, label - (down ? 24 : 16)),
  })
  for (const name of layer.boxes)
    id[name] = shape(name, {
      textStyle: "body2",
      padding: pad,
      fill: "background2",
      stroke: path.includes(name) ? "accent1" : "none",
      strokeWidth: 3,
      box: place(name),
    })
})
const onPath = (i) => path.some((name, k) => name === edges[i][0] && path[k + 1] === edges[i][1])
for (const i of edges.map((_, i) => i).sort((p, q) => onPath(p) - onPath(q))) {
  const [a, b] = edges[i]
  insert({
    parent: diagram,
    kind: "line",
    name: `${a} to ${b}`,
    route: "elbow",
    arrow: "triangle",
    from: { layer: id[a], side: sides[i][0], along: at[i][0] },
    to: { layer: id[b], side: sides[i][1], along: at[i][1] },
    lane: lane[i],
    stroke: onPath(i) ? "accent1" : "text2",
    strokeWidth: onPath(i) ? 4 : 3,
  })
}
const marker = (k, x, y) =>
  shape(`Callout ${k + 1}`, {
    text: `${k + 1}`,
    textStyle: "label",
    padding: 0,
    radius: mark / 2,
    fill: "text",
    color: "background",
    box: { x, y, w: mark, h: mark },
  })
const x = box.w - takeW
let y = 0
callouts.forEach(([name, text], k) => {
  const owner = place(name)
  marker(k, owner.x - mark / 2 - 12, owner.y - mark / 2 - 12)
  marker(k, x, y)
  const spot = { x: x + markRoom, y, w: takeW - markRoom, h: takeH[k] }
  insert({ parent: diagram, kind: "text", name: `Takeaway ${k + 1}`, text, textStyle: "body2", box: spot })
  y += takeH[k] + 40
})
get({ target: diagram }).problems
```

## After the script

- `problems` is empty, or a name or a takeaway needs fewer words.
- Read the title again: the accent path is the route it names, and each takeaway adds what the title does not.
- Copy `kit/title-block` above the diagram.
- Each box is a layer named after its part, and its arrows follow when it moves. To change the system, remove the `Architecture` frame and rerun the script.
