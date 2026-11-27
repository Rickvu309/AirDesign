# A chart or an icon lands in the content area, and keeps a readable size when that area is too small

`apps/web/src/editor/create-intents.test.ts` places both at a 0%, 50%, 85% and 95% fill, and under a block that covers the top 85%.

The chart fills the content area when that area is at least 280 by 240: the slide margins and the title's left edge. The icon is 120 by 120 and is centred in that area. Neither one shrinks below that size.

When the content area is smaller, or there is none, the insert keeps that size and lands on top of what is there. One selected layer puts it one gap down and right from that layer's top left, clamped onto the slide. No selection puts it at the slide centre. It does not grow to cover the slide.
