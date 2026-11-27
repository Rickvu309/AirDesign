import { agentChangesSchema as schema } from "@airdesign/doom"
import { fieldForms } from "./refusal-words.js"

const descriptions: Readonly<Record<string, string>> = {
  "properties.changes":
    "Applied in order, all or none. Sizes are pixels on a 1920 by 1080 slide. Take ids from get. Patterns and frames with a layout place their own children. Colours are theme names, so a new template recolours the deck.",
  "$defs.color":
    "A theme colour name, lighter or darker by a percent (accent1+40, text-20), or #rrggbb. Prefer names: a template recolours them.",
  "$defs.change.properties.op":
    "add: kind, slide, into?, look. set: target, look. move: node, or nodes. into is required with nodes or box and then names a slide; one node may name a frame. after?. box? places the union by x, y or both; w, h do not resize. wrap: nodes, layout?. unwrap: node. delete: nodes. slide: one of add, move, delete. Group ids are in get as group=<id>. duplicate: nodes, layers or slides, each copied right after itself. deck: name?, nameFollows?, language?, theme?, colors?, fonts?. Colors and fonts override the selected theme when provided.",
  "$defs.change.properties.kind":
    "text and shape hold words. line. path: d. frame groups children, or rows makes a grid. picture: fill {image}. icon.",
  "$defs.change.properties.slide": "The slide to add to.",
  "$defs.change.properties.into": "A frame on that slide to add into.",
  "$defs.change.properties.target":
    "A node id; '<slide>.title', '<slide>.subtitle' or '<slide>.body', the node with that role; '*.title' and the like, that role on every slide.",
  "$defs.change.properties.node": "The node.",
  "$defs.change.properties.nodes": "Node ids.",
  "$defs.change.properties.after": "Place after this sibling. null puts it first. Left out puts it last.",
  "$defs.change.properties.add.properties.after":
    "Slide to follow. With group new, group to follow. Omit for last, or name a group and use null for first.",
  "$defs.change.properties.add.properties.group": "A group id, or new.",
  "$defs.change.properties.add": "Add a slide.",
  "$defs.change.properties.move":
    'Move slide or slides, with after a slide id or null for first, and optional destination group. With group "new", after names a group or null. Move a whole group by sending only group and either before or after a group id (after null puts it first).',
  "$defs.change.properties.delete": "A slide to delete.",
  "$defs.change.properties.theme": "Replace the deck theme with these colours, fonts, text styles and effect styles.",
  "$defs.change.properties.colors": "Theme colours by name, as #rrggbb. Every layer that names one follows.",
  "$defs.change.properties.fonts": "The theme's heading and body font families.",
  "$defs.change.properties.nameFollows": "true: the deck's name follows slide 1's title. Setting a name stops it.",
  "$defs.change.properties.language":
    "Deck or text language as a BCP 47 tag, for example ja or zh-Hant. Use und to infer it.",
  "$defs.change.properties.d": "Set a path's SVG commands in box-relative coordinates (0 to 1 spans the box).",
  "$defs.change.properties.fillStroke": "Extend an opaque path fill by one pixel along its edge.",
  "$defs.change.properties.fill":
    "Paint inside the layer: a colour, none, {image} for a picture, or {gradient} through two to eight colours. Text takes color instead.",
  "$defs.change.properties.fill.anyOf.2.properties.image": "An https address, or an asset read from the deck.",
  "$defs.change.properties.fill.anyOf.3.properties.angle": "Degrees; 0 runs left to right. Wraps past a full turn.",
  "$defs.change.properties.stroke": "Outline colour, or none.",
  "$defs.change.properties.strokeWidth": "Outline weight in pixels. A stroke colour alone draws a thin one.",
  "$defs.change.properties.color": "Text colour.",
  "$defs.change.properties.radius": "Corner radius in pixels. Half the shorter side or more makes a pill or a circle.",
  "$defs.change.properties.effect": "A shadow or glow style from the deck, or none.",
  "$defs.change.properties.effectOpacity": "Shadow strength, 0 to 1.",
  "$defs.change.properties.link": fieldForms["link-or-none"],
  "$defs.change.properties.clip": "Clip a frame's children.",
  "$defs.change.properties.mask": "This layer masks the layers above it.",
  "$defs.change.properties.opacity": "0 is clear, 1 is solid.",
  "$defs.change.properties.text":
    "Words as markdown: **bold**, *italic*, ++underline++, ~~strike~~, [label](url), '- ' bullets, '1. ' numbers, two spaces for each level, a blank line between paragraphs. Replaces all the words.",
  "$defs.change.properties.insert":
    "Insert one line of linked words at a character offset, and leave the other words. at past the end inserts at the end. Send this or text, not both.",
  "$defs.change.properties.textStyle":
    "A named style from the deck: size, font, weight and spacing together. It clears size, font, lineHeight, letterSpacing and case. The first title text on a slide becomes its title.",
  "$defs.change.properties.align":
    "Text alignment. In a frame with a layout: where its children sit across the layout.",
  "$defs.change.properties.layout": "How a frame places its children. none leaves them where they are.",
  "$defs.change.properties.gap": "Space between the children of a row or column.",
  "$defs.change.properties.padding":
    "Space in pixels between a text box and its words or a frame and its children. A number sets all sides. Use t, r, b, l to set individual sides.",
  "$defs.change.properties.icon": fieldForms["named-icon"],
  "$defs.change.properties.arrow": "End arrowhead. true is arrow, false is none.",
  "$defs.change.properties.startArrow": "Arrowhead where a line starts.",
  "$defs.change.properties.from": "Where a line starts: a layer's side, which it then follows, or a point.",
  "$defs.change.properties.from.anyOf.0.properties.side": "Left out: the side facing the other end.",
  "$defs.change.properties.from.anyOf.0.properties.along":
    "Where on the side, from 0 at its left or top end to 1. Left out: its middle.",
  "$defs.change.properties.to": "Where a line ends: a layer's side, which it then follows, or a point.",
  "$defs.change.properties.route": "How a line runs between its ends.",
  "$defs.change.properties.lane":
    "Where an elbow line's middle leg runs: a y when its start leaves a top or bottom side, else an x.",
  "$defs.change.properties.rows":
    "Add with kind frame. Words in a grid, one array for each row, the first row the header. Markdown works in a cell. An empty string leaves the cell empty.",
  "$defs.change.properties.box":
    "x, y, w, h in pixels on the slide, or inside the frame you add into. set and move keep what you leave out. add takes all four, or none for the largest free area.",
  "$defs.change.properties.name": "Layer name, or with op deck the deck's name. Never empty.",
  "$defs.change.properties.hidden": "Hide the layer.",
  "$defs.change.properties.locked": "Lock the layer against selection and moves.",
  "$defs.change.properties.size": "Text size in pixels.",
  "$defs.change.properties.font": "A font family, such as Inter.",
  "$defs.change.properties.weight": "Thin, ExtraLight, Light, Regular, Medium, SemiBold, Bold, ExtraBold or Black.",
  "$defs.change.properties.lineHeight": "Line height as a multiple of the size.",
  "$defs.change.properties.letterSpacing": "Letter spacing in pixels.",
  "$defs.change.properties.case": "Letter case.",
  "$defs.change.properties.underline": "Underline all the words.",
  "$defs.change.properties.strike": "Strike through all the words.",
  "$defs.change.properties.dash": "Outline dash.",
  "$defs.change.properties.fit": "How a picture sits in its layer.",
  "$defs.change.properties.crop":
    "Crop a picture: the percent cut from each side, 0 to 99. The layer keeps its size, so set box too to resize it. Sets fit crop.",
  "$defs.change.properties.shape": "A shape's outline. Lines and connectors are not shapes: add kind line.",
  "$defs.change.properties.rotation": "Degrees clockwise. Wraps past a full turn.",
  "$defs.change.properties.flip": "Mirror across, down, or both.",
  "$defs.change.properties.notes": "Presenter notes.",
  "$defs.change.properties.skipped": "Skip this slide in Present.",
  "$defs.change.properties.transition": "How this slide arrives in Present, and for how many milliseconds.",
  "$defs.change.properties.alignV": "Where the words sit in the box: top, center or bottom.",
  "$defs.change.properties.spaceBefore": "Space before each paragraph, in pixels.",
  "$defs.change.properties.spaceAfter": "Space after each paragraph, in pixels.",
  "$defs.change.properties.blur": "Blur the layer, in pixels. 0 clears it.",
  "$defs.change.properties.innerShadow": "An inner shadow, or none to clear inner shadows.",
}

const sharedPaths: Readonly<Record<string, string>> = {
  "$defs.change.properties.to.anyOf.0.properties.side": "$defs.change.properties.from.anyOf.0.properties.side",
  "$defs.change.properties.to.anyOf.0.properties.along": "$defs.change.properties.from.anyOf.0.properties.along",
}

function describe<T>(shape: T, path = ""): T {
  if (Array.isArray(shape)) return shape.map((value: unknown, i) => describe(value, `${path}.${i}`)) as T
  if (shape === null || typeof shape !== "object") return shape
  const description = descriptions[sharedPaths[path] ?? path]
  return {
    ...Object.fromEntries(
      Object.entries(shape).map(([key, value]) => [key, describe(value, path === "" ? key : `${path}.${key}`)]),
    ),
    ...(description === undefined ? {} : { description }),
  } as T
}

export const agentChangesSchema = describe(schema)
