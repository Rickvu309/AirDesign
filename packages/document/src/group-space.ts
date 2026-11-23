import type { Box } from "./box.js"
import { throughGroup, type Place } from "./group-place.js"

export function fittedPlace(place: Place, frame: Box, fitted: Box): Place {
  return throughGroup({ box: fitted, rot: 0, flipH: false, flipV: false }, place, frame)
}
