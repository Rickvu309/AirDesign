import * as doom from "@airdesign/doom"
import { grow, spot } from "./doom-fixtures"

export type Probe = "words" | "card" | "rule" | "star" | "photo" | "panel" | "slide"

type Reach =
  | { readonly agent: string; readonly writes?: doom.PropName; readonly on?: Probe }
  | { readonly personOnly: string }
  | { readonly owed: string; readonly probe?: Readonly<Record<string, unknown>> }

export type Entry = Reach & { readonly props: readonly doom.PropName[] }

const words: doom.Text = {
  chars: "Hello",
  spans: [],
  paras: [{}],
  style: "body",
  resize: "widthAndHeight",
  alignV: "top",
}
const solid = (name: doom.ColorVar) => [{ kind: "solid" as const, color: { var: name } }]
export const built = grow([
  { type: "shape", name: "words", props: { box: spot(100, 100, 300, 60), text: words } },
  {
    type: "shape",
    name: "card",
    props: {
      box: spot(100, 300, 200, 100),
      geometry: { kind: "rect" },
      fills: solid("accent1"),
      strokes: solid("text2"),
      stroke: { weight: 2, align: "inside", dash: "solid" },
      effects: "lifted",
      text: words,
    },
  },
  {
    type: "shape",
    name: "rule",
    props: {
      box: spot(600, 40, 100, 0),
      geometry: {
        kind: "line",
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        route: "straight",
        arrows: ["none", "none"],
      },
      strokes: solid("text2"),
      stroke: { weight: 4, align: "center", dash: "solid" },
    },
  },
  {
    type: "shape",
    name: "star",
    props: {
      box: spot(800, 200, 120, 120),
      geometry: { kind: "icon", name: "lucide/star" },
      strokes: solid("text2"),
      stroke: { weight: 10, align: "center", dash: "solid" },
    },
  },
  {
    type: "shape",
    name: "photo",
    props: {
      box: spot(500, 300, 200, 100),
      geometry: { kind: "rect" },
      fills: [{ kind: "image", asset: "a".repeat(64), fit: "fit" }],
    },
  },
  { type: "frame", name: "panel", props: { box: spot(300, 500, 400, 200), fills: solid("background2") }, children: [] },
])
export const slide = built.slides[0]!
export const idOf = (probe: Probe): doom.NodeId => (probe === "slide" ? slide : built.ids[probe]!)
export const layers = ["words", "card", "rule", "star", "photo", "panel"] as const

export const sample: Readonly<Record<string, unknown>> = {
  fill: "accent2",
  stroke: "accent2",
  strokeWidth: 3,
  color: "accent2",
  radius: 6,
  effect: "soft",
  opacity: 0.5,
  text: "Changed",
  textStyle: "heading",
  align: "center",
  layout: "row",
  gap: 10,
  padding: 10,
  icon: "rocket",
  arrow: true,
  chart: { kind: "bar", categories: ["A"], series: [{ name: "S", values: [1] }] },
  box: { x: 10, y: 10, w: 50, h: 50 },
  name: "Renamed",
  hidden: true,
  size: 72,
  font: "Montserrat",
  lineHeight: 1.4,
  letterSpacing: 2,
  case: "upper",
  underline: true,
  strike: true,
  dash: "dot",
  fit: "tile",
  rotation: 15,
  flip: "h",
  notes: "Say why",
}

const set = (look: Readonly<Record<string, unknown>>) => ({ op: "set", target: "s:1", ...look })

