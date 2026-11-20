# Editor feel audit: findings 8–15

Back to [the audit](README.md).

## 8. No table and no chart tool

- **What I did:** looked for a way to add a table or chart for slide 4. The toolbar has text, shapes, image, icon and slide number only, and New slide offers six layouts.
- **What happened:**
  - Built the bar chart by hand from five rectangles, ten text boxes and the panel H field.
  - A real chart or table slide is out of reach, and so is a data table on the matrix slide.
- **Figma:** Slides has tables ("Click Assets in the toolbar ... Select Table ... drag", https://help.figma.com/hc/en-us/articles/30600895164439). Native charts are not in Figma Slides (open forum request, https://forum.figma.com/suggest-a-feature-11/adding-simple-chart-to-figma-slides-like-powerpoint-15597).
- **Where (guess):** the toolbar inserts in `apps/web/src/editor/editor-toolbar.tsx`. `GLOSSARY` and `tables.md` say table authoring is unavailable to people and agents.
- **Size:** large.

![f08-chart-built-by-hand](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f08-chart-built-by-hand-291300e422.png)

![f08-no-table-or-chart-tool](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f08-no-table-or-chart-tool-b38182b8ca.png)

## 9. Drag-resize stops at 18 pt, so thin bars and rules cannot be drawn

- **What I did:** dragged the bottom edge of a rectangle up to make a 4 pt accent bar.
- **What happened:** it stopped at 18 pt. Every accent bar, divider and timeline tick needs W and H typed in the panel.
- **Figma:** height "Must be >= 0.01" (https://developers.figma.com/docs/plugins/api/properties/nodes-resize/).
- **Where:** `packages/render/src/box-gesture.ts:20`, `minimumSide = 228_600`.
- **Size:** small.

![f09-resize-stops-at-18pt](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f09-resize-stops-at-18pt-7b56717a58.png)

## 10. Text sits 7.2 pt inside its box, so it never lines up with shapes on the same guide

- **What I did:** snapped the title and an accent bar to the 40 pt margin.
- **What happened:**
  - The bar starts at 40 pt and the title's letters at 47.2 pt (left inset 7.2 pt, top 3.6 pt).
  - Every text and shape pair on a guide looks misaligned.
  - Snapping uses the box, so it cannot fix this.
- **Figma:** a text layer has no padding property (https://developers.figma.com/docs/plugins/api/TextNode/), so text starts at its layer edge. Inferred from the missing property.
- **Where (guess):** the new text element's `bodyPr` insets, which take the PowerPoint default, in the text planner behind `addText`. Snapping in `packages/render/src/drag-snap.ts` could also snap text to its glyph edge.
- **Size:** small (new boxes at inset 0, decided against PowerPoint compatibility).

![f10-text-inset-misaligns](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f10-text-inset-misaligns-e811bdc4d5.png)

## 11. No text inside a shape from the canvas; Enter and letters fire tools instead

- **What I did:** selected an empty matrix rectangle, pressed Enter and typed "Grow…", then tried a double-click.
- **What happened:**
  - Enter and double-click do not start typing in a shape that has no text.
  - The letters fired tools (G, R, O, W, F, N, C, T…) and littered the slide with shapes and text boxes, taking 8 undos to clean.
  - Every matrix cell, chevron and takeaway needed a separate text box placed over it.
- **Figma:** Slides has a shapes-with-text tool ("Click on a slide to place the shape", https://help.figma.com/hc/en-us/articles/30487313436183).
- **Where (guess):** `edit-text` (Enter) in `packages/render/src/gestures.ts` acts only on layers that already hold text.
- **Size:** medium.

![f11-letters-fire-tools](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f11-letters-fire-tools-2992ce1a53.png)

## 12. Line ends don't snap and Shift doesn't hold the angle

- **What I did:** added a line (L) and dragged each end to the 40 pt and 920 pt margins at y 478 for a footer rule.
- **What happened:**
  - Neither end snapped to the column edge or to the other end's height, so the rule ended 1 pt slanted.
  - With Shift held it became 5 pt slanted.
  - I fixed it by typing X, Y, W and H = 0.
- **Figma:** snapping applies "when resizing an object, moving layers, or moving vector points" (https://help.figma.com/hc/en-us/articles/360039956914). Shift-to-45° on a line end is not documented.
- **Where (guess):** the line end drag in `packages/render/src/connector-drag.ts` and `connector-ends.tsx` does not run `resize-snap`/`drag-snap`.
- **Size:** small to medium.

![f12-line-ends-slanted](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f12-line-ends-slanted-d05220f896.png)

## 13. New layers land under layers pasted from another slide

- **What I did:** pasted the title and accent bar onto slide 2, then added rectangles and text (R, T).
- **What happened:**
  - Every new layer went below the pasted ones; the Layers panel lists the pasted bar and title on top.
  - A grouped matrix sat under them, and a later R landed between them.
  - Overlaps would hide new work.
- **Figma:** a new child goes "to the end of the children array. That is, visually on top of all other children" (https://developers.figma.com/docs/plugins/api/properties/nodes-appendchild/).
- **Where (guess):** where `element-add` inserts in `packages/document/src/element-order.ts`, relative to cloned shapes.
- **Size:** small.

![f13-new-layer-under-pasted](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f13-new-layer-under-pasted-68cf2a248a.png)

## 14. After editing an imported title, the canvas and the exported file show different text

- **What I did:** retyped the DOE slide 4 title (40 pt, `normAutofit`) to a longer bold line, then exported.
- **What happened:**
  - AirDesign narrows the lines to fit, and the two lines touch: the descenders of line 1 meet the ascenders of line 2.
  - The export writes `<a:normAutofit/>` with no `fontScale` or `lnSpcReduction`, and LibreOffice renders full line spacing.
  - What you see is not what the file shows.
- **Figma:** not applicable. PowerPoint stores the fit in `normAutofit@fontScale` and `@lnSpcReduction` (ECMA-376 21.1.2.1.3). AGENTS.md rule 1.
- **Where (guess):** the paint-time fit in `packages/render/src/text-fit.ts` is not carried into the `bodyPr` writer in `packages/pptx`.
- **Size:** medium.

![f14-autofit-canvas](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f14-autofit-canvas-25830037d6.png)

![f14-autofit-export-render](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f14-autofit-export-render-c2a31f8fbe.png)

## 15. Layer names don't say what a layer is

- **What I did:** read the Layers panel while building.
- **What happened:**
  - Text layers are "Shape 2" and "Shape 21". All four matrix labels are "Shape 15" and all four cells "Rectangle 4", because copies keep the source name.
  - A line is "Straight Connector 5".
  - The panel heading says "Square" for the layer named "Rectangle 4".
  - Picking the right row in Layers, needed for masks and deep edits, is guesswork.
- **Figma:** a text layer's "name will update automatically by default based on the characters property" (https://developers.figma.com/docs/plugins/api/properties/nodes-name). Copies keep the name unless it ends in a number (forum, staff).
- **Where (guess):** `plainNames` in the Layers panel, and the `identity.name` of new elements.
- **Size:** small.

![f15-layer-names](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f15-layer-names-83031516d7.png)
