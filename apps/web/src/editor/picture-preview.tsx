export function PicturePreview({ src }: { readonly src: string | null }) {
  return src === null ? null : (
    <div className="flex flex-col gap-2" data-picture-preview>
      <div
        className="aspect-[var(--ratio-picture-preview)] overflow-hidden rounded-[var(--shape-control)]"
        style={{ background: "var(--fill-transparency)" }}
      >
        <img src={src} alt="" className="size-full object-contain" />
      </div>
    </div>
  )
}
