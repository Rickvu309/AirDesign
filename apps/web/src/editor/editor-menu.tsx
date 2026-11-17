import type { ComponentProps, ReactNode } from "react"
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { EditorIcon, type EditorIconName } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"

const menuRow =
  "h-8 gap-2.5 rounded-md py-0 pr-2.5 pl-2 text-[length:var(--type-dense)] text-white focus:bg-quiet focus:text-white focus:**:text-white"

export function EditorMenuContent({
  children,
  className,
  ...place
}: { children: ReactNode; className?: string } & Pick<
  ComponentProps<typeof DropdownMenuContent>,
  "side" | "align" | "sideOffset" | "alignOffset" | "anchor" | "finalFocus"
>) {
  return (
    <DropdownMenuContent
      className={cn(
        "flex w-[188px] min-w-0 flex-col rounded-xl bg-foreground p-1.5 text-white shadow-[0px_8px_24px_var(--black-20)] ring-0 duration-0",
        className,
      )}
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
  keys,
}: {
  value: string
  label: string
  checked: boolean
  icon?: EditorIconName
  shortcut?: string
  keys?: string
}) {
  return (
    <DropdownMenuRadioItem
      value={value}
      closeOnClick
      {...(keys === undefined ? {} : { "aria-keyshortcuts": keys })}
      className={cn(menuRow, "[&>[data-slot=dropdown-menu-radio-item-indicator]]:hidden")}
    >
      <span className="flex size-4 items-center justify-center">
        {checked ? <EditorIcon name="check" size={14} className="size-3.5" /> : null}
      </span>
      {icon === undefined ? null : <EditorIcon name={icon} size={16} />}
      <span className="flex-1">{label}</span>
      {shortcut === undefined ? null : (
        <span aria-hidden={keys !== undefined} className="text-xs text-[var(--shortcut)]">
          {shortcut}
        </span>
      )}
    </DropdownMenuRadioItem>
  )
}

export function EditorMenuAction({
  label,
  shortcut,
  keys,
  onClick,
}: {
  label: string
  shortcut: string
  keys: string
  onClick: () => void
}) {
  return (
    <DropdownMenuItem aria-keyshortcuts={keys} className={menuRow} onClick={onClick}>
      <span className="size-4" />
      <span className="flex-1">{label}</span>
      <span aria-hidden="true" className="text-xs text-[var(--shortcut)]">
        {shortcut}
      </span>
    </DropdownMenuItem>
  )
}

export function EditorMenuRule() {
  return <DropdownMenuSeparator className="-mx-1.5 my-1.5 h-px bg-quiet/60" />
}
