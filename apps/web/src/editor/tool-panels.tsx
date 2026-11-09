import { Button } from "@/components/ui/button"
import { EditorIcon } from "@/editor/editor-icons"
import { floatShadow, SidebarHead, surfaceShadow } from "@/editor/editor-chrome"
import { shapeArt, type ShapeArt } from "@/editor/shape-art"
import { SlideThumb } from "@/editor/slide-thumb"
import { cn } from "@/lib/utils"

const basicShapes: Record<string, string> = {
  square: '<rect x="3" y="3" width="18" height="18" rx="2.5"/>',
  circle: '<circle cx="12" cy="12" r="9.5"/>',
  diamond: '<path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/>',
  triangle: '<path d="M12 3 21.5 20.5H2.5z"/>',
  star: '<path d="m12 2.5 2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/>',
  plus: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  arrowl: '<path d="M10 4 3 12l7 8v-5h11V9H10z"/>',
  arrowr: '<path d="M14 4l7 8-7 8v-5H3V9h11z"/>',
  bubble: '<path d="M3 4h18v12H10l-5 4v-4H3z"/>',
  tridown: '<path d="M2.5 3.5h19L12 21z"/>',
  pill: '<rect x="2.5" y="6" width="19" height="12" rx="6"/>',
  pentagon: '<path d="m12 2.5 9.5 7-3.6 11.5H6.1L2.5 9.5z"/>',
  octagon: '<path d="M8 2.5h8l5.5 5.5v8L16 21.5H8L2.5 16V8z"/>',
  chevron: '<path d="M3 5h13l5 7-5 7H3l5-7z"/>',
}

const trayShapes = ["square", "circle", "diamond", "triangle", "star", "plus", "arrowl", "arrowr", "bubble"]

function ShapeSvg({ markup, size, stroke = "#2D6FCD" }: { markup: string; size: number; stroke?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="#4D94FB"
      stroke={stroke}
      strokeWidth="1"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}

function LineArt({ arrow, size }: { arrow: boolean; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#222222" strokeWidth={size > 24 ? 1.5 : 1.6} strokeLinecap="round" aria-hidden="true">
      <path d="M5 19 19 5" />
      {arrow ? <path d="M11 5h8v8" /> : null}
    </svg>
  )
}

export function ShapeTray() {
  return (
    <div className={cn("flex items-center gap-0.5 rounded-[12px] bg-white p-1.5", floatShadow)}>
      {[false, true].map((arrow) => (
        <span key={String(arrow)} className="flex size-9 items-center justify-center rounded-[7px]">
          <LineArt arrow={arrow} size={22} />
        </span>
      ))}
      <span className="mx-1 block h-6 w-px bg-[#d7d7d6]" />
      {trayShapes.map((name) => (
        <span key={name} className="flex size-9 items-center justify-center rounded-[7px]">
          <ShapeSvg markup={basicShapes[name]} size={26} />
        </span>
      ))}
      <span className="mx-1 block h-6 w-px bg-[#d7d7d6]" />
      <span className="flex h-8 shrink-0 items-center rounded-[8px] px-2.5 text-xs font-medium text-foreground">More shapes</span>
    </div>
  )
}

export function ActionsMenu() {
  return (
    <div className={cn("flex w-[320px] flex-col gap-1 rounded-[12px] bg-white p-2", floatShadow)}>
      <span className="flex h-9 items-center gap-2 rounded-[8px] bg-line px-2.5 text-[13px] text-faint">
        <EditorIcon name="search" size={15} />
        Search actions
      </span>
      <span className="pt-1 pl-2 text-xs text-faint">Insert</span>
      <ActionRow icon="chart" label="Chart" />
      <ActionRow icon="table" label="Table" />
      <ActionRow icon="icon" label="Icon" />
      <span className="pt-1 pl-2 text-xs text-faint">Image</span>
      <ActionRow icon="rmbg" label="Remove background" />
      <ActionRow icon="hd" label="Boost resolution" />
    </div>
  )
}

function ActionRow({ icon, label }: { icon: "chart" | "table" | "icon" | "rmbg" | "hd"; label: string }) {
  return (
    <span className="flex h-9 items-center gap-2.5 rounded-[8px] px-2 text-[13px] text-foreground">
      <ActionGlyph name={icon} />
      {label}
    </span>
  )
}

function ActionGlyph({ name }: { name: "chart" | "table" | "icon" | "rmbg" | "hd" }) {
  const paths = {
    chart: '<path d="M4 20h16M7 16v-5M12 16V7M17 16v-8"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/>',
    icon: '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"/>',
    rmbg: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="2.5 2.5"/><circle cx="12" cy="10" r="2.5"/><path d="M7.5 18c.8-2.5 2.5-3.5 4.5-3.5s3.7 1 4.5 3.5"/>',
    hd: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4M10 10v4M7 12h3M13 10v4h1.5a2 2 0 0 0 0-4z"/>',
  }
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: paths[name] }} />
  )
}

