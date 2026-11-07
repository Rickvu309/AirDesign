import { Button,copy } from "@airdesign/ui"
export function EditorErrorNotice({saving,retry}:{saving:boolean;retry:()=>void}) {
  return <div role="alert"><p>{saving ? copy("editor.save_failed") : copy("editor.open_failed")}</p><Button size="compact" variant="secondary" onClick={retry}>{copy("editor.retry")}</Button> <a href="/">Back to Home</a></div>
}
