export const templatePickerCopy = {
  fromTemplate: "From a template",
  chooseTemplate: "Choose a template",
  startFromScratch: "Start from scratch",
  addAllSlides: "Add all slides",
  backToTemplates: "Back to templates",
  close: "Close",
  slideCount: (count: number) => (count === 1 ? "1 slide" : `${String(count)} slides`),
  startWithSlide: (number: number, name: string) => `Start with slide ${String(number)} of ${name}`,
  templateSlides: (name: string) => `${name} slides`,
}
