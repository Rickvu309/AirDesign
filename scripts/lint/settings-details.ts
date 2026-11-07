export function settingsDetailHits(file:string,source:string):{line:number;reason:string}[]{
  const hits:{line:number;reason:string}[]=[]
  function requireDetail(present:boolean,reason:string){if(!present)hits.push({line:1,reason})}
  if(file.endsWith("apps/studio/src/settings/settings.css")){
    requireDetail(!/\.settings-card \.ad-button\{/.test(source),"settings-card-actions-must-not-resize-nested-dialogs")
    requireDetail(source.includes("@media(pointer:coarse){.settings-card>.settings-row>.ad-button,.settings-card>.settings-row>.add-credits>.ad-button,.settings-card>.settings-module-row>.ad-button,.mcp-address>.ad-button{min-block-size:44px}"),"settings-card-touch-targets-must-override-the-desktop-action-specificity")
    requireDetail(!/\.settings-card \.payment-status p\{/.test(source)&&source.includes(".payment-status p{flex:1;color:var(--link);")&&source.includes(".payment-spinner{inline-size:16px;block-size:16px;border:2px"),"settings-pending-payment-uses-link-text-and-16px-2px-spinner")
    requireDetail(source.includes(".credit-balance{font-size:30px;line-height:36px;")&&source.includes(".settings-credits-head{align-items:flex-end}")&&source.includes(".settings-module-row>div{flex:1;min-inline-size:0;display:grid;gap:2px}")&&source.includes("display:grid;gap:4px}"),"settings-module-copy-and-balance-need-their-designed-line-boxes-and-gaps")
    requireDetail(source.includes(".settings-card h2{font-size:15px;line-height:18px;margin:0}")&&source.includes(".settings-card p{margin:0;line-height:18px}")&&source.includes(".settings-module-row p{font-size:12px;line-height:15px;")&&source.includes("font-weight:500;line-height:18px}")&&source.includes(".settings-row.settings-divider h2{font-size:14px;font-weight:500}"),"settings-text-line-boxes-must-not-accumulate-extra-card-height")
    requireDetail(source.includes(".approval-account .ad-avatar{inline-size:32px;block-size:32px;")&&source.includes(".agent-approval h1{font-size:20px;line-height:24px;")&&source.includes(".agent-approval .settings-row{gap:8px}")&&source.includes(".agent-approval .settings-row .ad-button{min-block-size:40px}")&&source.includes(".agent-permissions ul{list-style:none;padding:0;margin:0;display:grid;gap:10px;line-height:16px}"),"agent-approval-uses-designed-avatar-heading-actions-and-permission-spacing")
    requireDetail(source.includes(".aira-panel .aira-usage-limit h3{color:var(--foreground);"),"usage-limit-heading-must-override-inherited-alert-red")
  }
  if(file.endsWith("apps/studio/src/export/export-dialog.tsx")){
    requireDetail(!source.includes("export-advanced")&&!source.includes("setTiming"),"export-v01-must-not-expose-backlogged-timing-options")
    requireDetail(source.includes("downloadArtifact(")&&source.includes("toast.success(fillCopy(\"export.downloaded\",{file}))"),"export-download-toast-must-use-the-artifact-filename-and-success-icon")
  }
  if(/apps\/studio\/src\/(?:export\/export-dialog|settings\/account-panel)\.tsx$/.test(file))requireDetail(!source.includes("<select ")&&source.includes("<NativeSelect "),"settings-export-selects-use-the-shared-native-chevron")
  if(/apps\/studio\/src\/(?:export\/export-dialog|settings\/add-credits)\.tsx$/.test(file))requireDetail(!source.includes(">×</Button>")&&source.includes("<CloseIcon/>"),"settings-export-close-controls-use-the-vector-icon")
  if(file.endsWith("apps/studio/src/settings/add-credits.tsx"))requireDetail(source.includes("<ExternalLinkIcon/>"),"payment-checkout-action-shows-its-new-tab-arrow")
  if(file.endsWith("apps/studio/src/agents/agents-panel.tsx"))requireDetail(source.includes('<span className="settings-agent-tile agent-mark-aira"><AgentMark kind="aira"/></span>'),"settings-aira-row-uses-the-blue-agent-symbol")
  if(/apps\/studio\/src\/(?:chat\/chat-panel|usage\/usage-panel)\.tsx$/.test(file))requireDetail(!source.includes('toast(copy("usage.reset_done"))'),"usage-reset-confirmation-needs-the-success-check")
  if(file.endsWith("packages/ui/src/toast/toaster.tsx"))requireDetail(source.includes('icons={{')&&source.includes('className="ad-toaster"'),"toasts-need-designed-icons-and-responsive-content-sizing")
  if(file.endsWith("packages/ui/src/tokens/tokens.css"))requireDetail(source.includes(".ad-toaster [data-sonner-toast][data-styled=true] [data-title]{font-weight:400;line-height:18px}"),"toast-title-must-override-sonner-weight-and-line-height-at-the-same-specificity")
  if(file.endsWith("packages/ui/src/tokens/tokens.css"))requireDetail(source.includes(".ad-external-link-icon{margin-inline-start:6px}"),"external-payment-arrow-needs-the-designed-gap-after-its-label")
  return hits
}
