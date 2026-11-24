# A turned frame's words are judged where that turn paints them, and a plain cover stays quiet

`packages/doom/src/layout-findings.test.ts` turns a frame 90 degrees around an off-centre child, and around that child inside another frame, and fails unless each overlap sits where the words paint and the place they occupied before the turn stays clear. `packages/doom/src/layout-findings-cover.test.ts` stays quiet for a rect shape that covers the slide, and fails unless a triangle and a fill of opacity 0 are named off-slide.
