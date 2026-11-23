# Set an element's design from the Design panel

`Design` on the toolbar's Agent and Design switch opens the Design panel in the right column. With nothing selected it shows the slide: `Slide N`, `Template style`, `Background` and `Selection colors`. Selecting a layer shows its sections, titled by what it is (`Text`, `Shape`, `Image`, `Line`, `Group`, `Frame`), with the slides-mode sections of `panelOrder` in `apps/web/src/design/panel-order.ts` that the layer has, built from the layer's Doom props by `nodeModel` in `apps/web/src/doom-editor/design-model.ts`. Every control writes the layer's props through `changeWrites` (`apps/web/src/doom-editor/design-changes.ts`), paints before the server answers, is one undo step, and survives a reload. Several selected layers share one panel, titled `N selected`, and a shared edit writes each.

## Sub-features

- `alignment` every layer kind leads with Align (left, centre, right, top, middle, bottom) and Distribute. One layer aligns to its parent frame or to the slide; several align to the selection's edge (`alignWrites` in `apps/web/src/doom-editor/design-align.ts`).
- `text` a text layer: the named style, Font, Weight, Size, Letter spacing, Line height, Bold, Italic, Underline, Strikethrough, alignment, bullets or numbers, and case. Its `Fill` sets the words' colour, and `Link` points them at a web address or a slide.
- `fill` a shape or a frame: `Fill` with None, Solid, Gradient and Image. A gradient shows its stops, direction and angle, and `From center` makes it radial (`doomGradient` in `apps/web/src/doom-editor/design-model-fills.ts`). Image picks a file (see `picture-add.md`) and lists how it sits: fill, fit or tile.
- `picture` a picture: `Fill` with how the image sits (fill, fit or tile), and `Replace image` beside the title. An icon shows `Color` and `Weight` in its Fill instead.
- `opacity` a text layer, shape, frame or picture: one `Opacity`, a percent.
- `corners` a shape, a frame or a photo: `Corners`, a radius.
- `border` a shape, frame, picture or line: `Border` with None, Solid, Dashed and Dotted (a line has no None), then `Color` and `Border width` once it has one.
- `shadow` a shape, frame, picture or line: `Shadow` with None, Subtle, Medium and Strong, and the shadow's `Opacity` once it has one.
- `chart` a chart: its data table (`[data-chart-data]`), add row, add series, series names, and its kind (`ChartSection` in `apps/web/src/doom-editor/design-chart.tsx`).
- `auto-layout` an auto layout frame: `Remove auto layout` under the title (see `auto-layout-frame.md`).
- `selection-colors` `Selection colors` lists the colours the selection, or the slide, uses; picking one changes each layer that uses it.
- `slide` with nothing selected: `Background` takes Solid, Gradient, Image or a colour for the slide's fills, and `Template style` opens the deck's theme, where a colour writes the theme and Undo takes it back (`DoomThemeCard`).
- `color-picker` every colour field opens one picker with the template's colours and the deck's other colours.

## How to get to it (user POV)

- An open deck `/s/<id>`: `Design` on the toolbar's switch, then a click on a layer, or on empty slide for the slide's panel.
- Agent and Design share the right column; a reload opens the panel the deck last showed.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Browser tests.** `pnpm test:browser tests/browser/doom-editor-design.spec.ts`: the slide's panel and its background (solid, gradient, a colour) and selection colours; Template style writes the theme and undoes; a text layer's Text controls each write its spans, undo and survive a reload, with Fill, Link and Opacity; a shape's Fill, Opacity, Corners, Border and Shadow paint before the server answers and each undoes; a picture's fit and Replace, Remove auto layout, and a chart's data and kind; two layers share one panel and Align moves them to the selection's edge; an image fill picked for a shape, the background and a Replace. `tests/browser/doom-gradient-fill.spec.ts` covers the gradient's stops, direction, angle and From center. `tests/browser/control-*.spec.ts` drive one control kind each (`action`, `angle`, `choice`, `color`, `corners`, `length`, `link`, `list`, `percent`, `record`, `text`, `toggle`, `typography`, `union`).
- **Unit tests.** `apps/web/src/doom-editor/design-adapter.test.ts`, `design-palette.test.ts` and `chart-theme-writes.test.ts`, and `packages/doom/src/text-writes.test.ts` for the text writes the panel and an agent share; `apps/web/src/control-kinds.test.ts` lists the control kinds the Doom panel never shows (`notInDoomPanel`).
- **States for look.** `design-element`, `design-element-changed`, `design-element-small`, `design-element-large`, `design-control-entered`, `design-panel-reloaded`, `design-fill`, `design-picture-fill`, `design-border`, `design-border-dashes`, `design-effects`, `design-shape`, `design-opacity`, `design-corners-shape`, `design-corners-picture`, `design-text-style`, `design-text-fonts`, `design-text-sizes`, `design-text-weight`, `design-weight-family-switch`, `design-many-text`, `design-many-line`, `design-template`, `design-theme`, `color-picker-fill`, `color-picker-text`, `color-picker-background`, `selection-color-target`, `selection-colors-shape`, `selection-colors-many`, `selection-colors-slide`, `two-shapes-panel`, `panel-text`, `panel-shape`, `panel-picture`, `panel-icon`, `panel-connector`, `panel-frame`, `panel-pair`, `panel-slide`, `slide-chart`, `font-catalog`, `text-link`.

## Gotchas

- The panel's controls carry the trait and field names of `apps/web/src/design/trait-controls.ts`; `oldControl` and `doomControl` in `apps/web/src/doom-editor/design-controls.ts` fill them from Doom props.
- A font the browser lacks paints in the fallback face, so a font such as Georgia changes the text's font but may look the same on a machine without it.
