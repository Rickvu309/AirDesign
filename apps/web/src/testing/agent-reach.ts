import * as doom from "@airdesign/doom"
import { compileIntent, starts, testTheme } from "@airdesign/doom/testing"
import { placement } from "@airdesign/doom/testing"

const spot = (x: number, y: number, w: number, h: number, rotation = 0) => ({
  x,
  y,
  w,
  h,
  rotation,
  flipH: false,
  flipV: false,
})

function deckOf(children: readonly doom.TreeNode[]) {
  const grown = doom.doomFromTree({ theme: testTheme, slides: [{ children }] })
  return { ...grown, view: grown.doom }
}

export type Probe = "words" | "card" | "rule" | "star" | "photo" | "panel" | "slide"

type Reach =
  | {
      readonly agent: string
      readonly writes?: doom.PropName
      readonly on?: Probe
      readonly probe?: Readonly<Record<string, unknown>>
    }
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
export const built = deckOf([
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
      text: { ...words, resize: "fixed" },
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
  effectOpacity: 0.4,
  opacity: 0.5,
  text: "Changed",
  insert: { at: 2, text: "linked", link: "https://example.com" },
  textStyle: "heading",
  language: "ja",
  align: "center",
  layout: "row",
  gap: 10,
  padding: 10,
  icon: "rocket",
  arrow: true,
  startArrow: "circle",
  from: { layer: built.ids.card },
  to: { x: 900, y: 40 },
  route: "elbow",
  lane: 200,
  box: { x: 10, y: 10, w: 50, h: 50 },
  name: "Renamed",
  hidden: true,
  locked: true,
  size: 72,
  font: "Montserrat",
  weight: "SemiBold",
  lineHeight: 1.4,
  letterSpacing: 2,
  case: "upper",
  underline: true,
  strike: true,
  link: "https://example.com",
  clip: true,
  mask: true,
  dash: "dot",
  fit: "crop",
  crop: { left: 10, top: 5 },
  shape: "ellipse",
  fillStroke: true,
  d: "M0 0L1 1",
  rotation: 15,
  flip: "h",
  notes: "Say why",
  skipped: true,
  transition: { kind: "fade", ms: 400 },
  alignV: "bottom",
  spaceBefore: 12,
  spaceAfter: 8,
  blur: 8,
  innerShadow: { color: "accent1", x: 0, y: 2, blur: 4, spread: 0 },
}

export const reach: Readonly<Record<string, Entry>> = {
  "panel:box.align": { agent: "update.box", props: ["box"] },
  "panel:box.distribute": { agent: "update.box", props: ["box"] },
  "panel:text.style": { agent: "update.textStyle", writes: "text", on: "words", props: ["text"] },
  "panel:text.weight": { agent: "update.weight", writes: "text", on: "words", props: ["text"] },
  "panel:text.size": { agent: "update.size", writes: "text", on: "words", props: ["text"] },
  "panel:text.bold": { agent: "update.text", writes: "text", on: "words", props: ["text"] },
  "panel:text.italic": { agent: "update.text", writes: "text", on: "words", props: ["text"] },
  "panel:text.underline": { agent: "update.underline", writes: "text", on: "words", props: ["text"] },
  "panel:text.strike": { agent: "update.strike", writes: "text", on: "words", props: ["text"] },
  "panel:text.align": { agent: "update.align", writes: "text", on: "words", props: ["text"] },
  "panel:text.align#justify": { agent: "update.align", writes: "text", on: "words", props: ["text"] },
  "panel:text.list": { agent: "update.text", writes: "text", on: "words", props: ["text"] },
  "panel:text.fill": { agent: "update.color", writes: "text", on: "card", props: ["text"] },
  "panel:textFill.value": { agent: "update.color", writes: "text", on: "words", props: ["text"] },
  "panel:textFill.value#tint": { agent: "update.color", writes: "text", on: "words", props: ["text"] },
  "panel:fills.paint": { agent: "update.fill", writes: "fills", on: "card", props: ["fills"] },
  "panel:fills.paint#gradient": { agent: "update.fill", writes: "fills", on: "card", props: ["fills"] },
  "panel:border.border": { agent: "update.dash", writes: "stroke", on: "card", props: ["strokes", "stroke"] },
  "panel:border.color": { agent: "update.stroke", writes: "strokes", on: "rule", props: ["strokes"] },
  "panel:image.color": { agent: "update.stroke", writes: "strokes", on: "star", props: ["strokes"] },
  "panel:image.mode": { agent: "update.fit", writes: "fills", on: "photo", props: ["fills"] },
  "panel:link.target": { agent: "update.link", writes: "link", on: "words", props: ["link"] },
  "panel:link.target#words": { agent: "update.text", writes: "text", on: "words", props: ["text"] },
  "panel:geometry.preset": { agent: "update.shape", writes: "geometry", on: "card", props: ["geometry"] },

  "gesture:edit-text": { agent: "update.text", writes: "text", on: "words", props: ["text"] },
  "gesture:delete": { agent: "op.remove", props: ["parent"] },
  "gesture:move": { agent: "update.box", writes: "box", on: "card", props: ["box", "parent"] },
  "gesture:nudge": { agent: "update.box", props: ["box"] },
  "gesture:snap-off": { agent: "update.box", props: ["box"] },
  "gesture:nudge-far": { agent: "update.box", props: ["box"] },
  "gesture:resize": { agent: "update.box", props: ["box", "sizing", "text", "geometry"] },
  "gesture:rotate": { agent: "update.rotation", writes: "box", on: "card", props: ["box"] },
  "gesture:flip-horizontal": { agent: "update.flip", writes: "box", on: "card", props: ["box"] },
  "gesture:flip-vertical": { agent: "update.flip", writes: "box", on: "card", props: ["box"] },
  "gesture:forward": { agent: "op.reorder", props: ["parent"] },
  "gesture:backward": { agent: "op.reorder", props: ["parent"] },
  "gesture:front": { agent: "op.reorder", props: ["parent"] },
  "gesture:back": { agent: "op.reorder", props: ["parent"] },
  "gesture:duplicate": { agent: "op.copy", props: ["parent"] },
  "gesture:duplicate-drag": { agent: "op.copy", props: ["parent", "box"] },
  "gesture:move-to-slide": { agent: "op.move", props: ["parent", "box", "geometry"] },
  "gesture:cut": { agent: "op.remove", props: ["parent"] },
  "gesture:paste": { agent: "op.copy", props: ["parent", "type"] },
  "gesture:group": { agent: "op.group", props: ["parent", "type", "box"] },
  "gesture:frame": { agent: "update.clip", writes: "clip", on: "panel", props: ["clip"] },
  "menu:use-as-mask": { agent: "update.mask", writes: "mask", on: "card", props: ["mask"] },
  "gesture:ungroup": { agent: "op.ungroup", props: ["parent"] },
  "gesture:hide": { agent: "update.hidden", writes: "hidden", on: "card", props: ["hidden"] },
  "gesture:lock": { agent: "update.locked", writes: "locked", on: "card", props: ["locked"] },
  "gesture:undo": {
    personOnly: "the person's history; an agent writes the value back, and its run undoes as one",
    props: [],
  },
  "gesture:redo": { personOnly: "the person's history", props: [] },
  "gesture:tool-text": { agent: "insert.text", props: ["type", "text"] },
  "gesture:tool-frame": { agent: "insert.frame", props: ["type", "clip"] },
  "gesture:tool-rectangle": { agent: "insert.shape", props: ["type", "geometry"] },
  "gesture:tool-ellipse": { agent: "update.shape", writes: "geometry", on: "card", props: ["geometry"] },
  "gesture:tool-line": { agent: "insert.line", props: ["geometry"] },
  "gesture:tool-arrow": { agent: "update.arrow", writes: "geometry", on: "rule", props: ["geometry"] },
  "gesture:crop-drag": { agent: "update.crop", writes: "fills", on: "photo", props: ["fills", "box"] },
  "gesture:line-end": { agent: "update.to", writes: "geometry", on: "rule", props: ["geometry"] },
  "panel:border.route": { agent: "update.route", writes: "geometry", on: "rule", props: ["geometry"] },
  "panel:border.end": { agent: "update.arrow", writes: "geometry", on: "rule", props: ["geometry"] },
  "panel:border.start": { agent: "update.startArrow", writes: "geometry", on: "rule", props: ["geometry"] },
  "gesture:bold": { agent: "update.text", props: ["text"] },
  "gesture:italic": { agent: "update.text", props: ["text"] },
  "gesture:underline": { agent: "update.text", writes: "text", on: "words", props: ["text"] },
  "gesture:strike": { agent: "update.text", writes: "text", on: "words", props: ["text"] },
  "gesture:text-left": { agent: "update.align", props: ["text"] },
  "gesture:text-center": { agent: "update.align", props: ["text"] },
  "gesture:text-right": { agent: "update.align", props: ["text"] },
  "gesture:text-justify": { agent: "update.align", props: ["text"] },
  "gesture:bullets": { agent: "update.text", props: ["text"] },
  "gesture:numbers": { agent: "update.text", props: ["text"] },
  "gesture:list-indent": { agent: "update.text", props: ["text"] },
  "gesture:list-outdent": { agent: "update.text", props: ["text"] },
  "gesture:slide-add": { agent: "insert.slide", props: ["type", "parent"] },
  "gesture:slide-delete": { agent: "op.remove", props: ["parent"] },
  "gesture:slide-up": { agent: "op.move", props: ["parent"] },
  "gesture:slide-down": { agent: "op.move", props: ["parent"] },
  "gesture:slide-duplicate": { agent: "op.copy", props: ["parent"] },
  "gesture:slide-earlier": { agent: "op.move", props: ["parent"] },
  "gesture:slide-later": { agent: "op.move", props: ["parent"] },
  "gesture:slide-group-up": {
    agent: "op.move",
    probe: { op: "move", targets: ["a:2"], before: "a:1" },
    props: ["parent"],
  },
  "gesture:slide-group-down": {
    agent: "op.move",
    probe: { op: "move", targets: ["a:1"], after: "a:2" },
    props: ["parent"],
  },
  "drag:slide-group-start": {
    agent: "op.move",
    probe: { op: "move", targets: ["a:3"], group: "a:2", after: null },
    props: ["parent"],
  },
  "menu:new-slide-group": {
    agent: "insert.slide",
    probe: { op: "insert", kind: "slide", group: "new", after: "a:1" },
    props: ["type", "parent"],
  },

  "strip:deck-name": { agent: "op.variables", props: ["name"] },
  "notes:slide-notes": { agent: "update.notes", writes: "notes", on: "slide", props: ["notes"] },
  "panel:theme": { agent: "variables.theme", props: ["theme"] },
  "panel:slide-background": { agent: "update.fill", writes: "fills", on: "slide", props: ["fills"] },
  "menu:skip-slide": { agent: "update.skipped", writes: "skipped", on: "slide", props: ["skipped"] },
  "panel:text.alignV": { agent: "update.alignV", writes: "text", on: "card", props: ["text"] },
  "panel:remove-auto-layout": { agent: "update.layout", props: ["layout"] },
  "panel:show-hidden": { agent: "update.hidden", writes: "hidden", on: "card", props: ["hidden"] },
  "panel:name": { agent: "update.name", writes: "name", on: "card", props: ["name"] },
  "actions:icon": { agent: "insert.icon", props: ["geometry"] },
  "actions:icon#swap": { agent: "update.icon", writes: "geometry", on: "star", props: ["geometry"] },
  "drop:picture": { agent: "insert.picture", props: ["fills"] },
}

export const writesOf = (probe: Probe, look: Readonly<Record<string, unknown>>): readonly doom.Write[] => {
  let next = 0
  const mint = () => doom.nodeId(`m:${String((next += 1))}`)
  const change = { op: "update", target: idOf(probe), ...look } as doom.Intent
  const writes = compileIntent(built.view, change, mint, placement, starts)
  return doom.isRefusal(writes) ? [] : writes.filter((write) => write.node === idOf(probe))
}

const changeFields = doom.intentsSchema.$defs.change.properties
export const agentFields = new Set(Object.keys(changeFields))
export const agentOps = new Set<string>(changeFields.op.enum)
export const agentKinds = new Set<string>(changeFields.kind.enum)
