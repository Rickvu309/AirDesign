# An Enter check in apps/web returns early on `composing(event)` first, so an IME commits its text instead of running the action

lint: `no-enter-while-composing`; unit: `apps/web/src/doom-editor/actions-popover.test.tsx`; browser: `doom-editor-tools.spec.ts`
