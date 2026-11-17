import { ApproveAgent } from "@/connect/approve-agent"
import { claudeConnect } from "@/copy/connect-copy"

export function ApproveClaude() {
  return (
    <ApproveAgent
      agent="claude"
      title={claudeConnect.title}
      subtitle={claudeConnect.subtitle}
      ability={claudeConnect.ability}
      footer={claudeConnect.footer}
      screenTitle={claudeConnect.approveTitle}
    />
  )
}
