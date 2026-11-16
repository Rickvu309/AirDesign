import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { productCopy } from "@/copy/product-copy"

const itemClass = "h-8 gap-2 rounded-md px-2 text-[length:var(--type-dense)] leading-[17px] text-foreground"

export type NewDeckActions = { onImport?: () => void; onBlank?: () => void; open?: boolean }

export function NewDeckMenu({ onImport, onBlank, open = false }: NewDeckActions) {
  return (
    <DropdownMenu modal={false} defaultOpen={open}>
      <DropdownMenuTrigger render={<Button variant="default" className="h-9 gap-2 px-3.5" type="button" />}>
        <svg width="14" height="14" viewBox="0 0 14 14" className="size-3.5" aria-hidden="true">
          <path
            d="M7 2.92 V11.08 M2.92 7 H11.08"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.28"
            strokeLinecap="round"
          />
        </svg>
        New deck
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4.5}
        aria-label="New deck"
        className="w-[180px] rounded-[var(--shape-card)] bg-background shadow-[inset_0_0_0_1px_var(--sheet),0_12px_32px_rgb(0_0_0/12%)] ring-0"
      >
        <DropdownMenuItem onClick={onBlank} className={itemClass}>
          <svg width="13" height="14" viewBox="8 9 13 14" aria-hidden="true">
            <path
              d="M16.69,9.16 L20.83,12.93 C20.95,13.04 21,13.17 21,13.31 L21,21.92 C21,22.52 20.47,23 19.82,23 L9.18,23 C8.53,23 8,22.52 8,21.92 L8,10.08 C8,9.48 8.53,9 9.18,9 L16.28,9 C16.43,9 16.57,9.05 16.69,9.16 Z M16.86,10.84 L18.98,12.77 L16.86,12.77 L16.86,10.84 Z M19.82,21.92 L9.18,21.92 L9.18,10.08 L15.68,10.08 L15.68,13.31 C15.68,13.61 15.95,13.85 16.28,13.85 L19.82,13.85 L19.82,21.92 Z"
              fill="var(--muted-foreground)"
            />
          </svg>
          {productCopy.blankDeck}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onImport} className={itemClass}>
          <svg width="14" height="14" viewBox="8 9 14 14" aria-hidden="true">
            <path
              d="M22,17.76 L22,22.42 C22,22.74 21.73,23 21.41,23 L8.59,23 C8.27,23 8,22.74 8,22.42 L8,17.76 C8,17.44 8.27,17.17 8.59,17.17 C8.91,17.17 9.16,17.44 9.16,17.76 L9.16,21.84 L20.84,21.84 L20.84,17.76 C20.84,17.44 21.09,17.17 21.41,17.17 C21.73,17.17 22,17.44 22,17.76 Z"
              fill="var(--muted-foreground)"
            />
            <path
              d="M14.41,11 L12.5,12.92 C12.27,13.15 11.91,13.15 11.68,12.92 C11.45,12.69 11.45,12.32 11.68,12.09 L14.59,9.18 C14.7,9.07 14.84,9 15,9 C15.16,9 15.3,9.07 15.41,9.18 L18.33,12.09 C18.56,12.32 18.56,12.69 18.33,12.92 C18.1,13.15 17.73,13.15 17.5,12.92 L15.59,11 L15.59,17.76 C15.59,18.08 15.32,18.34 15,18.34 C14.68,18.34 14.41,18.08 14.41,17.76 L14.41,11 Z"
              fill="var(--muted-foreground)"
            />
          </svg>
          {productCopy.importPowerPoint}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
