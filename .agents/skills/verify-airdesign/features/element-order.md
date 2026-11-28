# Bring an element forward or send it backward

On an open deck the bracket keys change where the selected layers sit in their parent's stack, as in Figma: `]` brings them to the front and `[` sends them to the back, Ctrl/Cmd+] brings them forward one place and Ctrl/Cmd+[ sends them back one place. The slide paints the new order at once, the server keeps it, and one undo takes it back.

## Sub-features

- `element-order` `]`, Ctrl/Cmd+Shift+] and Cmd+Option+] bring to the front; `[`, Ctrl/Cmd+Shift+[ and Cmd+Option+[ send to the back; Ctrl/Cmd+] and Ctrl/Cmd+[ step one place (the `arrange` rows of `gestures` in `apps/web/src/lib/gestures.ts`). Each writes the moved layers' `parent` with a new order key `at` between their new neighbours (`reorderWrites` in `packages/doom/src/intent-reorder.ts`, the writes Doom's reorder intent makes). A layer already at that end writes nothing.
- `siblings` a layer moves only among the layers that share its parent; a layer inside a group or frame is not pulled out of it.
- `agent-order` in `airdesign_execute`, `move({ target, after })` or `move({ targets, after })` places layers after a sibling. Pass `after: null` to move them to the start of the stack.

## How to get to it (user POV)

- An open deck `/s/<id>`: select a layer, then the bracket keys.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Browser tests.** `pnpm test:browser tests/browser/editor-arrange.spec.ts` presses `]`, `[`, Ctrl+] twice and Ctrl+[ on one of three boxes and reads each order key from `doomRoutes.open`. `tests/browser/editor-arrange-keys.spec.ts` steps a layer with Ctrl+] and Ctrl+[ and sends it to the front and the back with `]` and `[`.
- **State for look.** `element-ordered` (the back card brought in front of the badge).

## Gotchas

- Cmd+Shift+[ and Cmd+Shift+] switch tabs in macOS browsers; bare `[` and `]`, or Cmd+Option+[ and Cmd+Option+], avoid that clash.
- While a text is being edited, Ctrl/Cmd+] and Ctrl/Cmd+[ indent and outdent a list instead.
