import { ConversationEmptyState } from "@/components/ai-elements/conversation"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { airaCopy } from "@/copy/aira-copy"
import { productCopy } from "@/copy/product-copy"
import { AiraTile } from "@/settings/settings-controls"

export function AiraWelcome({
  onPick,
  starters,
  disabled = false,
  notOffered = false,
}: {
  onPick: (text: string) => void
  starters: readonly string[]
  disabled?: boolean
  notOffered?: boolean
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pt-3 pb-4" data-aira-welcome>
      <ConversationEmptyState
        icon={<AiraTile large />}
        title={productCopy.agentName}
        description={notOffered ? airaCopy.notOffered : airaCopy.welcome}
      />
      {starters.length === 0 || notOffered ? null : (
        <Suggestions>
          {starters.slice(0, 4).map((starter) => (
            <Suggestion key={starter} suggestion={starter} onPick={onPick} disabled={disabled} />
          ))}
        </Suggestions>
      )}
      {notOffered ? null : (
        <p className="px-3 text-center text-[length:var(--type-caption)] leading-[var(--leading-dense)] text-pretty text-muted-foreground">
          {airaCopy.caution}
        </p>
      )}
    </div>
  )
}
