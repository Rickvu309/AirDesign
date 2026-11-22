import { coreDoom } from "@/core/core-doom"
import { CoreSlide } from "@/core/core-slide"

export const screens = Object.fromEntries(
  Object.entries(coreDoom).map(([route, grown]) => [route, () => <CoreSlide grown={grown} />]),
)
