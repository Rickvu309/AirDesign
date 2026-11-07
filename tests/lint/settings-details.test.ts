import {readFileSync} from "node:fs"
import {expect,it} from "vitest"
import {settingsDetailHits} from "../../scripts/lint/settings-details.ts"

const css="apps/studio/src/settings/settings.css"
const replacements:[string,string,string][]=[
 ["packages/ui/src/tokens/tokens.css",".ad-toaster [data-sonner-toast][data-styled=true] [data-title]{font-weight:400;line-height:18px}",".ad-toaster [data-title]{line-height:18px}"],
 [css,".settings-card>.settings-row>.ad-button,", ".settings-card .ad-button{font-size:13px;min-block-size:34px}.settings-card>.settings-row>.ad-button,"],
 [css,"@media(pointer:coarse){.settings-card>.settings-row>.ad-button,.settings-card>.settings-row>.add-credits>.ad-button,.settings-card>.settings-module-row>.ad-button,.mcp-address>.ad-button{min-block-size:44px}","@media(pointer:coarse){.settings-card .ad-button{min-block-size:44px}"],
 [css,".payment-spinner{inline-size:16px;block-size:16px;border:2px",".payment-spinner{inline-size:14px;block-size:14px;border:1px"],
 [css,".credit-balance{font-size:30px;line-height:36px;",".credit-balance{font-size:30px;"],
 [css,".settings-module-row p{font-size:12px;line-height:15px;",".settings-module-row p{font-size:12px;line-height:18px;"],
 [css,".settings-row.settings-divider h2{font-size:14px;font-weight:500}",".settings-row.settings-divider h2{font-size:15px;font-weight:600}"],
 [css,".agent-approval .settings-row .ad-button{min-block-size:40px}",".agent-approval .settings-row .ad-button{min-block-size:36px}"],
 [css,".aira-panel .aira-usage-limit h3{color:var(--foreground);",".aira-usage-limit h3{"],
 ["apps/studio/src/export/export-dialog.tsx","<footer>",'<details className="export-advanced"><summary>Export timing</summary></details><footer>'],
 ["apps/studio/src/export/export-dialog.tsx",'toast.success(fillCopy("export.downloaded",{file}))','toast(fillCopy("export.downloaded",{file:"PowerPoint"}))'],
 ["apps/studio/src/export/export-dialog.tsx","<NativeSelect ","<select "],
 ["apps/studio/src/settings/account-panel.tsx","<NativeSelect ","<select "],
 ["apps/studio/src/settings/add-credits.tsx","<CloseIcon/>","×"],
 ["apps/studio/src/settings/add-credits.tsx","<ExternalLinkIcon/>",""],
 ["apps/studio/src/agents/agents-panel.tsx",'<span className="settings-agent-tile agent-mark-aira"><AgentMark kind="aira"/></span>','<span className="settings-agent-tile"><BrandMark/></span>'],
 ["apps/studio/src/chat/chat-panel.tsx",'toast.success(copy("usage.reset_done"))','toast(copy("usage.reset_done"))'],
 ["packages/ui/src/toast/toaster.tsx",'className="ad-toaster"',""]
]
it.each(replacements)("rejects the original detail in %s and accepts the corrected source",(file,fixed,original)=>{
 const source=readFileSync(file,"utf8")
 expect(source).toContain(fixed)
 expect(settingsDetailHits(file,source)).toEqual([])
 expect(settingsDetailHits(file,source.replace(fixed,original)).length).toBeGreaterThan(0)
})
