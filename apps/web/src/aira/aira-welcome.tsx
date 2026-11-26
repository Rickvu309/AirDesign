import { ConversationEmptyState } from "@/components/ai-elements/conversation"
import { airaCopy } from "@/copy/aira-copy"
import { productCopy } from "@/copy/product-copy"
import { AiraTile } from "@/components/ui/aira-tile"

export function AiraWelcome({ notOffered = false }: { notOffered?: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pt-3 pb-4" data-aira-welcome>
      <ConversationEmptyState
        icon={<AiraTile large />}
        title={productCopy.agentName}
        description={notOffered ? `${airaCopy.notOffered} ${airaCopy.notOfferedBody}` : airaCopy.welcome}
      />
    </div>
  )
}
