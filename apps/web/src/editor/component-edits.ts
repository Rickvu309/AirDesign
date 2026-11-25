import * as doom from "@airdesign/doom"
import { measureDoom } from "@airdesign/render"
import { toast } from "@/components/ui/toast"
import { designCopy } from "@/copy/design-copy"
import type { EditorClient } from "./use-deck"

export function commitDesignEdit(client: EditorClient, writes: readonly doom.Write[], read = client.view()): void {
  const proposed = doom.sampleComponentEdit(read, writes)
  if (proposed === null) {
    client.push(writes)
    return
  }
  if (doom.isRefusal(proposed)) {
    toast.error(designCopy.chartEditFailed)
    return
  }
  void measureDoom(document, proposed.view, proposed.texts).then(
    (measure) => {
      if (client.view() !== read) {
        toast.error(designCopy.chartEditStale)
        return
      }
      const prepared = doom.prepareComponentEdit(read, writes, measure)
      if (doom.isRefusal(prepared) || !client.push(prepared, { read }).ok) toast.error(designCopy.chartEditFailed)
    },
    () => toast.error(designCopy.chartFontFailed),
  )
}
