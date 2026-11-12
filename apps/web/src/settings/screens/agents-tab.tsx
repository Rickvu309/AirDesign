import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { ModuleRow } from "@/settings/module-row"
import { AgentTile, AiraTile } from "@/settings/settings-controls"
import { SettingsFrame } from "@/settings/settings-frame"
import { settingsCopy } from "@/settings/settings-sample"

const settingsAction =
  "h-[var(--space-32)] border-0 bg-background px-3.5 text-[length:var(--type-dense)] leading-[17px] shadow-[inset_0_0_0_1px_var(--field-edge)] hover:bg-background"

const settingsSwitch =
  "h-5! w-9! border-transparent p-0! shadow-none after:hidden data-checked:bg-primary! [&_[data-slot=switch-thumb]]:size-4! [&_[data-slot=switch-thumb]]:shadow-[0_1px_2px_rgba(0,0,0,0.2)] [&_[data-slot=switch-thumb]]:data-checked:translate-x-[18px]!"

export function AgentsTab() {
  return (
    <SettingsFrame tab="agents">
      <Card title={settingsCopy.agents} description={settingsCopy.agentsBody}>
        <div className="flex flex-col gap-3.5">
          <ModuleRow
            title={settingsCopy.aira}
            status={settingsCopy.airaStatus}
            mark={<AiraTile />}
            action={<Switch defaultChecked aria-label={settingsCopy.aira} className={settingsSwitch} />}
          />
          <ModuleRow
            title={settingsCopy.claude}
            status={settingsCopy.connected}
            mark={<AgentTile name="claude" />}
            action={
              <Button type="button" variant="outline" className={settingsAction} style={{ width: 77.82 }}>
                {settingsCopy.manage}
              </Button>
            }
          />
          <ModuleRow
            title={settingsCopy.codex}
            status={settingsCopy.notConnected}
            mark={<AgentTile name="codex" />}
            action={
              <Button type="button" variant="outline" className={settingsAction} style={{ width: 80.54 }}>
                {settingsCopy.connect}
              </Button>
            }
          />
        </div>
      </Card>
      <Card title={settingsCopy.mcp} description={settingsCopy.mcpBody}>
        <div className="flex flex-col items-start">
          <div className="flex h-10 w-full items-center rounded-lg bg-muted pl-3">
            <span className="min-w-0 flex-1 text-[length:var(--type-dense)] leading-[17px] text-foreground">
              {settingsCopy.mcpAddress}
            </span>
            <Button type="button" variant="outline" className={settingsAction} style={{ width: 60.13 }}>
              {settingsCopy.copy}
            </Button>
          </div>
          <button
            type="button"
            className="mt-3.5 h-[var(--space-16)] border-0 bg-transparent p-0 text-left text-[length:var(--type-dense)] leading-[17px] font-medium text-ring"
          >
            {settingsCopy.setupGuides}
          </button>
        </div>
      </Card>
    </SettingsFrame>
  )
}
