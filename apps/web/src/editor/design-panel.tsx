import { EditorIcon } from "@/editor/editor-icons"
import { ExportButton, ZoomReadout } from "@/editor/editor-chrome"

export function DesignPanel() {
  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-line bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line pr-2 pl-3">
        <ZoomReadout value="64%" />
        <ExportButton />
      </div>
      <div className="flex h-12 shrink-0 items-center border-b border-line px-4">
        <span className="text-sm font-semibold text-foreground">Slide 3</span>
      </div>
      <section className="flex flex-col gap-3 border-b border-line px-4 py-4">
        <h2 className="text-[13px] font-semibold text-foreground">Template</h2>
        <div className="flex items-center gap-3 rounded-[10px] bg-white p-2 shadow-[0px_0px_0px_1px_#d7d7d6]">
          <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-[6px]">
            <span className="block flex-1 bg-navy" />
            <span className="block flex-1 bg-[#1d6b8f]" />
            <span className="block flex-1 bg-[#a9c4d2]" />
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-[13px] font-medium text-foreground">Halden</span>
            <span className="text-xs text-faint">Geist</span>
          </span>
          <EditorIcon name="chev" size={14} className="text-faint" />
        </div>
      </section>
      <section className="flex flex-col gap-3 border-b border-line px-4 py-4">
        <h2 className="text-[13px] font-semibold text-foreground">Background</h2>
        <div className="flex h-8 items-center rounded-[8px] bg-line p-0.5">
          <span className="flex h-7 flex-1 items-center justify-center rounded-[6px] bg-white text-xs font-medium text-foreground shadow-[0px_1px_2px_#0000001a]">
            Color
          </span>
          <span className="flex h-7 flex-1 items-center justify-center text-xs text-quiet">Image</span>
        </div>
        <Swatch color="#ffffff" name="White" edged />
      </section>
      <section className="flex flex-col gap-3 px-4 py-4">
        <h2 className="text-[13px] font-semibold text-foreground">Colors</h2>
        <div className="grid grid-cols-2 gap-2">
          <Swatch color="#0f2433" name="Navy" />
          <Swatch color="#1d6b8f" name="Teal" />
          <Swatch color="#a9c4d2" name="Mist" />
          <Swatch color="#ffffff" name="White" edged />
        </div>
      </section>
    </aside>
  )
}

function Swatch({ color, name, edged = false }: { color: string; name: string; edged?: boolean }) {
  return (
    <span className="flex h-9 items-center gap-2.5 rounded-[8px] bg-white px-3 shadow-[0px_0px_0px_1px_#d7d7d6]">
      <span className={edged ? "size-4 rounded-[4px] shadow-[0px_0px_0px_1px_#d7d7d6]" : "size-4 rounded-[4px]"} style={{ backgroundColor: color }} />
      <span className="text-[13px] text-foreground">{name}</span>
    </span>
  )
}