function MediaChrome({ title, search }: { title: string; search: string }) {
  return (
    <>
      <SidebarHead />
      <div className="flex h-10 shrink-0 items-center gap-1 px-2">
        <EditorIcon name="chevl" size={16} />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="flex border-b border-line px-3 pb-3">
        <span className="flex h-8 flex-1 items-center gap-2 rounded-[8px] bg-line px-2.5 text-[13px] text-faint">
          <EditorIcon name="search" size={14} />
          {search}
        </span>
      </div>
    </>
  )
}

export function ImagesPanel() {
  const left: [number, string][] = [
    [78, "#4f6b7d"],
    [130, "#a9c4d2"],
    [96, "#0f2433"],
    [120, "#c1c1c0"],
    [90, "#1d6b8f"],
  ]
  const right: [number, string][] = [
    [120, "#d7d7d6"],
    [88, "#1d6b8f"],
    [140, "#a9c4d2"],
    [80, "#4f6b7d"],
    [110, "#eaeae7"],
  ]
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-white">
      <MediaChrome title="Images" search="Search images" />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-3 pt-3">
        <span className="text-xs font-medium text-quiet">Stock photos</span>
        <div className="flex gap-2">
          <PhotoColumn tiles={left} />
          <PhotoColumn tiles={right} />
        </div>
      </div>
      <div className="shrink-0 border-t border-line p-3">
        <Button type="button" variant="ghost" className={cn("h-9 w-full gap-2 rounded-[8px] bg-white text-[13px] font-medium text-foreground hover:bg-white active:translate-y-0", surfaceShadow)}>
          <EditorIcon name="upload" size={15} />
          Upload image
        </Button>
      </div>
    </aside>
  )
}

function PhotoColumn({ tiles }: { tiles: [number, string][] }) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      {tiles.map(([height, color]) => (
        <span key={`${color}-${height}`} className="block w-full rounded-[6px]" style={{ height, backgroundColor: color }} />
      ))}
    </div>
  )
}

const lineArt = shapeArt.slice(0, 2)
const basicArt = shapeArt.slice(2, 16)
const flowArt = shapeArt.slice(16)

export function ShapesPanel() {
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-white">
      <MediaChrome title="Shapes" search="Search shapes" />
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-3 pt-2">
        <GroupHead title="Lines" />
        <ShapeRow arts={lineArt} />
        <GroupHead title="Basic" />
        <ShapeRows arts={basicArt} />
        <GroupHead title="Flowchart" />
        <ShapeRows arts={flowArt} />
      </div>
    </aside>
  )
}

function GroupHead({ title }: { title: string }) {
  return (
    <div className="flex h-7 items-center gap-1">
      <EditorIcon name="chev" size={12} className="text-faint" />
      <span className="text-xs font-semibold text-foreground">{title}</span>
    </div>
  )
}

function ShapeMark({ art }: { art: ShapeArt }) {
  if (art.kind === "box") {
    return (
      <span
        className="absolute bg-[#4d94fb]"
        style={{
          left: art.x,
          top: art.y,
          width: art.w,
          height: art.h,
          borderRadius: art.radius,
          boxShadow: "0 0 0 0.63px #2d6fcd, inset 0 0 0 0.63px #2d6fcd",
        }}
      />
    )
  }
  return <span className="absolute" style={{ left: art.x, top: art.y }} dangerouslySetInnerHTML={{ __html: art.markup }} />
}

function ShapeTile({ arts }: { arts: ShapeArt[] }) {
  return (
    <span className="relative block size-[68px] shrink-0 rounded-[8px] bg-canvas">
      {arts.map((art, index) => (
        <ShapeMark key={index} art={art} />
      ))}
    </span>
  )
}

function ShapeRow({ arts }: { arts: ShapeArt[][] }) {
  return (
    <div className="flex gap-1.5">
      {arts.map((art, index) => (
        <ShapeTile key={index} arts={art} />
      ))}
    </div>
  )
}

function ShapeRows({ arts }: { arts: ShapeArt[][] }) {
  return (
    <div className="flex flex-wrap gap-x-1.5 gap-y-2">
      {arts.map((art, index) => (
        <ShapeTile key={index} arts={art} />
      ))}
    </div>
  )
}

