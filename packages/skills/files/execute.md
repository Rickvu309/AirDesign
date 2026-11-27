# Creating, reading and changing a deck with `airdesign_execute`

`airdesign_execute` runs one JavaScript script against one deck. Send `{ deck, script, runId? }`. When the script ends, everything it changed lands as one edit and one undo step. If it throws, nothing lands.

## Create a deck

Start with `airdesign_get_app_state` to find your decks, an open deck and its selection when available. Use `cursor: next` to see more decks.

To start a new deck, omit `deck` and `runId` and send the script `createDeck({ name: "Quarterly review", theme: "neutral" })`. Both fields are optional. Use one `createDeck` call per script. The answer gives you the new deck id and its first slide id. Use that deck id in later calls to fill the deck. Read the `slides` skill before designing.

## The script

- Each operation below is a global function that takes one object of fields and answers at once. `insert` returns the new id, so one script can add a slide, fill it, measure it and fix it.
- Use variables, loops and arithmetic. Compute sizes and positions from the numbers, such as a bar's width from its value or an even spacing from a count, instead of guessing.
- `print(...)` or `console.log(...)` adds a line to the answer's `logs`, up to 50. The value of the last expression comes back as `result`, cut at 20,000 characters.
- A refused operation throws an Error whose message names the operation by its number and says what to fix. Uncaught, nothing lands and the answer gives the line. In a deck edit script, you can catch the error and continue. If any operation fails in a creation script, no deck is created.
- If Execute refuses an edit as `stale`, read the changed property with `get` in a separate call before revising your edit.
- The sandbox has no network, files, modules, timers or `await`. A script runs at most 20 seconds and 64 MB, is at most 100,000 characters, and makes at most 100 changes. Split bigger work over several calls.

```js
const s = insert({ kind: "slide" })
insert({
  parent: s,
  kind: "text",
  textStyle: "title",
  text: "Enterprise drove most of the growth",
  box: { x: 120, y: 80, w: 1680, h: 140 },
})
const rows = [
  ["Enterprise", 18.6],
  ["Mid-market", 14.9],
  ["SMB", 7.9],
]
const most = Math.max(...rows.map(([, value]) => value))
rows.forEach(([label, value], i) => {
  const y = 320 + i * 160
  const w = Math.round((1100 * value) / most)
  insert({
    parent: s,
    kind: "text",
    textStyle: "body",
    text: label,
    alignV: "center",
    box: { x: 120, y, w: 300, h: 112 },
  })
  insert({
    parent: s,
    kind: "shape",
    shape: "rect",
    fill: i === 0 ? "accent1" : "background2",
    box: { x: 440, y: y + 20, w, h: 72 },
  })
  insert({
    parent: s,
    kind: "text",
    textStyle: "body",
    text: `$${value}M`,
    alignV: "center",
    box: { x: 460 + w, y, w: 240, h: 112 },
  })
})
insert({
  parent: s,
  kind: "text",
  textStyle: "caption",
  text: "Source: FY26 segment report",
  box: { x: 120, y: 960, w: 1200, h: 48 },
})
screenshot({ target: s })
get({ target: s }).problems
```

## Operations

- `insert({ parent, kind, ...look })` adds a layer to a slide or a frame and returns its id. Leave `box` out and the layer takes the largest free area of the slide, or its place in a frame with a layout. `kind`:
  - `text`: words in markdown. A slide's first layer with `textStyle: "title"` becomes its title.
  - `shape`: a preset `shape` that can hold text: `rect`, `roundRect`, `ellipse`, `triangle`, `diamond`, `chevron`, `homePlate`, `rightArrow`, `star5`, `donut` and more.
  - `line`: a line or connector with `from`, `to`, `route`, `arrow`. `path`: SVG commands in `d`, from 0 to 1 across the box.
  - `frame`: holds layers (`layout`, `gap`, `padding`, `clip`). Given `rows`, a list of rows of cell strings with the header first, it is a grid of words.
  - `picture`: `fill: { image }` with an https address or an asset hash from this deck. `icon`: a Lucide name in `icon`, such as `trending-up`.
