import * as doom from "@airdesign/doom"
import { compileAgentChange, starts, testTheme } from "@airdesign/doom/testing"
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
  "panel:box.align": { agent: "set.box", props: ["box"] },
  "panel:box.distribute": { agent: "set.box", props: ["box"] },
  "panel:text.style": { agent: "set.textStyle", writes: "text", on: "words", props: ["text"] },
  "panel:text.weight": { agent: "set.weight", writes: "text", on: "words", props: ["text"] },
  "panel:text.size": { agent: "set.size", writes: "text", on: "words", props: ["text"] },
  "panel:text.bold": { agent: "set.text", writes: "text", on: "words", props: ["text"] },
  "panel:text.italic": { agent: "set.text", writes: "text", on: "words", props: ["text"] },
  "panel:text.underline": { agent: "set.underline", writes: "text", on: "words", props: ["text"] },
  "panel:text.strike": { agent: "set.strike", writes: "text", on: "words", props: ["text"] },
  "panel:text.align": { agent: "set.align", writes: "text", on: "words", props: ["text"] },
  "panel:text.align#justify": { agent: "set.align", writes: "text", on: "words", props: ["text"] },
  "panel:text.list": { agent: "set.text", writes: "text", on: "words", props: ["text"] },
  "panel:text.fill": { agent: "set.color", writes: "text", on: "card", props: ["text"] },
  "panel:textFill.value": { agent: "set.color", writes: "text", on: "words", props: ["text"] },
  "panel:textFill.value#tint": { agent: "set.color", writes: "text", on: "words", props: ["text"] },
  "panel:fills.paint": { agent: "set.fill", writes: "fills", on: "card", props: ["fills"] },
  "panel:fills.paint#gradient": { agent: "set.fill", writes: "fills", on: "card", props: ["fills"] },
  "panel:border.border": { agent: "set.dash", writes: "stroke", on: "card", props: ["strokes", "stroke"] },
  "panel:border.color": { agent: "set.stroke", writes: "strokes", on: "rule", props: ["strokes"] },
  "panel:image.color": { agent: "set.stroke", writes: "strokes", on: "star", props: ["strokes"] },
  "panel:image.mode": { agent: "set.fit", writes: "fills", on: "photo", props: ["fills"] },
  "panel:link.target": { agent: "set.link", writes: "link", on: "words", props: ["link"] },
  "panel:link.target#words": { agent: "set.text", writes: "text", on: "words", props: ["text"] },
  "panel:geometry.preset": { agent: "set.shape", writes: "geometry", on: "card", props: ["geometry"] },

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
  "gesture:move-to-slide": { agent: "op.move", props: ["parent", "box", "geometry"] },
  "gesture:cut": { agent: "op.delete", props: ["parent"] },
  "gesture:paste": { agent: "op.add", props: ["parent", "type"] },
  "gesture:group": { agent: "op.wrap", props: ["parent", "type", "box"] },
  "gesture:frame": { agent: "set.clip", writes: "clip", on: "panel", props: ["clip"] },
  "menu:use-as-mask": { agent: "set.mask", writes: "mask", on: "card", props: ["mask"] },
  "gesture:ungroup": { agent: "op.unwrap", props: ["parent"] },
  "gesture:hide": { agent: "set.hidden", writes: "hidden", on: "card", props: ["hidden"] },
  "gesture:lock": { agent: "set.locked", writes: "locked", on: "card", props: ["locked"] },
  "gesture:undo": {
    personOnly: "the person's history; an agent writes the value back, and its run undoes as one",
    props: [],
  },
  "gesture:redo": { personOnly: "the person's history", props: [] },
  "gesture:tool-text": { agent: "add.text", props: ["type", "text"] },
  "gesture:tool-frame": { agent: "add.frame", props: ["type", "clip"] },
  "gesture:tool-rectangle": { agent: "add.shape", props: ["type", "geometry"] },
  "gesture:tool-ellipse": { agent: "set.shape", writes: "geometry", on: "card", props: ["geometry"] },
  "gesture:tool-line": { agent: "add.line", props: ["geometry"] },
  "gesture:tool-arrow": { agent: "set.arrow", writes: "geometry", on: "rule", props: ["geometry"] },
  "gesture:crop-drag": { agent: "set.crop", writes: "fills", on: "photo", props: ["fills", "box"] },
  "gesture:line-end": { agent: "set.to", writes: "geometry", on: "rule", props: ["geometry"] },
  "panel:border.route": { agent: "set.route", writes: "geometry", on: "rule", props: ["geometry"] },
  "panel:border.end": { agent: "set.arrow", writes: "geometry", on: "rule", props: ["geometry"] },
  "panel:border.start": { agent: "set.startArrow", writes: "geometry", on: "rule", props: ["geometry"] },
  "gesture:bold": { agent: "set.text", props: ["text"] },
  "gesture:italic": { agent: "set.text", props: ["text"] },
  "gesture:underline": { agent: "set.text", writes: "text", on: "words", props: ["text"] },
  "gesture:strike": { agent: "set.text", writes: "text", on: "words", props: ["text"] },
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
  "gesture:slide-earlier": { agent: "slide.move", props: ["parent"] },
  "gesture:slide-later": { agent: "slide.move", props: ["parent"] },
  "gesture:slide-group-up": {
    agent: "slide.move",
    probe: { op: "slide", move: { group: "a:2", before: "a:1" } },
    props: ["parent"],
  },
  "gesture:slide-group-down": {
    agent: "slide.move",
    probe: { op: "slide", move: { group: "a:1", after: "a:2" } },
    props: ["parent"],
  },
  "drag:slide-group-start": {
    agent: "slide.move",
    probe: { op: "slide", move: { slide: "a:3", group: "a:2", after: null } },
    props: ["parent"],
  },
  "menu:new-slide-group": {
    agent: "slide.add",
    probe: { op: "slide", add: { group: "new", after: "a:1" } },
    props: ["type", "parent"],
  },

  "strip:deck-name": { agent: "op.deck", props: ["name"] },
  "notes:slide-notes": { agent: "set.notes", writes: "notes", on: "slide", props: ["notes"] },
  "panel:theme": { agent: "deck.theme", props: ["theme"] },
  "panel:slide-background": { agent: "set.fill", writes: "fills", on: "slide", props: ["fills"] },
  "menu:skip-slide": { agent: "set.skipped", writes: "skipped", on: "slide", props: ["skipped"] },
  "panel:text.alignV": { agent: "set.alignV", writes: "text", on: "card", props: ["text"] },
  "panel:remove-auto-layout": { agent: "set.layout", props: ["layout"] },
  "panel:show-hidden": { agent: "set.hidden", writes: "hidden", on: "card", props: ["hidden"] },
  "panel:name": { agent: "set.name", writes: "name", on: "card", props: ["name"] },
  "actions:icon": { agent: "add.icon", props: ["geometry"] },
  "actions:icon#swap": { agent: "set.icon", writes: "geometry", on: "star", props: ["geometry"] },
  "drop:picture": { agent: "add.picture", props: ["fills"] },
}

export const writesOf = (probe: Probe, look: Readonly<Record<string, unknown>>): readonly doom.Write[] => {
  let next = 0
  const mint = () => doom.nodeId(`m:${String((next += 1))}`)
  const change = { op: "set", target: idOf(probe), ...look } as doom.AgentChange
  const writes = compileAgentChange(built.view, change, mint, placement, starts)
  return doom.isRefusal(writes) ? [] : writes.filter((write) => write.node === idOf(probe))
}

const changeFields = doom.agentChangesSchema.$defs.change.properties
export const agentFields = new Set(Object.keys(changeFields))
export const agentOps = new Set<string>(changeFields.op.enum)
export const agentKinds = new Set<string>(changeFields.kind.enum)
