import { useLayoutEffect } from "react"
import { Command } from "cmdk"
import { copy } from "../copy/read-copy.ts"

export type CommandMenuItem = {
  id: string
  label: string
  onSelect: () => void
}

type CommandMenuProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: readonly CommandMenuItem[]
}

export function CommandMenu({ open, onOpenChange, items }: CommandMenuProps) {
  useLayoutEffect(() => {
    if (!open) return
    const opener = document.activeElement
    return () => {
      window.setTimeout(() => {
        if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
      }, 0)
    }
  }, [open])

  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange} label={copy("shell.command")} className="ad-command">
      <Command.Input placeholder={copy("shell.command")} />
      <Command.List>
        <Command.Empty>{copy("shell.command_empty")}</Command.Empty>
        {items.map((item) => (
          <Command.Item key={item.id} value={item.label} onSelect={() => item.onSelect()}>
            {item.label}
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  )
}
