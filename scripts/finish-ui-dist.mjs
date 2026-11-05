import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const css = readFileSync("packages/ui/src/tokens/tokens.css", "utf8").replaceAll("../../fonts/", "../fonts/")
const copyKit = JSON.parse(readFileSync("packages/ui/src/copy/copy-kit.json", "utf8"))
const keys = Object.entries(copyKit).filter((entry) => typeof entry[1] === "string").map((entry) => entry[0])
mkdirSync("packages/ui/dist/copy", { recursive: true })
writeFileSync("packages/ui/dist/tokens.css", css)
writeFileSync("packages/ui/dist/copy/copy-kit.json", `${JSON.stringify(copyKit, null, 2)}\n`)
writeFileSync("packages/ui/dist/index.d.ts", declaration(keys))

function declaration(copyKeys) {
  const union = copyKeys.map((key) => JSON.stringify(key)).join(" | ")
  return `import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactElement } from "react"

export type ButtonVariant = "primary" | "secondary" | "danger" | "link"
export type ButtonSize = "dialog" | "settings" | "compact" | "sign-in"
export function Button(props: { variant: ButtonVariant; size: ButtonSize } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">): ReactElement

export function CodeEntry(props: { label: string; value: string; onValueChange: (value: string) => void; error?: string }): ReactElement

export type CommandMenuItem = { id: string; label: string; onSelect: () => void }
export function CommandMenu(props: { open: boolean; onOpenChange: (open: boolean) => void; items: readonly CommandMenuItem[] }): ReactElement

export type CopyKey = ${union}
export function copy(key: CopyKey): string
export function fillCopy(key: CopyKey, slots: Readonly<Record<string, string>>): string

export function AlertDialog(props: {
  open: boolean
  title: string
  body: string
  onClose: () => void
  primary?: { label: string; onClick: () => void; danger?: boolean }
  secondary?: { label: string }
}): ReactElement | null

export function TextField(props: { label: string; error?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id" | "aria-invalid" | "aria-describedby">): ReactElement

export function Toaster(): ReactElement
export function toast(message: string): void

export type ToolbarItem = { id: string; label: string; onSelect: () => void }
export function Toolbar(props: { label: string; items: readonly ToolbarItem[] }): ReactElement
`
}
