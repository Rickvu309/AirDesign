import { ConversationEmptyState } from "@/components/ai-elements/conversation"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { airaStarters, productCopy } from "@/copy/product-copy"
import { AiraTile } from "@/settings/settings-controls"

export function AiraWelcome({
  onPick,
  starters = airaStarters,
  disabled = false,
}: {
  onPick: (text: string) => void
  starters?: readonly string[]
  disabled?: boolean
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pt-3 pb-4" data-aira-welcome>
      <ConversationEmptyState
        icon={<AiraTile large />}
        title={productCopy.agentName}
        description={productCopy.agentCaution}
      />
      {starters.length === 0 ? null : (
        <Suggestions>
          {starters.slice(0, 4).map((starter) => (
            <Suggestion key={starter} suggestion={starter} onPick={onPick} disabled={disabled} />
          ))}
        </Suggestions>
      )}
    </div>
  )
}