const textStyles = [
  ["Title", "text-[30px] font-semibold tracking-[-0.6px] leading-[1.1]"],
  ["Header 1", "text-[22px] font-semibold tracking-[-0.3px]"],
  ["Header 2", "text-lg font-semibold"],
  ["Header 3", "text-[15px] font-semibold"],
  ["Body 1", "text-[15px]"],
  ["Body 2", "text-sm"],
  ["Body 3", "text-[13px]"],
  ["Note", "text-xs text-quiet"],
] as const

export function TextPanel() {
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-white">
      <SidebarHead />
      <div className="flex h-10 shrink-0 items-center gap-1 px-2">
        <EditorIcon name="chevl" size={16} />
        <span className="text-sm font-semibold text-foreground">Text</span>
      </div>
      <div className="flex border-b border-line px-3 pb-3">
        <Button type="button" variant="ghost" className={cn("h-8 w-full gap-1.5 rounded-[8px] bg-white text-[13px] font-medium text-foreground hover:bg-white active:translate-y-0", surfaceShadow)}>
          <EditorIcon name="text" size={14} />
          Add text box
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-3 pt-3">
        <span className="text-xs font-medium text-quiet">Halden styles</span>
        {textStyles.map(([label, sample]) => (
          <div key={label} className="flex items-center rounded-[8px] bg-canvas px-3 py-2.5">
            <span className={cn("text-foreground", sample)}>{label}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}

export function SlideColumn() {
  const groups = [
    [1, 2],
    [3, 4, 5],
    [6, 7, 8],
  ]
  return (
    <div className="flex h-full w-[96px] shrink-0 flex-col items-center overflow-hidden border-r border-line bg-white pt-3">
      <Button type="button" variant="ghost" className={cn("h-8 w-[64px] shrink-0 rounded-[8px] bg-white px-0 text-foreground hover:bg-white active:translate-y-0", surfaceShadow)} aria-label="Add slide">
        <EditorIcon name="plus" size={15} />
      </Button>
      <span className="mt-5 mb-5 block h-px w-full bg-line" />
      {groups.map((group, groupIndex) => (
        <div key={group[0]} className="flex flex-col items-center">
          {groupIndex > 0 ? <span className="my-5 block h-px w-8 bg-[#d7d7d6]" /> : null}
          {group.map((index, itemIndex) => (
            <span key={index} className={cn("rounded-[4px] p-[2px]", itemIndex > 0 && "mt-2", index === 3 && "shadow-[0px_0px_0px_2px_var(--primary)]")}>
              <SlideThumb index={index} width={60} />
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

export function TemplatePicker() {
  return (
    <div className={cn("absolute top-3 left-[256px] z-20 flex w-[496px] flex-col overflow-hidden rounded-[14px] bg-white pb-5", floatShadow)}>
      <div className="border-b border-line p-3">
        <span className="flex h-10 items-center gap-2 rounded-[10px] bg-line px-3 text-[13px] text-faint">
          <EditorIcon name="search" size={15} />
          Search templates
        </span>
      </div>
      <div className="flex flex-col gap-6 px-4 pt-4">
        <div className="flex flex-col gap-3">
          <span className="text-[13px] font-semibold text-foreground">Your templates</span>
          <TemplateCard name="Halden" className="bg-navy" title="Halden" titleColor="#ffffff" line="#ffffff55" />
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-[13px] font-semibold text-foreground">Basic</span>
          <div className="flex gap-4">
            <TemplateCard name="Light slides" className="bg-white shadow-[0px_0px_0px_1px_#d7d7d6]" title="Slide title" titleColor="#222222" line="#d7d7d6" />
            <TemplateCard name="Dark slides" className="bg-[#111111]" title="Slide title" titleColor="#ffffff" line="#ffffff40" />
          </div>
        </div>
      </div>
    </div>
  )
}

function TemplateCard({
  name,
  className,
  title,
  titleColor,
  line,
}: {
  name: string
  className: string
  title: string
  titleColor: string
  line: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className={cn("flex h-[126px] w-[224px] flex-col justify-center gap-1.5 rounded-[2px] px-5", className)}>
        <span className="text-[13px] font-semibold" style={{ color: titleColor }}>
          {title}
        </span>
        <span className="block h-[3px] w-[90px] rounded-full" style={{ backgroundColor: line }} />
      </div>
      <span className="text-[13px] text-foreground">{name}</span>
    </div>
  )
}
