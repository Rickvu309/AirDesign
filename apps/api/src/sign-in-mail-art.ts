export type MailColors = {
  readonly page: string
  readonly card: string
  readonly edge: string
  readonly text: string
  readonly quiet: string
  readonly codeFill: string
  readonly codeEdge: string
  readonly button: string
  readonly buttonText: string
  readonly link: string
}

export const mailLight: MailColors = {
  page: "#f5f5f2",
  card: "#ffffff",
  edge: "#eaeae7",
  text: "#222222",
  quiet: "#666666",
  codeFill: "#f5f5f2",
  codeEdge: "#d7d7d6",
  button: "#2d6fcd",
  buttonText: "#ffffff",
  link: "#2d6fcd",
}

export const mailDark: MailColors = {
  page: "#181818",
  card: "#222222",
  edge: "#5b5b5b",
  text: "#f5f5f2",
  quiet: "#909090",
  codeFill: "#181818",
  codeEdge: "#5b5b5b",
  button: "#2d6fcd",
  buttonText: "#ffffff",
  link: "#93b8ef",
}

export const mailRadius = { card: 14, code: 11, button: 8 } as const
