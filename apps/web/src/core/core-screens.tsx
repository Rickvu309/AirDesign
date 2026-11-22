import { coreScenes } from "@/core/core-scenes"
import { CoreSlide } from "@/core/core-slide"

export const screens = Object.fromEntries(
  Object.entries(coreScenes).map(([route, grown]) => [route, () => <CoreSlide grown={grown} />]),
)
