# Editing a deck with `airdesign_edit_deck`

`airdesign_edit_deck` applies an ordered batch of changes to one deck. Either every change lands or none does.

## Call shape

Send `{ deck, base, runId?, changes }`:

- `deck`: deck id from `airdesign_list_decks` or `airdesign_create_deck`.
- `base`: the integer `rev` returned by your latest `airdesign_read_deck` or `airdesign_edit_deck`.
- `runId`: optional. Omit on the first edit to start a run; pass the returned `runId` on follow-up edits in the same turn, then pass it to `airdesign_stop_run` when finished.
- `changes`: 1 to 100 change objects, applied in order.

A newly added layer or slide has an id only in the answer (`added: [{ change, id, kind }]`). To add slides and fill them, add the slides in one edit and place layers onto their returned ids in the next.

Coordinates are pixels on a 1920 by 1080 slide. Leaving `box` out places a layer in the largest free area of the slide.

## Ids and targets

- Node and slide ids have the form `<prefix>:<number>` (read from `airdesign_read_deck`).
- `target` on `set` accepts a node id, `<slide>.title`, `<slide>.subtitle`, `<slide>.body`, or a deck-wide role wildcard (`*.title`, `*.subtitle`, `*.body`).
- Slide group ids appear at the end of each slide line in `airdesign_read_deck` as `group=<id>`.

## Operations (`op`)

### `add`

Add a layer to a slide or frame: `{ op: "add", kind, slide, into?, ...look }`.

- `kind`:
  - `text`: text layer. Holds markdown words. The first layer with `textStyle: "title"` on a slide becomes its title.
  - `shape`: preset shape (optional `shape` name) that can also hold text. Use `kind: "line"` for lines and connectors.
  - `line`: line or connector with `from`, `to`, `route`, `arrow`, `startArrow`, `stroke`, `strokeWidth`, `dash`.
  - `path`: vector path using `d` (SVG path commands in 0 to 1 box-relative coordinates) and optional `fillStroke`.
  - `frame`: container that groups children (`layout`, `gap`, `padding`, `clip`) or creates a word grid when given `rows` (array of row string arrays; first row is the header; cells accept markdown; `""` leaves a cell empty).
  - `picture`: image layer using `fill: { image }` (an `https` URL or deck asset hash), `fit`, and `crop`.
  - `icon`: Lucide icon by name in `icon` (such as `trending-up` or `arrow-right`).
- `into`: optional frame id on `slide` to place the new layer inside.

### `set`

Update an existing layer or role target: `{ op: "set", target, ...look }`.

### `move`

Move or reorder layers: `{ op: "move", node?, nodes?, into?, after?, box? }`.

- Send `node` (one layer) or `nodes` (list of layers).
- `into` is required when sending `nodes` or `box` and names the destination slide; with a single `node`, `into` may also name a frame.
- `after`: sibling id to place after, `null` for first, omitted for last.
- `box`: `{ x, y, w, h }`; `x` and `y` place the union of moved layers while `w` and `h` do not resize them.

### `wrap` and `unwrap`

- `{ op: "wrap", nodes, layout?, clip? }`: wrap layers in a frame (`layout`: `"row" | "column" | "none"`).
- `{ op: "unwrap", node }`: dissolve a frame or group, leaving children in place.

### `delete` and `duplicate`

- `{ op: "delete", nodes }`: remove layers.
- `{ op: "duplicate", nodes }`: copy layers or slides, each placed immediately after its source.

### `slide`

Send `{ op: "slide" }` with exactly one of `add`, `move`, or `delete`:

- `add`: `{ after?, group? }`. `after` names a slide to follow (or a group when `group: "new"`). Omit `after` for last, or name a `group` and pass `after: null` for first.
- `move`: `{ slide | slides | group, after | before, group? }`. Move `slide` or `slides` with `after` (slide id or `null` for first) and optional destination `group` (or `"new"`, where `after` names a group or `null`). Move an entire slide group by sending only `group` with either `before` or `after` a group id (`after: null` puts it first).
- `delete`: slide id. A deck keeps at least one slide; to replace the last slide, include both `delete` and `add` in the same edit.

### `deck`

Update deck-level settings: `{ op: "deck", name?, nameFollows?, language?, theme?, colors?, fonts? }`.

