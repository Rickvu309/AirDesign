export const connectionCopy = {
  section: "Connector",
  start: "Start",
  end: "End",
  site: "Site",
  sites: { top: "Top", middle: "Middle", bottom: "Bottom", left: "Left", center: "Center", right: "Right" },
  point: (number: number) => `Point ${number}`,
} as const

export const connectionWords: Readonly<Record<string, string>> = {
  node: "Attached to",
  site: connectionCopy.site,
}
