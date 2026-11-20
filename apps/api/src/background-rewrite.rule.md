# No stored register holds PR 478's `slide: "background"` command, and none of its colours is lost

`apps/api/src/background-rewrite.test.ts` turns that shape into fill rows and drops `deck.background_backup`. `packages/live/src/cache.slide.test.ts` shows it as a fill. `packages/catalog/src/slide-wire.test.ts` refuses it on commit
