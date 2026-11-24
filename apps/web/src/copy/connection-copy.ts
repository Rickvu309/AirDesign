export const connectionCopy = {
  end: "End",
} as const

export const connectionWords: Readonly<Record<string, string>> = {
  node: "Shape",
  site: "Site",
  "start.shape.node": "Start shape",
  "start.shape.site": "Start site",
  "end.shape.node": "End shape",
  "end.shape.site": "End site",
}
