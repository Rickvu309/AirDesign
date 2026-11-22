import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { airaChatsKeptOf, airaCopy, airaHistoryNameOf } from "@/copy/aira-copy"
import { deckTime } from "@/decks/deck-time"
import { EditorIcon } from "@/editor/editor-icons"
import { chatsKept, type SavedChat } from "@/aira/aira-history"

const noteClass = "px-1.5 py-1 text-[length:var(--type-caption)] leading-[var(--leading-dense)] text-muted-foreground"

export function AiraHistoryMenu({
  title,
  asked,
  chats,
  openId,
  now,
  disabled,
  onPick,
}: {
  title: string
  asked: string | undefined
  chats: readonly SavedChat[]
  openId: string
  now: number
  disabled: boolean
  onPick: (id: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label={asked === undefined ? title : airaHistoryNameOf(title)}
        {...(asked === undefined ? {} : { title: asked })}
        data-aira-history
        className="flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-[var(--shape-control)] pr-1.5 pl-1 text-xs text-quiet outline-hidden hover:bg-line data-popup-open:bg-line"
      >
        <EditorIcon name="history" size={13} className="shrink-0 text-faint" />
        <span className="min-w-0 truncate">{title}</span>
        <EditorIcon name="chev" size={11} className="shrink-0 text-faint" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72" data-aira-chats>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[length:var(--type-caption)] text-muted-foreground">
            {airaCopy.chatsTitle}
          </DropdownMenuLabel>
          {chats.length === 0 ? (
            <p className={noteClass}>{airaCopy.chatsEmpty}</p>
          ) : (
            <DropdownMenuRadioGroup value={openId} onValueChange={(id: string) => onPick(id)}>
              {chats.map((chat) => (
                <DropdownMenuRadioItem key={chat.id} value={chat.id} disabled={disabled} title={chat.title}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-xs text-foreground">{chat.title}</span>
                    <span className="text-[length:var(--type-caption)] text-muted-foreground">
                      {deckTime(new Date(chat.updated).toISOString(), now).row}
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <p className={noteClass}>{airaChatsKeptOf(chatsKept)}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
