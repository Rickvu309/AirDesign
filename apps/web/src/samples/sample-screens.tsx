import { sampleSlides } from "@/samples/sample-slides"
import { SlideScreen } from "@/samples/slide-screen"

export const screens = Object.fromEntries(
  Object.entries(sampleSlides).map(([route, grown]) => [route, () => <SlideScreen grown={grown} />]),
)
