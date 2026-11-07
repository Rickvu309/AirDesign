export function editorLayoutHits(file:string,source:string):{line:number;reason:string}[] {
  if(file.endsWith("apps/studio/src/editor/editor.css") && /data-sync-state=offline\]>.editor-status(?:,|\s*\{)/.test(source))return [{line:1,reason:"offline-banner-must-not-reveal-hidden-font-status"}]
  if(file.endsWith("apps/studio/src/editor/editor.css") && !/\.studio-editor\[data-chat=true\],\.studio-editor\[data-design=true\]\s*\{\s*--editor-left:0px;--editor-right:0px/.test(source))return [{line:1,reason:"phone-editor-must-reset-desktop-panel-widths"}]
  if(file.endsWith("apps/studio/src/editor/manual-editor.tsx") && /<Toaster\b/.test(source))return [{line:source.slice(0,source.indexOf("<Toaster")).split("\n").length,reason:"editor-must-use-the-shell-toaster"}]
  if(file.endsWith("apps/studio/src/settings/settings.css") && /\.studio-editor\b/.test(source))return [{line:source.slice(0,source.indexOf(".studio-editor")).split("\n").length,reason:"editor-layout-belongs-in-editor-css"}]
  if(file.endsWith("apps/studio/src/editor/editor.css") && !/\.slide-canvas\s*\{[^}]*position\s*:\s*absolute/.test(source))return [{line:1,reason:"scaled-slide-canvas-must-not-affect-thumbnail-layout"}]
  if(file.endsWith("apps/studio/src/chat/chat.css") && !/\.aira-panel\s*\{[^}]*inset-block\s*:\s*56px 0[^}]*z-index\s*:\s*25/.test(source))return [{line:1,reason:"aira-must-leave-export-and-zoom-above-the-panel"}]
  if(file.endsWith("apps/studio/src/chat/chat-panel.tsx") && /<Button type="submit"(?! aria-label=)/.test(source))return [{line:1,reason:"aira-icon-submit-needs-an-explicit-accessible-name"}]
  if(/(?:apps\/studio\/src\/(?:editor|images)|packages\/render\/src)\//.test(file)){
    const match=/event\.patches\.map\(patch\s*=>\s*patch\.id\)|JSON\.stringify\(item\.command|aria-label=\{`[^`]*\$\{(?:element|image)\.id\b/.exec(source)
    if(match)return [{line:source.slice(0,match.index).split("\n").length,reason:"editor-content-labels-must-not-expose-internal-identifiers-or-command-payloads"}]
  }
  return []
}
