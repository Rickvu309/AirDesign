import { fontLoadFailed } from "@/copy/design-copy"
import { productCopy } from "@/copy/product-copy"
import { EditorToast } from "@/editor/editor-toast"
import { pictureCopy } from "@/copy/picture-copy"
import { exportCopy } from "@/copy/export-copy"

type Shown = { readonly text: string; readonly action?: string }

const notices = {
  "export-failed": { text: productCopy.exportFailed, action: exportCopy.tryAgain },
  "export-fonts": { text: fontLoadFailed("these slides"), action: exportCopy.tryAgain },
  "export-capacity": { text: exportCopy.fontCapacity, action: exportCopy.chooseSlides },
  "picture-type": { text: pictureCopy["picture-type"] },
  "picture-size": { text: pictureCopy["picture-size"] },
  "picture-unread": { text: pictureCopy["picture-unread"] },
  "storage-failed": { text: productCopy.storageFailed },
  "set-aside": { text: productCopy.editsSetAside },
  "set-aside-one": { text: productCopy.editSetAside },
  "text-refused": { text: productCopy.textRefused },
  "set-aside-too-large": { text: productCopy.editSetAsideTooLarge },
} satisfies Record<string, Shown>

export type ThinNotice = keyof typeof notices

export function ThinNoticeView({
  notice,
  onTryAgain,
}: {
  notice: ThinNotice | null
  onTryAgain: (notice: ThinNotice) => void
}) {
  const shown: Shown | null = notice === null ? null : notices[notice]
  if (notice === null || shown === null) return null
  return (
    <EditorToast
      text={shown.text}
      {...(shown.action === undefined ? {} : { action: shown.action, onAct: () => onTryAgain(notice) })}
    />
  )
}
