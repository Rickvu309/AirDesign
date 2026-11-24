# An Enter or Escape check in apps/web returns early on `composing(event)` first, so an IME commits its text or cancels its conversion instead of the app acting

lint: `no-key-while-composing`; unit: `apps/web/src/editor/actions-popover.test.tsx`, `apps/web/src/editor/editor-key-ownership.test.tsx`, `apps/web/src/editor/zoom-menu.test.tsx`; browser: `doom-editor-tools.spec.ts`, `doom-editor-text.spec.ts`, `home-doom.spec.ts`
