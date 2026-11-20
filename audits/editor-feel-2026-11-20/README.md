# Editor feel audit, 2026-11-20: five consulting slides built end to end

Date: 2026-11-20. Code: `origin/main` at d9ccc7b90. Worktree `t3/editor-canvas-feel-audit` (no product code changed).

What I did: on a private verify stack (apps/web + apps/api, run `2026-11-20T11-26-08-080Z-031bfe`, started by me, stopped by me, `left: []`), I built five consulting slides from a blank deck using only the canvas, panels and keyboard:

- a title slide;
- an action title with a 2x2 matrix;
- a four-step chevron flow;
- a bar chart with a takeaway box and source line;
- an executive summary with three bullet levels.

I used layout guides (12 columns), ruler guides, snapping, Alt-drag, Ctrl+D, align keys, group and ungroup, masking a photo, weights, list levels, line height, copy and paste between slides, reordering in the Layers panel, zoom and pan, undo, and export. Then I imported `scripts/pptx-fixtures/doe-heat-pumps.pptx` (41 slides), edited slide 4 and exported it. Every export was checked with Microsoft's validator (`scripts/pptx-judge`), `scripts/deck-diff.mjs`, and a LibreOffice render beside the AirDesign paint.

Test decks (all lived on that stack, which is now stopped and its database removed):

- main deck `9afdba7f-7392-4ca8-b68b-a062b51464e2`;
- scratch deck `5d1976cb-ecc4-489d-8e07-0451eff6381e`;
- imported DOE deck `d001f30c-c34b-4d0a-8143-0fb20148b4dd`.

Screenshots are on the `proof` release and shown inline below; the raw notes, exports and renders stayed on the audit machine.

Figma sources are the coordinator spec files (`figma-canvas-spec-*.md`) plus help.figma.com and Figma plugin API pages found for this audit; each finding names its URL.

## What already feels right

- **Drag speed:** every drag, resize, Space-pan and Ctrl+wheel zoom held a 16.7 ms p95 frame, also on the busy imported slide. Zoom stayed under the cursor (drift under 1 px).
- **Snapping:**
  - snaps to layout-guide columns, ruler guides, slide margins and other layers, with Figma-red guides and × marks;
  - edge resize snapped to the 920 pt margin, with an "880 × 65" size label;
  - multi-select resize snapped to the margin.
- **Duplicate:** Alt-drag copies, and Ctrl+D repeats the offset (four chevrons and five bars in a few keys).
- **Arrange:**
  - Alt+S aligned bar bottoms;
  - Ctrl+G and Ctrl+Shift+G group and ungroup;
  - Ctrl+click deep-selects and Esc goes to the parent;
  - Shift+arrow nudges several layers;
  - dragging in the Layers panel reorders, with a blue line;
  - Ctrl+] moves a slide.
- **Text:** weight keys (Ctrl+Alt+Shift+>/<), size keys, Ctrl+Shift+8 lists with Tab and Shift+Tab levels, and line height in %.
- **Mask:** Ctrl+Alt+M on photo + ellipse gives a "Mask group" with one undo. It exports as a native picture with the ellipse geometry, and LibreOffice renders it identically.
- **Undo:** labels were exact every time ("Undo resize", "Undo move", "Undo use as mask", "Undo layer order"). Undoing 8 stray steps restored the slide exactly.
- **Import and export of a real deck:**
  - 41 slides opened in 5.4 s;
  - after editing slide 4, `deck-diff` shows 1 changed part and 316 byte-identical;
  - the validator shows the same 2 pre-existing diagram errors as the original and no new ones.
- **Export of the built deck:** validator 0 errors, untouched parts byte-identical, and all five LibreOffice renders match the canvas by eye.

![smart guides during an Alt-drag](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-ok-smart-guides-46498c8aff.png)

![masked photo](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-ok-mask-50870f2803.png)

## The five slides built, canvas beside export

Left: AirDesign's canvas. Right: the exported file rendered by LibreOffice.

| Canvas                                                                                                                                                         | Export                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![built-slide1-canvas](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-built-slide1-canvas-02c491b1ad.png) | ![built-slide1-export](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-built-slide1-export-424a05f19b.png) |
| ![built-slide2-canvas](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-built-slide2-canvas-f1b7664250.png) | ![built-slide2-export](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-built-slide2-export-d343df931b.png) |
| ![built-slide3-canvas](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-built-slide3-canvas-24ec2da37d.png) | ![built-slide3-export](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-built-slide3-export-03c3e0e6cf.png) |
| ![built-slide4-canvas](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-built-slide4-canvas-1737db13b7.png) | ![built-slide4-export](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-built-slide4-export-692ed5b0aa.png) |
| ![built-slide5-canvas](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-built-slide5-canvas-b6fdb91ef8.png) | ![built-slide5-export](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-built-slide5-export-9971046e85.png) |

## Findings

- [Findings 1–7](findings-1-7.md): saving and device copy, Tab, text box defaults, group delete, panel focus, text highlight.
- [Findings 8–15](findings-8-15.md): tables and charts, minimum size, text inset, text in shapes, line ends, stacking, autofit export, layer names.
- The rest are below.

