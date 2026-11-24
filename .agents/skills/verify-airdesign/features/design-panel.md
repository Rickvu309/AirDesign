# Set an element's design from the Design panel

`Design` on the toolbar's Agent and Design switch opens the Design panel in the right column. With nothing selected it shows the slide: `Slide N`, `Template style`, `Background` and `Selection colors`. Selecting a layer shows its sections, titled by what it is (`Text`, `Shape`, `Image`, `Line`, `Group`, `Frame`), with the sections of `panelOrder` in `apps/web/src/design/panel-order.ts` that the layer has, built from the layer's Doom props by `nodeModel` in `apps/web/src/editor/design-model.ts`. Every control writes the layer's props through `changeWrites` (`apps/web/src/editor/design-changes.ts`), paints before the server answers, is one undo step, and survives a reload. Several selected layers share one panel, titled `N selected`, and a shared edit writes each.

## Sub-features

- `alignment` every layer kind leads with Align (left, centre, right, top, middle, bottom) and Distribute. One layer aligns to its parent frame or to the slide; several align to the selection's edge (`alignWrites` in `apps/web/src/editor/design-align.ts`).
- `text` a text layer: the named style, Weight, Size, Bold, Italic, Underline, Strikethrough, alignment, bullets or numbers, and, on a fixed-size box only, vertical align (Top, Middle, Bottom), as in Figma. Its `Fill` sets the words' colour, and `Link` points them at a web address or a slide.
- `fill` a shape or a frame: `Fill` with None, Solid, Gradient and Image. A gradient shows its stops, direction and angle, and `From center` makes it radial (`doomGradient` in `apps/web/src/editor/design-model-fills.ts`). Image picks a file (see `picture-add.md`) and lists how it sits: Fill, Fit or Crop.
- `picture` a picture: `Fill` with how the image sits (Fill, Fit or Crop), and `Replace image` beside the title. An icon has a Color swatch.
- `border` a shape, frame, picture or line: `Border` with None, Solid, Dashed and Dotted (a line has no None), then `Color` once it has one.
- `chart` a chart: its data table (`[data-chart-data]`), add row, add series, series names, and its kind (`ChartSection` in `apps/web/src/editor/design-chart.tsx`).
- `auto-layout` an auto layout frame: `Remove auto layout` under the title (see `auto-layout-frame.md`).
- `selection-colors` `Selection colors` lists the colours the selection, or the slide, uses; picking one changes each layer that uses it.
- `slide` with nothing selected: `Background` takes Solid, Gradient, Image or a colour for the slide's fills, and `Template style` reads out the deck's theme: its name, fonts and colours, with nothing to open (`DoomThemeCard`). An agent sets theme colours and the heading and body fonts.
- `color-picker` every colour field opens one picker with the template's colours and the deck's other colours.

## How to get to it (user POV)

- An open deck `/s/<id>`: `Design` on the toolbar's switch, then a click on a layer, or on empty slide for the slide's panel.
- Agent and Design share the right column; a reload opens the panel the deck last showed.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Browser tests.** `pnpm test:browser tests/browser/editor-design.spec.ts`: the slide's panel and its background (solid, gradient, a colour) and selection colours; Template style reads out the theme and has nothing to open; a text layer's Text controls each write its spans, undo and survive a reload, with Fill and Link; a shape's Fill paints before the server answers, and stroke color can be undone; a picture's fit and Replace, Remove auto layout, and a chart's data and kind; two layers share one panel and Align moves them to the selection's edge; an image fill picked for a shape, the background and a Replace. `tests/browser/editor-gradient-fill.spec.ts` covers the gradient's stops, direction, angle and From center. `tests/browser/control-*.spec.ts` drive one control kind each (`action`, `angle`, `choice`, `color`, `length`, `link`, `list`, `record`, `toggle`, `typography`, `union`).
- **Unit tests.** `apps/web/src/editor/design-adapter.test.ts`, `design-palette.test.ts` and `chart-data-writes.test.ts`, and `packages/doom/src/text-writes.test.ts` for the text writes the panel and an agent share; `apps/web/src/editor/control-kinds.test.ts` lists the control kinds the Doom panel never shows (`notInDoomPanel`).
- **States for look.** `design-element`, `design-element-changed`, `design-element-small`, `design-element-large`, `design-panel-reloaded`, `design-fill`, `design-picture-fill`, `design-border`, `design-border-dashes`, `design-effects`, `design-shape`, `design-text-style`, `design-text-sizes`, `design-text-weight`, `design-heading-weight`, `design-many-text`, `design-many-line`, `design-template`, `color-picker-fill`, `color-picker-text`, `color-picker-background`, `selection-color-target`, `selection-colors-shape`, `selection-colors-many`, `selection-colors-slide`, `two-shapes-panel`, `panel-text`, `panel-shape`, `panel-picture`, `panel-icon`, `panel-connector`, `panel-frame`, `panel-pair`, `panel-slide`, `slide-chart`, `font-catalog`, `text-link`.
- **Scratch journey, 2026-11-24.** On a fixed text box, Bottom writes `alignV` bottom and the line sits on the bottom edge. One undo puts it back to top.

## Gotchas

- Each control names its panel section and field, and its value's `Desc` (kind, unit, range, choices) from `apps/web/src/design/control-desc.ts`. `doomControl` in `apps/web/src/editor/design-controls.ts` builds each one from the Doom property it edits, with its label from `apps/web/src/copy`.
- A font the browser lacks paints in the fallback face, so an agent-set font such as Georgia changes the text's font but may look the same on a machine without it.
