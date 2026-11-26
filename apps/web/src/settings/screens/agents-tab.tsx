import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { connectAgentCopy } from "@/copy/connect-agent-copy"
import { productCopy } from "@/copy/product-copy"
import { DeckGlyph } from "@/decks/deck-glyph"
import { AgentTile } from "@/settings/agent-tile"
import { ModuleRow } from "@/settings/module-row"
import { SettingsFrame } from "@/settings/settings-frame"
import { settingsCopy } from "@/settings/settings-sample"

const settingsAction =
  "h-[var(--space-32)] border-0 bg-background px-3.5 text-[length:var(--type-dense)] leading-[17px] shadow-[inset_0_0_0_1px_var(--field-edge)] hover:bg-background"

export function AgentsTab() {
  const disconnect = (
    <Button type="button" variant="outline" className={settingsAction}>
      {productCopy.disconnect}
    </Button>
  )
  return (
    <SettingsFrame tab="agents">
      <Card
        title={settingsCopy.agents}
        description={settingsCopy.agentsBody}
        actions={
          <Button type="button" variant="signature" className="gap-1.5 px-3.5">
            <DeckGlyph name="plug" size={14} />
            {connectAgentCopy.title}
          </Button>
        }
      >
        <div className="flex flex-col">
          <ModuleRow title={settingsCopy.claude} mark={<AgentTile name="claude" />} action={disconnect} />
          <ModuleRow title={settingsCopy.codex} mark={<AgentTile name="codex" />} action={disconnect} />
        </div>
      </Card>
    </SettingsFrame>
  )
}