## The rest

**Workflow and keys**

- Ctrl+D, then Enter, started editing the source layer rather than the new copy, so step 3's text overwrote step 2. Seen once with list text; with one-line labels it worked.
  ![r-ctrl-d-enter-edits-source](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-r-ctrl-d-enter-edits-source-ace3e77ac3.png)
- Undo on slide 1 undid a delete on slide 4, and the view stayed on slide 1, so the change was invisible. Figma: not documented; PowerPoint and Google Slides jump to the slide.
- Ctrl+Alt+L was ignored once, right after Esc from a new text box; it worked after a click. (footnote still centred).
- The context menu on a shape has no Copy, Paste, Duplicate, Delete, Hide or Lock, and shows Ungroup on a plain rectangle.
  ![r-context-menu](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-r-context-menu-b7586bdb14.png)
- Layout guides are per slide with no way to reuse them: a 12-column guide costs 6 actions on every new slide, unless the slide is made by duplicating.
  ![r-ruler-stale-label](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-r-ruler-stale-label-b6c05681f4.png)

**Panel**

- X, Y, W and H sit in a collapsed "Position and size" section at the bottom of the panel. Figma keeps them "at the top of the Design panel" (https://help.figma.com/hc/en-us/articles/360039956914).
- The fill row cannot take a typed hex. A grey takes fill row, then Add color, then a tint: 3 clicks. Figma: "enter the code in the Fill field" (https://help.figma.com/hc/en-us/articles/13543867954711).
  ![r-grey-takes-three-clicks](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-r-grey-takes-three-clicks-619dca2356.png)
- While editing with text selected, the panel's Size stayed at 32 while the toolbar said 18.
  ![r-panel-size-stale](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-r-panel-size-stale-b169cabd3d.png)
- Geometry typed into the panel for a list text box repaints 150–330 ms after the last Tab (measured); a single width change takes 44–78 ms.
- On reopen the panel goes back to Agent, design mode off and rulers off.

**Canvas and look**

- The ruler keeps a stale label from a layer on another slide (480 on slide 2). Labels pile on top of each other (40/44, 480/482, 321.6/317.5). A selected group writes every child's edges as numbers. Figma highlights the selection's coordinates (https://help.figma.com/hc/en-us/articles/360040449713).
  ![r-ruler-stale-label](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-r-ruler-stale-label-b6c05681f4.png)
  ![r-ruler-numbers-pile](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-r-ruler-numbers-pile-8bb926530b.png)
- Error toasts don't time out: "Unable to delete" and "Unable to make that change" stayed over the canvas for minutes.
- Default shape style: blue fill with a 1 pt dark border (every MBB shape needs Shift+/). A line is blue and 2.3 pt; 0.75 typed shows "0.8", though the file correctly holds 9525 EMU.
- R places the new shape at a fractional, slide-dependent spot ((426, 307.6) on one slide, (426, 267.6) on another), not at the slide centre or the pointer.
- Bullets in a new text box hang about 22 pt at 12 pt text, level 2 about 34 pt (PowerPoint text-box defaults), and look loose for MBB.
  ![r-bullet-indents](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-r-bullet-indents-ea3dab6158.png)
- A 4 pt bar's corner handles cover its ends, so it can only be grabbed in the middle.
- Multi-select resize leaves fractional sizes (213.27 pt widths). Figma rounds to the pixel grid by default.
- The layout guide popover's focus ring wraps only the number ("40"), not the field.

**Export checks**

- LibreOffice draws the footer line (a connector with `lnRef idx=1` and accent1) black, while AirDesign paints it blue. The XML and theme are right, so this is a limit of the reference renderer, not an export loss. Still, the paint-fidelity reference will flag it.
- `slide-diff` of my element screenshots against LibreOffice scored 0.87–0.95. The heatmaps show a 1–3 px crop offset and glyph-edge differences only, not missing or moved layers, so this is not a loss. … `heat5.png`.

**Withdrawn**

- "More shapes adds nothing": every attempt had been on the dead slide of #2. On a healthy slide, More shapes → Chevron adds a chevron ().
  ![r-more-shapes-works](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-r-more-shapes-works-cc5fed4bfe.png)

## Steps that take more actions than in Figma

| Task                        | Figma                                     | AirDesign today                                        |
| --------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| Place a title               | T, click                                  | T, drag to place, drag to resize, Ctrl+Alt+L, Autofit  |
| Grey text                   | Click the hex, type it                    | Fill row, Add color, tint                              |
| Thin accent bar             | R, drag                                   | R, Shift+/, open Position and size, type X, Y, W and H |
| Delete a group              | Select, Delete                            | Select, Ctrl+Shift+G, marquee, Delete                  |
| Label a shape               | Shape-with-text tool, type                | T, type, style, place over the shape, size it          |
| Layout guide on a new slide | Comes with a duplicated slide (same here) | 6 actions on a slide made with Add slide               |
