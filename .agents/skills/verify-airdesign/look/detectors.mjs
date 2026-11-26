import { deadControl } from "./detectors/dead-control.mjs"
import { emptyRegion } from "./detectors/empty-region.mjs"
import { focusVisible } from "./detectors/focus-visible.mjs"
import { internalIdentifier } from "./detectors/internal-identifier.mjs"
import { invisibleControl } from "./detectors/invisible-control.mjs"
import { offToken } from "./detectors/off-token.mjs"
import { overflowingText } from "./detectors/overflowing-text.mjs"
import { stackedFrames } from "./detectors/stacked-frames.mjs"
import { strayFocusEdge } from "./detectors/stray-focus-edge.mjs"
import { textContrast } from "./detectors/text-contrast.mjs"
import { truncatedText } from "./detectors/truncated-text.mjs"

export const silence = "an entry in look/allow.json with page, detector, selector and reason"

export const detectors = [
  overflowingText,
  invisibleControl,
  internalIdentifier,
  emptyRegion,
  truncatedText,
  stackedFrames,
  textContrast,
  focusVisible,
  strayFocusEdge,
  deadControl,
  { ...offToken, optIn: "--off-token" },
]
