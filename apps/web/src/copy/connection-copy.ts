export const connectionCopy = {
  section: "Connector",
  start: "Start",
  end: "End",
  sites: { top: "Top", middle: "Middle", bottom: "Bottom", left: "Left", center: "Center", right: "Right" },
  point: (number: number) => `Point ${number}`,
} as const

export const connectionWords: Readonly<Record<string, string>> = {
  node: "Shape",
  site: "Site",
  "start.shape.node": "Start shape",
  "start.shape.site": "Start site",
  "end.shape.node": "End shape",
  "end.shape.site": "End site",
}
