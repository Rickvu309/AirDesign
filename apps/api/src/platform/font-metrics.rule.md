# The server measures a served face's advances and pair kerning the way Chromium's canvas does, so its layout findings break lines where the canvas paints them

`apps/api/src/platform/font-metrics.test.ts` reads Liberation Sans Narrow through `FontMetrics` and fails when a line's width or a kerning pair drifts from the widths Chromium's canvas measured for the same file
