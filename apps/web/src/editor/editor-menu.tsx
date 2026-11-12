import type { ComponentProps, ReactNode } from "react"
import { DropdownMenuContent, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu"
import { EditorIcon, type EditorIconName } from "@/editor/editor-icons"

export function EditorMenuContent({
  children,
  ...place
}: { children: ReactNode } & Pick<
  ComponentProps<typeof DropdownMenuContent>,
  "side" | "align" | "sideOffset" | "alignOffset"
>) {
  return (
    <DropdownMenuContent
      className="flex w-[188px] min-w-0 flex-col rounded-xl bg-foreground p-1.5 text-white shadow-[0px_8px_24px_var(--black-20)] ring-0 duration-0"
      {...place}
    >
      {children}
    </DropdownMenuContent>
  )
}

export function EditorMenuRow({
  value,
  label,
  checked,
  icon,
  shortcut,
}: {
  value: string
  label: string
  checked: boolean
  icon?: EditorIconName
  shortcut?: string
}) {
  return (
    <DropdownMenuRadioItem
      value={value}
      closeOnClick
      className="h-8 gap-2.5 rounded-md py-0 pr-2.5 pl-2 text-[length:var(--type-dense)] text-white focus:bg-quiet focus:text-white focus:**:text-white [&>[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
    >
      <span className="flex size-4 items-center justify-center">
        {checked ? <EditorIcon name="check" size={14} className="size-3.5" /> : null}
      </span>
      {icon === undefined ? null : <EditorIcon name={icon} size={16} />}
      <span className="flex-1">{label}</span>
      {shortcut === undefined ? null : <span className="text-xs text-[var(--shortcut)]">{shortcut}</span>}
    </DropdownMenuRadioItem>
  )
}
