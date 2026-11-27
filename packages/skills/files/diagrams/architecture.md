# Architecture diagram

Shows how the parts of a system call each other, in layers from the people who use it at the top to where its data rests at the bottom. One path in the accent carries the point the title makes, such as the route a payment takes.

## Plan it

- 2 to 4 layers, top to bottom: clients, then the edge or services, then data. 1 to 4 boxes a layer, each named in one to three words.
- Each line joins boxes in neighbouring layers, or two boxes side by side in one layer. A line that would skip a layer means a box sits in the wrong layer.
- `path` lists, in order, the boxes the title talks about. Its boxes and lines take `accent1`; the rest stay neutral.
- Split over two slides when a layer needs a fifth box, or when the lines between two layers need more room than the gap holds. The script stops and says which.

## Draw it

Fill in the first block with your system, then send it and the second block, unchanged, as one `airdesign_execute` script. Here `slide` is a new slide; give an existing slide's id to draw on it. In the same script, copy `kit/title-block` and `kit/source-line` onto the slide.

```js
const slide = insert({ kind: "slide" })
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
```

```js
const area = { x: 120, y: 300, w: 1680, h: 640 }
const labelW = 200
const gapX = 64
const boxH = 88
const most = Math.max(...layers.map((layer) => layer.boxes.length))
if (most > 4) throw new Error("A layer holds at most 4 boxes: split the system over two slides.")
const boxW = Math.min(360, Math.floor((area.w - labelW - gapX * (most - 1)) / most))
const gapY = (area.h - boxH * layers.length) / (layers.length - 1)

const row = {}
layers.forEach((layer, r) => layer.boxes.forEach((name) => (row[name] = r)))
const slot = {}
layers.forEach((layer, r) => {
  const pull = (name) => {
    const above = edges.flatMap(([a, b]) =>
      b === name && row[a] === r - 1 ? [slot[a]] : a === name && row[b] === r - 1 ? [slot[b]] : [],
    )
    return above.length === 0 ? 0 : above.reduce((sum, at) => sum + at, 0) / above.length
  }
  if (r > 0) layer.boxes.sort((p, q) => pull(p) - pull(q))
  layer.boxes.forEach((name, i) => (slot[name] = i - (layer.boxes.length - 1) / 2))
})
for (const [a, b] of edges) {
  const apart = Math.abs(row[a] - row[b])
  if (apart > 1 || (apart === 0 && Math.abs(slot[a] - slot[b]) !== 1))
    throw new Error(`${a} to ${b} would cross other boxes: join neighbours only, or move a box to another layer.`)
}

const middle = area.x + labelW + (area.w - labelW) / 2
const xOf = (name) => Math.round(middle + slot[name] * (boxW + gapX) - boxW / 2)
const yOf = (r) => Math.round(area.y + r * (boxH + gapY))
const sides = edges.map(([a, b]) =>
  row[a] === row[b]
    ? slot[b] > slot[a]
      ? ["right", "left"]
      : ["left", "right"]
    : row[b] > row[a]
      ? ["bottom", "top"]
      : ["top", "bottom"],
)
const along = edges.map(() => [0.5, 0.5])
const onSide = {}
edges.forEach((edge, i) =>
  edge.forEach((name, end) =>
    (onSide[`${name} ${sides[i][end]}`] ??= []).push({ i, end, toward: slot[edge[1 - end]] }),
  ),
)
for (const list of Object.values(onSide)) {
  list.sort((p, q) => p.toward - q.toward)
  list.forEach(({ i, end }, k) => (along[i][end] = (k + 1) / (list.length + 1)))
}
const portX = (i, end) => Math.round(xOf(edges[i][end]) + along[i][end] * boxW)
const orders = (list) =>
  list.length <= 1
    ? [list]
    : list.flatMap((e, k) => orders([...list.slice(0, k), ...list.slice(k + 1)]).map((rest) => [e, ...rest]))
const across = (x, e) => x > Math.min(e.top, e.low) && x < Math.max(e.top, e.low)
const cost = (order) =>
  order.reduce(
    (sum, e, k) =>
      sum +
      order
        .slice(k + 1)
        .reduce((more, f) => more + (e.low === f.top ? 100 : 0) + across(f.top, e) + across(e.low, f), 0),
    0,
  )
const lane = edges.map(() => undefined)
layers.slice(1).forEach((_, gap) => {
  const spanning = edges.flatMap(([a, b], i) =>
    Math.min(row[a], row[b]) === gap && row[a] !== row[b] ? [{ i, up: row[a] < row[b] ? 0 : 1 }] : [],
  )
  for (const { i, up } of spanning) {
    const taken = spanning.filter((f) => f.i !== i).map((f) => portX(f.i, 1 - f.up))
    const toward = Math.sign(portX(i, 1 - up) - portX(i, up)) || 1
    while (taken.some((x) => Math.abs(x - portX(i, up)) < 16) && Math.abs(along[i][up] - 0.5) < 0.4)
      along[i][up] += toward * 0.05
  }
  const bent = spanning
    .map(({ i, up }) => ({ i, top: portX(i, up), low: portX(i, 1 - up) }))
    .filter((e) => e.top !== e.low)
  const room = gapY - 48
  if (bent.length > 6 || (bent.length > 0 && room / (bent.length + 1) < 12))
    throw new Error(
      `No room for ${bent.length} bending lines between ${layers[gap].name} and ${layers[gap + 1].name}: use fewer layers, or split over two slides.`,
    )
  const best = orders(bent).reduce((a, b) => (cost(b) < cost(a) ? b : a))
  best.forEach(({ i }, k) => (lane[i] = Math.round(yOf(gap) + boxH + 24 + (room * (k + 1)) / (best.length + 1))))
})

const id = {}
const lit = new Set(path)
layers.forEach((layer, r) => {
  insert({
    parent: slide,
    kind: "shape",
    shape: "rect",
    fill: "none",
    name: layer.name,
    text: layer.name,
    textStyle: "label",
    color: "text2",
    align: "left",
    alignV: "center",
    box: { x: area.x, y: yOf(r), w: labelW - 24, h: boxH },
  })
  for (const name of layer.boxes)
    id[name] = insert({
      parent: slide,
      kind: "shape",
      shape: "rect",
      name,
      text: name,
      textStyle: "body2",
      align: "center",
      alignV: "center",
      fill: "background2",
      stroke: lit.has(name) ? "accent1" : "none",
      strokeWidth: 3,
      box: { x: xOf(name), y: yOf(r), w: boxW, h: boxH },
    })
})
const onPath = (i) => path.some((name, k) => name === edges[i][0] && path[k + 1] === edges[i][1])
for (const i of edges.map((_, i) => i).sort((p, q) => onPath(p) - onPath(q)))
  insert({
    parent: slide,
    kind: "line",
    name: `${edges[i][0]} to ${edges[i][1]}`,
    route: "elbow",
    arrow: "triangle",
    from: { layer: id[edges[i][0]], side: sides[i][0], along: along[i][0] },
    to: { layer: id[edges[i][1]], side: sides[i][1], along: along[i][1] },
    ...(lane[i] === undefined ? {} : { lane: lane[i] }),
    stroke: onPath(i) ? "accent1" : "text2",
    strokeWidth: onPath(i) ? 4 : 3,
  })
;({ boxes: id, problems: get({ target: slide }).problems })
```

The answer gives each box's id by its name, and the slide's problems. Fix every problem it lists.

## How the layout works

- Rows: one per layer, spread from y 300 to 940. Each layer's name sits in a 200 px column on the left, in `label`.
- Columns: the boxes share the width right of the names, at most 360 wide with 64 between, centred. Each layer is sorted under the boxes it joins above, so lines cross less.
- Sides: a line leaves the bottom of the upper box and enters the top of the lower one. Between neighbours in one layer, it runs side to side.
- Ports: the lines on one side spread along it, sorted by where their other end sits, so no two meet at a point. A port that would sit above another line's end moves aside.
- Lanes: each line that bends between two rows gets its own `lane`, the height of its middle leg, so no two lines run on top of each other. The script tries each order of lanes and keeps the one with fewest crossings.
- Every line is attached to its boxes, so moving a box keeps its arrows on it. To lay out a changed system, remove its layers and run the script again.