- `nameFollows: true` keeps the deck name synced to slide 1's title; setting `name` turns it off.
- `theme`: library theme id (`neutral`, `consulting`, `editorial`, `midnight`, `technical`).
- `colors` (`#rrggbb` by theme colour name) and `fonts` (`{ heading?, body? }`) override the chosen theme when provided.

### `detach`

- `{ op: "detach", target }`: turn a template instance into editable plain layers.

## Look fields

### Colours

Prefer theme colour names so restyling follows: `text`, `background`, `text2`, `background2`, `accent1` through `accent6`, and `link`. Append `+<1..100>` to lighten or `-<1..100>` to darken (for example `accent1+40` or `text-20`), or pass a hex `#rrggbb` when a specific colour is required.

### Fill, border and effects

- `fill`: a colour, `"none"`, `{ image }`, or `{ gradient: [c1, c2, ...], angle?, radial? }` (2 to 8 colours; `angle` in degrees where 0 runs left to right and wraps past 360). Use `color` instead of `fill` for text colour.
- `stroke`: a colour or `"none"`; `strokeWidth` (0 to 200 px); `dash` (`"solid" | "dash" | "dot"`).
- `radius`: corner radius in px (half the shorter side or more forms a pill or circle).
- `opacity`: 0 (clear) to 1 (solid).
- `effect`: `"soft" | "lifted" | "glow" | "none"`; `effectOpacity` (0 to 1).
- `innerShadow`: `{ color, x, y, blur, spread, opacity? }` or `"none"`.
- `blur`: layer blur in px (0 clears it).
- `mask`, `hidden`, `locked`: booleans; `name`: non-empty layer name.

### Text and typography

- `text`: markdown string (`**bold**`, `*italic*`, `++underline++`, `~~strike~~`, `[label](url)`, `- ` bullets, `1. ` numbered lists, two spaces per indent level, blank line between paragraphs). Replaces all words on the layer.
- `insert`: `{ at, text, link }` inserts one line of linked text at character offset `at` without replacing other words. Send `insert` or `text`, never both.
- `textStyle`: `"display" | "bigNumber" | "title" | "heading" | "body" | "body2" | "caption" | "label"`. Sets size, font, weight and spacing together and clears manual overrides.
- Manual overrides when needed: `color`, `size` (1 to 2000 px), `font`, `weight` (`Thin`, `ExtraLight`, `Light`, `Regular`, `Medium`, `SemiBold`, `Bold`, `ExtraBold`, `Black`), `lineHeight` (0.5 to 5 multiple), `letterSpacing` (-100 to 100 px), `case` (`"none" | "upper" | "lower" | "title"`), `underline`, `strike`, `align` (`"left" | "center" | "right" | "justify"`), `alignV` (`"top" | "center" | "bottom"`), `spaceBefore`, `spaceAfter`, `padding` (number or `{ t, r, b, l }` in px).

### Layout, geometry, connectors, images and slides

- Frame layout: `layout` (`"row" | "column" | "none"`), `gap` (0 to 1000 px), `padding`, `align` (cross-axis alignment), `clip`.
- Geometry: `box: { x, y, w, h }`, `rotation` (degrees clockwise, wraps), `flip` (`"none" | "h" | "v" | "hv"`), `shape` (preset shape name).
- Connectors: `from` and `to` each take `{ layer, side? }` (`"top" | "right" | "bottom" | "left" | "center"`, omitted chooses the facing side) or `{ x, y }`; `route` (`"straight" | "elbow" | "curve"`); `arrow` (boolean or `"none" | "arrow" | "triangle" | "circle"`); `startArrow`.
- Images: `fit` (`"fill" | "fit" | "crop" | "tile"`), `crop: { left?, top?, right?, bottom? }` (percent 0 to 99 cut from each side, leaving part of the image; sets `fit: "crop"`).
- Links and slides: `link` (`https`, `mailto`, slide id, or `"none"`), `notes` (presenter notes), `skipped` (skip in Present), `transition: { kind: "none" | "fade" | "push" | "smartMove", ms }`.

## Handling refusals

- `stale`: the deck changed after your read. Call `airdesign_read_deck` and retry with the new `rev` as `base`.
- `person-protected`: a person edited that layer during your run. Leave that layer alone, or omit `runId` to start a new run.
- `field` / `batch` / `dead`: read `at`, `change`, `field` and `note` in `structuredContent` to fix the offending change and resend the batch.