- `insert({ kind: "slide", after?, group?, ...look })` adds a slide, last unless `after` names a slide, and returns its id. `group` is a slide group id or `"new"`.
- `update({ target, ...look })` changes a layer or a slide. `target` is an id, `<slide>.title`, `<slide>.subtitle`, `<slide>.body`, or `*.title` for every slide's title.
- `replace({ target, kind, ...look })` puts a new layer in the place of `target`, in the same parent and order and with its box unless you give one. Returns the new id.
- `copy({ targets })` copies layers or slides, each right after its source, and returns the new ids.
- `copy({ from: "kit/<piece>", parent, box? })` copies a kit piece into a slide or frame as plain layers you own and returns its id in a list. The `kit` skill lists the pieces.
- `move({ target or targets, parent?, after?, box? })` moves layers. `parent` is a frame or a slide, `after` a sibling id or `null` for first, and `box` places them: `x` and `y` move the group, `w` and `h` do not resize. A slide moves with `after` or `before` a slide (`after: null` puts it first) or into a `group`.
- `remove({ target or targets })` deletes layers or slides. A deck keeps one slide.
- `group({ targets, layout?, clip?, ...look })` wraps layers in a new frame and returns its id. `ungroup({ target })` dissolves one.
- `variables({ theme?, colors?, fonts?, name?, nameFollows?, language? })` changes the deck's theme and returns its colours, fonts and text sizes. `theme` is `neutral`, `consulting`, `editorial`, `midnight` or `technical`; after you pick one, read its style with `airdesign_get_style {name: <theme>}`. `colors` maps a theme colour name to `#rrggbb`. `fonts` is `{ heading?, body? }`.
- `get(...)` reads the deck as the script has left it so far:
  - `get({ target })` returns `{ id, kind, box, parent, children, layers, problems }` for a slide or a layer. `box` is measured with the deck's own fonts, so it is the size the words really take.
  - `get()` returns the deck: `{ name, slides, theme, layers, problems }`, with `next` when more slides are left: `get({ cursor: next })`.
  - `get({ find: "words" })` returns every layer whose line holds the words.
  - `layers` has one line per layer: its id, kind, `@x,y` and size, then its look.
- `screenshot({ target })` adds a picture of the slide that holds `target`, taken after the edit lands by the person's open AirDesign tab, up to 4 slides a call. With no tab open the answer says so at once: do not ask again.

## Look fields

Sizes are pixels on a 1920 by 1080 slide. Name the deck's own colours and text styles first, so a new theme restyles the deck.

- Colours: `text`, `background`, `text2`, `background2`, `accent1` to `accent6`, `link`. Add `+1` to `+100` to lighten or `-1` to `-100` to darken (`accent1+40`), or give `#rrggbb` when the person asks for it.
- `fill`: a colour, `"none"`, `{ image }`, or `{ gradient: [colours], angle?, radial? }`. Text takes `color` instead.
- `stroke` (a colour or `"none"`), `strokeWidth`, `dash` (`solid`, `dash`, `dot`), `radius`, `opacity` (0 to 1), `effect` (`soft`, `lifted`, `glow`, `none`), `effectOpacity`, `innerShadow`, `blur`, `mask`, `hidden`, `locked`, `name`.
- `text`: markdown: `**bold**`, `*italic*`, `++underline++`, `~~strike~~`, `[label](url)`, `- ` bullets, `1. ` lists, a blank line between paragraphs. `insert: { at, text, link }` adds linked words without replacing the rest.
- `textStyle`: `display`, `bigNumber`, `title`, `heading`, `body`, `body2`, `caption`, `label`. It sets size, font, weight and spacing together. Only when the person asks: `size`, `font`, `weight` (`Thin` to `Black`), `lineHeight`, `letterSpacing`, `case`, `underline`, `strike`.
- Text placement: `align` (`left`, `center`, `right`, `justify`), `alignV` (`top`, `center`, `bottom`), `padding` (a number or `{ t, r, b, l }`), `spaceBefore`, `spaceAfter`.
- Frames: `layout` (`row`, `column`, `none`), `gap`, `padding`, `align`, `clip`. Text style fields go on the text inside a frame, never on the frame.
- Geometry: `box: { x, y, w, h }`, `rotation`, `flip` (`none`, `h`, `v`, `hv`), `shape`.
- Connectors: `from` and `to` take `{ layer, side?, along? }` or `{ x, y }`. `along` places the end on its side, from 0 at the left or top to 1; left out, the middle. `route` is `straight`, `elbow` or `curve`. `lane` is where an elbow's middle leg runs: a y when the line leaves a top or bottom side, else an x. `arrow` and `startArrow` are `true`, `none`, `arrow`, `triangle` or `circle`.
- Pictures: `fit` (`fill`, `fit`, `crop`, `tile`) and `crop: { left?, top?, right?, bottom? }` in percent.
- Slides: `link`, `notes`, `skipped`, `transition: { kind, ms }`.

## The answer

- `made` lists the new ids by operation, as `{ op, verb, ids }`. `names` gives the id of each layer the script named with `name`.
- `problems` lists what is off on the slides the call touched, such as overflow, overlap, off-slide, small text, or a colour, size or font off the deck's own choices. Each says how to fix it. Fix each one unless the person asked for it.
- `result`, `logs` and `pictures` hold what the script returned, printed and asked to see.
- Send `runId` with every later call in your turn, and to `airdesign_stop_run` when you are done.

## Refusals

- `person-protected`: a person changed that layer during your run. Leave it.
- `field`, `dead`, `kind`, `limit`: the note names the operation, its number and line, and what to change. Fix that operation and send the script again.
- `script`: the script threw, or ran past its time or memory. Nothing landed.
- `busy`: your account already has a script waiting. Wait for an execute call to finish, then try again.
