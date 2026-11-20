# Editor feel audit: findings 1–7

Ranked by harm to someone making a slide. Back to [the audit](README.md).

## 1. Pasting a mask group onto another slide never saves, and the deck then goes blank on reload

- **What I did:** on the scratch deck, I selected the "Mask group" (photo masked by an ellipse) in Layers, pressed Ctrl+C, then Add slide and Ctrl+V. I did the same with all layers of slide 1, which included the mask group.
- **What happened:**
  - The layers paint on the new slide, but the status stays "Saving…" for good.
  - The server gets only the `add` of the slide and no `element-clone`.
  - After that, R, Ctrl+D and slide Ctrl+D on that slide silently do nothing.
  - On reload the editor is blank (no slides, no deck name) with a page error `Error: rels`.
  - Only a fresh browser profile opens the deck again, from the server copy, and the pasted layers are lost.
  - A plain group pasted the same way saves fine ("Saved", one `element-clone`).
- **Figma:** a paste carries the copied layers to any page or file ("You can copy an object and paste in the same page, a different page, or a different file", https://help.figma.com/hc/en-us/articles/4409078832791). Masks are ordinary layers (https://help.figma.com/hc/en-us/articles/360040450253).
- **Where (guess):**
  - The paste path is `apps/web/src/editor/inserts.ts` `pasteLayers`, then `apps/web/src/layer-paste.ts` `pastedAdds`, then `packages/pptx/src/shape-paste.ts`.
  - `write()` (lines 99-105) adds the picture's relationship with `rootClose(..., "Relationships", "rels")` from `packages/pptx/src/part-markup.ts:81`. That throws `Error("rels")` when the slide's rels root is missing or self-closing, which is likely for a slide just made with Add slide.
  - The failed write is never surfaced, and the save queue stays blocked behind it.
- **Size:** medium.

![f01-mask-paste-blank-after-reload](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f01-mask-paste-blank-after-reload-92b602b638.png)

![f01-mask-paste-painted-not-saved](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f01-mask-paste-painted-not-saved-04678f8f16.png)

![f01-mask-paste-stuck-saving](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f01-mask-paste-stuck-saving-9518259e83.png)

## 2. In a long session, one slide stopped taking edits, then reload gave a blank editor and export kept failing

Seen once on the main deck; a simple repro did not bring it back.

- **What I did:**
  - Duplicated slide 2 (matrix with a group and layers pasted from slide 1) with Ctrl+D in the slide list.
  - Deleted the takeaway on the copy. Delete on the group was refused, so I ungrouped and deleted the layers.
  - Then tried to add a shape.
- **What happened:**
  - On that slide R, T, the Add text button, every Shapes item and Ctrl+D did nothing and showed no notice. The server got no `element-add` for that slide.
  - Ctrl+D on its title showed a false refusal: "Unable to duplicate this layer. It shows the slide number, and each slide has one."
  - After duplicating slide 1 and reloading, the editor stayed blank with page error `NotFoundError: A requested file or directory could not be found`, both from Home and by URL.
  - After I cleared site data the deck opened from the server, but every export (all slides and each single slide) failed with "Unable to export. Your deck is unchanged."
  - A fresh browser profile exported the same deck fine. Opening the deck again in the same tab put the original file back on the device, and export then worked.
- **Figma:** no such state. Edits always apply, and Figma never loses a file to a reload. Not documented as a behaviour.
- **Where (guess):**
  - The same family as #1: the device copy in OPFS and the save queue go out of step after a refused or failed structural edit.
  - `apps/web/src/editor/inserts.ts` `changeElement` returns `"closed"` silently when `openDeck` is not ok.
  - `apps/web/src/editor/use-export.ts` catches every export error without logging or reporting it, so the cause is invisible.
- **Size:** large (needs a failing test first).

![f02-blank-editor-after-reload](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f02-blank-editor-after-reload-92b602b638.png)

![f02-dead-slide](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f02-dead-slide-64a043ce89.png)

![f02-export-failed](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f02-export-failed-20eb4cdf55.png)

![f02-false-slide-number-refusal](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f02-false-slide-number-refusal-314f51a580.png)

## 3. Tab while typing in a plain text box jumps into another layer's text

- **What I did:** pressed T, typed "abc", pressed Tab.
- **What happened:**
  - The caret jumped into the slide title (another text layer, now contenteditable), and my next words overwrote the title.
  - In my first attempt the following letters also fired tools: O added an ellipse, and digits changed opacity.
  - Inside a bullet list, Tab indents correctly.
- **Figma:** Tab or Command ] indents a list item (https://help.figma.com/hc/en-us/articles/360040449773). Outside a list, Tab is not documented, but Figma never moves editing into a different layer.
- **Where (guess):** `packages/render/src/gestures.ts:97`. `select-next` binds Tab where `element`, and the text editor only claims Tab for lists (lines 338-345), so plain text falls through to the next sibling.
- **Size:** small.

![f03-tab-jumps-into-title](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f03-tab-jumps-into-title-d5e228f56c.png)

![f03-title-overwritten](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f03-title-overwritten-bedb17159b.png)

## 4. A new text box is a fixed, centred 384 × 65 pt box at the slide centre that never fits its text

- **What I did:** pressed T on an empty slide and typed, then raised the size to 32 pt; later typed an 8-line executive summary.
- **What happened:**
  - The box always lands at the slide centre (x 288, y 237.6), 384 × 64.8 pt, with text centred.
  - Its Autofit is "Do not Autofit", so larger or longer text spills below the frame and off the slide while the frame stays 65 pt.
  - Switching to "Resize shape to fit text" never shrinks the box: a one-line 32 pt title kept a 64.8 pt frame.
  - Every title took four extra steps: move, resize, left-align, set autofit.
- **Figma:** the Text tool arms; a click "creates a text layer ... auto width", and a drag sets "Fixed size" (https://help.figma.com/hc/en-us/articles/27378154668951). The layer is placed where you click.
- **Where (guess):**
  - The default text element behind `addText` in `apps/web/src/editor/inserts.ts:129-132`, which plans `change: "text"`.
  - Grow-only fitting in `packages/render/src/text-fit.ts` `grownBox`.
- **Size:** medium.

![f04-list-spills-off-slide](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f04-list-spills-off-slide-8bbf96470b.png)

![f04-new-text-box-centred](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f04-new-text-box-centred-820d409711.png)

![f04-resize-to-fit-no-shrink](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f04-resize-to-fit-no-shrink-e3af6c5a49.png)

![f04-text-overflows-box](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f04-text-overflows-box-6badcad7a6.png)

## 5. Delete on a group is refused

- **What I did:** selected the matrix group on a duplicated slide and pressed Delete.
- **What happened:**
  - An error toast says "Unable to delete this layer. It is a group or part of a group, and AirDesign can't delete those yet."
  - Removing it took ungroup, marquee, then Delete.
  - The toast never dismissed itself; it sat over the canvas for minutes.
- **Figma:** remove "Removes this node and all of its children from the document" (https://developers.figma.com/docs/plugins/api/properties/nodes-remove/).
- **Where (guess):** the refusal copy is in `apps/web/src/copy/element-copy.ts:11`; the refusal itself is in the element-remove planning in `packages/document`.
- **Size:** medium.

![f05-group-delete-refused](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f05-group-delete-refused-1b8087a6b7.png)

## 6. After using a panel field or picker, the keyboard stays in the panel

- **What I did:** closed the colour picker with Esc, then pressed R. Typed X, Y, W, H then pressed L. Picked a Shape type, then pressed Ctrl+D.
- **What happened:**
  - R did nothing.
  - L typed "l" into the Rotation field. Esc did not revert or leave the field, and Enter did not either.
  - Ctrl+D did nothing.
  - Only clicking the canvas gave the keys back. One click landed in Presenter notes, and R typed an "r" into the notes.
- **Figma:** not documented in the keyboard articles (https://help.figma.com/hc/en-us/articles/360040328653). Inferred from Figma's canvas, where one-key tools work right after committing a property.
- **Where (guess):** the panel field and popover focus handling in `apps/web/src/design/`, with no hand-back of focus to the canvas on Enter, Esc or popover close.
- **Size:** small to medium.

![f06-focus-left-in-panel](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f06-focus-left-in-panel-ab5100d6b9.png)

![f06-r-does-nothing-after-picker](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f06-r-does-nothing-after-picker-75ca0bad4f.png)

## 7. Leaving text editing leaves the text highlighted

- **What I did:** typed in a text box, pressed Ctrl+A, Esc, then clicked empty canvas.
- **What happened:** the text stays painted in blue selection although nothing is selected. It also stays across later actions, and once the text node stayed contenteditable. It reproduces every time.
- **Figma:** Esc exits text editing to the layer (https://help.figma.com/hc/en-us/articles/360039956434); no text highlight remains. Inferred.
- **Where (guess):** text editing exit in `packages/render`, which does not collapse `window.getSelection()` on Esc or blur.
- **Size:** small.

![f07-stale-highlight-title](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f07-stale-highlight-title-8c50ecb424.png)

![f07-stale-text-highlight](https://github.com/Rickvu309/AirDesign/releases/download/proof-4/branch-t3-editor-canvas-feel-audit-f07-stale-text-highlight-503032e978.png)
