import { ModuleCard } from "@/settings/module-card"
import { ModuleRow } from "@/settings/module-row"
import { AgentTile, AiraTile, SettingsButton, SettingsToggle } from "@/settings/settings-controls"
import { SettingsFrame } from "@/settings/settings-frame"
import { settingsCopy } from "@/settings/settings-sample"

export function AgentsTab() {
  return (
    <SettingsFrame tab="agents">
      <ModuleCard title={settingsCopy.agents} description={settingsCopy.agentsBody}>
        <div className="flex flex-col gap-3.5">
          <ModuleRow
            title={settingsCopy.aira}
            status={settingsCopy.airaStatus}
            mark={<AiraTile />}
            action={<SettingsToggle label={settingsCopy.aira} />}
          />
          <ModuleRow
            title={settingsCopy.claude}
            status={settingsCopy.connected}
            mark={<AgentTile name="claude" />}
            action={<SettingsButton width={77.82}>{settingsCopy.manage}</SettingsButton>}
          />
          <ModuleRow
            title={settingsCopy.codex}
            status={settingsCopy.notConnected}
            mark={<AgentTile name="codex" />}
            action={<SettingsButton width={80.54}>{settingsCopy.connect}</SettingsButton>}
          />
        </div>
      </ModuleCard>
      <ModuleCard title={settingsCopy.mcp} description={settingsCopy.mcpBody}>
        <div className="flex flex-col items-start">
          <div className="flex h-10 w-full items-center rounded-lg bg-muted pl-3">
            <span className="min-w-0 flex-1 text-[length:var(--type-dense)] leading-[17px] text-foreground">
              {settingsCopy.mcpAddress}
            </span>
            <SettingsButton width={60.13}>{settingsCopy.copy}</SettingsButton>
          </div>
          <button
            type="button"
            className="mt-3.5 h-[var(--space-16)] border-0 bg-transparent p-0 text-left text-[length:var(--type-dense)] leading-[17px] font-medium text-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {settingsCopy.setupGuides}
          </button>
        </div>
      </ModuleCard>
    </SettingsFrame>
  )
}
