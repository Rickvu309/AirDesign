export const connectionCopy = {
  section: "Connector",
  start: "Start",
  end: "End",
} as const

export const connectionWords: Readonly<Record<string, string>> = {
  node: "Attached to",
  site: "Site",
}