export const reach: Readonly<Record<string, Entry>> = {
  "panel:box.align": { agent: "set.box", props: ["box"] },
  "panel:box.distribute": { agent: "set.box", props: ["box"] },
  "panel:text.style": { agent: "set.textStyle", writes: "text", on: "words", props: ["text"] },
  "panel:text.font": { agent: "set.font", writes: "text", on: "words", props: ["text"] },
  "panel:text.weight": { agent: "set.text", writes: "text", on: "words", props: ["text"] },
  "panel:text.size": { agent: "set.size", writes: "text", on: "words", props: ["text"] },
  "panel:text.lineHeight": { agent: "set.lineHeight", writes: "text", on: "words", props: ["text"] },
  "panel:text.letterSpacing": { agent: "set.letterSpacing", writes: "text", on: "words", props: ["text"] },
  "panel:text.bold": { agent: "set.text", writes: "text", on: "words", props: ["text"] },
  "panel:text.italic": { agent: "set.text", writes: "text", on: "words", props: ["text"] },
  "panel:text.underline": { agent: "set.underline", writes: "text", on: "words", props: ["text"] },
  "panel:text.strike": { agent: "set.strike", writes: "text", on: "words", props: ["text"] },
  "panel:text.align": { agent: "set.align", writes: "text", on: "words", props: ["text"] },
  "panel:text.align#justify": { agent: "set.align", writes: "text", on: "words", props: ["text"] },
  "panel:text.list": { agent: "set.text", writes: "text", on: "words", props: ["text"] },
  "panel:text.case": { agent: "set.case", writes: "text", on: "words", props: ["text"] },
  "panel:text.fill": { agent: "set.color", writes: "text", on: "card", props: ["text"] },
  "panel:textFill.value": { agent: "set.color", writes: "text", on: "words", props: ["text"] },
  "panel:textFill.value#tint": { agent: "set.color", writes: "text", on: "words", props: ["text"] },
  "panel:fills.paint": { agent: "set.fill", writes: "fills", on: "card", props: ["fills"] },
  "panel:fills.paint#gradient": { agent: "set.fill", writes: "fills", on: "card", props: ["fills"] },
  "panel:opacity.opacity": { agent: "set.opacity", writes: "opacity", on: "card", props: ["opacity"] },
  "panel:corners.corners": { agent: "set.radius", writes: "radius", on: "card", props: ["radius"] },
  "panel:border.border": { agent: "set.dash", writes: "stroke", on: "card", props: ["strokes", "stroke"] },
  "panel:border.color": { agent: "set.stroke", writes: "strokes", on: "rule", props: ["strokes"] },
  "panel:border.width": { agent: "set.strokeWidth", writes: "stroke", on: "rule", props: ["stroke"] },
  "panel:image.color": { agent: "set.stroke", writes: "strokes", on: "star", props: ["strokes"] },
  "panel:image.weight": { agent: "set.strokeWidth", writes: "stroke", on: "star", props: ["stroke"] },
  "panel:image.mode": { agent: "set.fit", writes: "fills", on: "photo", props: ["fills"] },
  "panel:image.source": { agent: "set.fill", writes: "fills", on: "photo", props: ["fills"] },
  "panel:shadow.shadow": { agent: "set.effect", writes: "effects", on: "card", props: ["effects"] },
  "panel:shadow.opacity": {
    owed: "a shadow's opacity, once the panel offers the theme's effect styles",
    props: ["effects"],
  },
  "panel:link.target": {
    owed: "a link on the whole layer",
    probe: set({ link: "https://example.com" }),
    props: ["link"],
  },
  "panel:geometry.shape": { owed: "the outline of a shape", probe: set({ shape: "ellipse" }), props: ["geometry"] },

  "gesture:edit-text": { agent: "set.text", writes: "text", on: "words", props: ["text"] },
  "gesture:delete": { agent: "op.delete", props: ["parent"] },
  "gesture:move": { agent: "set.box", writes: "box", on: "card", props: ["box", "parent"] },
  "gesture:nudge": { agent: "set.box", props: ["box"] },
  "gesture:snap-off": { agent: "set.box", props: ["box"] },
  "gesture:nudge-far": { agent: "set.box", props: ["box"] },
  "gesture:resize": { agent: "set.box", props: ["box", "sizing", "text", "geometry"] },
  "gesture:rotate": { agent: "set.rotation", writes: "box", on: "card", props: ["box"] },
  "gesture:flip-horizontal": { agent: "set.flip", writes: "box", on: "card", props: ["box"] },
  "gesture:flip-vertical": { agent: "set.flip", writes: "box", on: "card", props: ["box"] },
  "gesture:forward": { agent: "op.move", props: ["parent"] },
  "gesture:backward": { agent: "op.move", props: ["parent"] },
  "gesture:front": { agent: "op.move", props: ["parent"] },
  "gesture:back": { agent: "op.move", props: ["parent"] },
  "gesture:duplicate": { agent: "op.duplicate", props: ["parent"] },
  "gesture:duplicate-drag": { agent: "op.duplicate", props: ["parent", "box"] },
  "gesture:cut": { agent: "op.delete", props: ["parent"] },
  "gesture:paste": { agent: "op.add", props: ["parent", "type"] },
  "gesture:group": { agent: "op.wrap", props: ["parent", "type", "box"] },
  "gesture:frame": { owed: "a frame that clips its children", probe: set({ clip: true }), props: ["clip"] },
  "gesture:ungroup": { agent: "op.unwrap", props: ["parent"] },
  "gesture:hide": { agent: "set.hidden", writes: "hidden", on: "card", props: ["hidden"] },
  "gesture:lock": { owed: "a locked layer", probe: set({ locked: true }), props: ["locked"] },
  "gesture:undo": {
    personOnly: "the person's history; an agent writes the value back, and its run undoes as one",
    props: [],
  },
  "gesture:redo": { personOnly: "the person's history", props: [] },
  "gesture:tool-text": { agent: "add.text", props: ["type", "text"] },
  "gesture:tool-frame": { agent: "add.frame", props: ["type", "clip"] },
  "gesture:tool-rectangle": { agent: "add.shape", props: ["type", "geometry"] },
  "gesture:tool-ellipse": { owed: "an ellipse", probe: set({ shape: "ellipse" }), props: ["geometry"] },
  "gesture:tool-line": { agent: "add.line", props: ["geometry"] },
  "gesture:tool-arrow": { agent: "set.arrow", writes: "geometry", on: "rule", props: ["geometry"] },
  "gesture:bold": { agent: "set.text", props: ["text"] },
  "gesture:italic": { agent: "set.text", props: ["text"] },
  "gesture:underline": { owed: "underline on a range of words: markdown has no underline", props: ["text"] },
  "gesture:strike": { owed: "strike on a range of words: markdown has no strike", props: ["text"] },
  "gesture:text-left": { agent: "set.align", props: ["text"] },
  "gesture:text-center": { agent: "set.align", props: ["text"] },
  "gesture:text-right": { agent: "set.align", props: ["text"] },
  "gesture:text-justify": { agent: "set.align", props: ["text"] },
  "gesture:bullets": { agent: "set.text", props: ["text"] },
  "gesture:numbers": { agent: "set.text", props: ["text"] },
  "gesture:list-indent": { agent: "set.text", props: ["text"] },
  "gesture:list-outdent": { agent: "set.text", props: ["text"] },
  "gesture:slide-add": { agent: "slide.add", props: ["type", "parent"] },
  "gesture:slide-delete": { agent: "slide.delete", props: ["parent"] },
  "gesture:slide-up": { agent: "slide.move", props: ["parent"] },
  "gesture:slide-down": { agent: "slide.move", props: ["parent"] },
  "gesture:slide-duplicate": { agent: "op.duplicate", props: ["parent"] },

  "strip:deck-name": { agent: "op.deck", props: ["name"] },
  "notes:slide-notes": { agent: "set.notes", writes: "notes", on: "slide", props: ["notes"] },
  "panel:slide-background": { agent: "set.fill", writes: "fills", on: "slide", props: ["fills"] },
  "panel:theme-colors": { agent: "op.deck", props: ["theme"] },
  "panel:theme-fonts": { agent: "op.deck", props: ["theme"] },
  "panel:chart-data": { agent: "set.chart", props: ["chart"] },
  "panel:remove-auto-layout": { agent: "set.layout", props: ["layout"] },
  "actions:icon": { agent: "add.icon", props: ["geometry"] },
  "actions:chart": { agent: "add.chart", props: ["chart"] },
  "drop:picture": { agent: "add.picture", props: ["fills"] },
}

export const writesOf = (probe: Probe, look: Readonly<Record<string, unknown>>): readonly doom.Write[] => {
  let next = 0
  const mint = () => doom.nodeId(`m:${String((next += 1))}`)
  const change = { op: "set", target: idOf(probe), ...look } as doom.AgentChange
  const writes = doom.compileAgentChange(built.view, change, mint)
  return doom.isRefusal(writes) ? [] : writes.filter((write) => write.node === idOf(probe))
}

const schema = doom.agentChangesSchema.$defs.change.properties as Readonly<
  Record<string, { readonly enum?: readonly string[] }>
>
export const agentFields = new Set(Object.keys(schema))
export const agentOps = new Set(schema.op?.enum)
export const agentKinds = new Set(schema.kind?.enum)
