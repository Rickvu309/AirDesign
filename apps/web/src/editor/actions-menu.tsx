import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { floatShadow } from "@/editor/editor-chrome"
import { EditorIcon } from "@/editor/editor-icons"
import { ActionGlyph } from "@/editor/tool-panels"
import { cn } from "@/lib/class-names"

type Action = { readonly icon: "chart" | "table" | "icon" | "rmbg" | "hd"; readonly label: string }

const groups: readonly { readonly label: string; readonly actions: readonly Action[] }[] = [
  {
    label: "Insert",
    actions: [
      { icon: "chart", label: "Chart" },
      { icon: "table", label: "Table" },
      { icon: "icon", label: "Icon" },
    ],
  },
  {
    label: "Image",
    actions: [
      { icon: "rmbg", label: "Remove background" },
      { icon: "hd", label: "Boost resolution" },
    ],
  },
]

export function ActionsTool({ onTable }: { onTable: () => void }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Actions"
            className="size-9 rounded-lg text-quiet hover:bg-transparent active:translate-y-0"
          />
        }
      >
        <EditorIcon name="actions" size={18} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={12}
        className={cn("flex w-60 flex-col gap-1 rounded-xl bg-white p-2 ring-0 duration-0", floatShadow)}
      >
        {groups.map((group) => (
          <DropdownMenuGroup key={group.label}>
            <DropdownMenuLabel className="pt-1 pl-2 text-xs font-normal text-faint">{group.label}</DropdownMenuLabel>
            {group.actions.map((action) => (
              <DropdownMenuItem
                key={action.label}
                disabled={action.icon !== "table"}
                {...(action.icon === "table" ? { onClick: onTable } : {})}
                className="h-9 gap-2.5 rounded-lg px-2 text-[length:var(--type-dense)] text-foreground"
              >
                <ActionGlyph name={action.icon} />
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
