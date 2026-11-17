import { useId } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AccountCard } from "@/settings/account-card"
import { ModuleRow } from "@/settings/module-row"
import { SettingsFrame } from "@/settings/settings-frame"
import { settingsCopy } from "@/settings/settings-sample"

const settingsAction =
  "h-[var(--space-32)] border-0 bg-background px-3.5 text-[length:var(--type-dense)] leading-[17px] shadow-[inset_0_0_0_1px_var(--field-edge)] hover:bg-background"

const settingsChoice =
  "h-8 w-[120px] border-0 bg-background px-2.5 text-[length:var(--type-dense)] leading-[17px] shadow-[inset_0_0_0_1px_var(--field-edge)] hover:bg-background"

function PreferenceRow({ title, status, value }: { title: string; status?: string; value: string }) {
  const titleId = useId()
  return (
    <ModuleRow
      title={title}
      titleId={titleId}
      status={status}
      action={
        <Select defaultValue={value}>
          <SelectTrigger aria-labelledby={titleId} className={settingsChoice}>
            <SelectValue>{(selected: string | null) => selected ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={value}>{value}</SelectItem>
          </SelectContent>
        </Select>
      }
    />
  )
}

export function AccountTab() {
  return (
    <SettingsFrame tab="account">
      <Card
        title={settingsCopy.profile}
        description={settingsCopy.profileLine}
        actions={
          <Button type="button" variant="outline" className={settingsAction} style={{ width: 52.26 }}>
            {settingsCopy.edit}
          </Button>
        }
      />
      <Card title={settingsCopy.preferences}>
        <div className="flex flex-col gap-3.5">
          <PreferenceRow title={settingsCopy.language} value={settingsCopy.english} />
          <PreferenceRow
            title={settingsCopy.slideSize}
            status={settingsCopy.slideSizeBody}
            value={settingsCopy.slideRatio}
          />
        </div>
      </Card>
      <AccountCard email={settingsCopy.email} />
    </SettingsFrame>
  )
}
