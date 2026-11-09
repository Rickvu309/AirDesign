import { ModuleCard } from "@/settings/module-card"
import { ModuleRow } from "@/settings/module-row"
import { SettingsButton, SettingsSelect } from "@/settings/settings-controls"
import { SettingsFrame } from "@/settings/settings-frame"
import { settingsCopy } from "@/settings/settings-sample"

export function AccountTab() {
  return (
    <SettingsFrame tab="account">
      <ModuleCard
        title={settingsCopy.profile}
        description={settingsCopy.profileLine}
        actions={<SettingsButton width={52.26}>{settingsCopy.edit}</SettingsButton>}
      />
      <ModuleCard title={settingsCopy.preferences}>
        <div className="flex flex-col gap-3.5">
          <ModuleRow title={settingsCopy.language} action={<SettingsSelect value={settingsCopy.english} />} />
          <ModuleRow
            title={settingsCopy.slideSize}
            status={settingsCopy.slideSizeBody}
            action={<SettingsSelect value={settingsCopy.slideRatio} />}
          />
        </div>
      </ModuleCard>
      <ModuleCard title={settingsCopy.account}>
        <div className="flex flex-col gap-3.5">
          <ModuleRow
            title={settingsCopy.signedIn}
            status={settingsCopy.email}
            action={<SettingsButton width={79.84}>{settingsCopy.signOut}</SettingsButton>}
          />
          <ModuleRow
            title={settingsCopy.deleteAccount}
            status={settingsCopy.deleteBody}
            action={<SettingsButton tone="danger" width={122.75}>{settingsCopy.deleteAccount}</SettingsButton>}
          />
        </div>
      </ModuleCard>
    </SettingsFrame>
  )
}
