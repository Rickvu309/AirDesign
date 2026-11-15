import { Button } from "@/components/ui/button"
import { EditorIcon } from "@/editor/editor-icons"
import { floatShadow, SidebarHead, surfaceShadow } from "@/editor/editor-chrome"
import { shapeArt, type ShapeArt } from "@/editor/shape-art"
import {
  imageColumns,
  lineStroke,
  shapeBox,
  shapeBoxEdge,
  shapeFill,
  shapeStroke,
  templateDark,
  templateHalden,
  templateLight,
} from "@/editor/tool-panels-art"
import { SlideThumb } from "@/editor/slide-thumb"
import { cn } from "@/lib/class-names"

export const basicShapes: Record<string, string> = {
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

export const trayShapes = ["square", "circle", "diamond", "triangle", "star", "plus", "arrowl", "arrowr", "bubble"]

export function ShapeSvg({ markup, size, stroke = shapeStroke }: { markup: string; size: number; stroke?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={shapeFill}
      stroke={stroke}
      strokeWidth="1"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}

export function LineArt({ arrow, size }: { arrow: boolean; size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={lineStroke}
      strokeWidth={size > 24 ? 1.5 : 1.6}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M5 19 19 5" />
      {arrow ? <path d="M11 5h8v8" /> : null}
    </svg>
  )
}

export function ShapeTray() {
  return (
    <div className={cn("flex items-center gap-0.5 rounded-xl bg-white p-1.5", floatShadow)}>
      {[false, true].map((arrow) => (
        <span key={String(arrow)} className="flex size-9 items-center justify-center rounded-md">
          <LineArt arrow={arrow} size={22} />
        </span>
      ))}
      <span className="mx-1 block h-6 w-px bg-[var(--field-edge)]" />
      {trayShapes.map((name) => (
        <span key={name} className="flex size-9 items-center justify-center rounded-md">
          <ShapeSvg markup={basicShapes[name]} size={26} />
        </span>
      ))}
      <span className="mx-1 block h-6 w-px bg-[var(--field-edge)]" />
      <span className="flex h-8 shrink-0 items-center rounded-lg px-2.5 text-xs font-medium text-foreground">
        More shapes
      </span>
    </div>
  )
}

function MediaChrome({ title, heading, search }: { title: string; heading: string; search: string }) {
  return (
    <>
      <SidebarHead title={title} />
      <div className="flex h-10 shrink-0 items-center gap-1 px-2">
        <EditorIcon name="chevl" size={16} />
        <span className="text-sm font-semibold text-foreground">{heading}</span>
      </div>
      <div className="flex border-b border-line px-3 pb-3">
        <span className="flex h-8 flex-1 items-center gap-2 rounded-lg bg-line px-2.5 text-[length:var(--type-dense)] text-faint">
          <EditorIcon name="search" size={14} />
          {search}
        </span>
      </div>
    </>
  )
}

export function ImagesPanel({ title }: { title: string }) {
  const left = imageColumns.left
  const right = imageColumns.right
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-white">
      <MediaChrome title={title} heading="Images" search="Search images" />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-3 pt-3">
        <span className="text-xs font-medium text-quiet">Stock photos</span>
        <div className="flex gap-2">
          <PhotoColumn tiles={left} />
          <PhotoColumn tiles={right} />
        </div>
      </div>
      <div className="shrink-0 border-t border-line p-3">
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-9 w-full gap-2 rounded-lg bg-white text-[length:var(--type-dense)] font-medium text-foreground hover:bg-white active:translate-y-0",
            surfaceShadow,
          )}
        >
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
        <span
          key={`${color}-${height}`}
          className="block w-full rounded-[var(--shape-control)]"
          style={{ height, backgroundColor: color }}
        />
      ))}
    </div>
  )
}

const lineArt = shapeArt.slice(0, 2)
const basicArt = shapeArt.slice(2, 16)
const flowArt = shapeArt.slice(16)

export function ShapesPanel({ title }: { title: string }) {
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-white">
      <MediaChrome title={title} heading="Shapes" search="Search shapes" />
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
        className="absolute"
        style={{
          left: art.x,
          top: art.y,
          width: art.w,
          height: art.h,
          borderRadius: art.radius,
          backgroundColor: shapeBox,
          boxShadow: shapeBoxEdge,
        }}
      />
    )
  }
  return (
    <span className="absolute" style={{ left: art.x, top: art.y }} dangerouslySetInnerHTML={{ __html: art.markup }} />
  )
}

function ShapeTile({ arts }: { arts: ShapeArt[] }) {
  return (
    <span className="relative block size-[68px] shrink-0 rounded-lg bg-canvas">
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
  ["Header 1", "text-[length:var(--type-title)] font-semibold tracking-[-0.3px]"],
  ["Header 2", "text-lg font-semibold"],
  ["Header 3", "text-[length:var(--type-section)] font-semibold"],
  ["Body 1", "text-[length:var(--type-section)]"],
  ["Body 2", "text-sm"],
  ["Body 3", "text-[length:var(--type-dense)]"],
  ["Note", "text-xs text-quiet"],
] as const

export function TextPanel({ title }: { title: string }) {
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-white">
      <SidebarHead title={title} />
      <div className="flex h-10 shrink-0 items-center gap-1 px-2">
        <EditorIcon name="chevl" size={16} />
        <span className="text-sm font-semibold text-foreground">Text</span>
      </div>
      <div className="flex border-b border-line px-3 pb-3">
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-8 w-full gap-1.5 rounded-lg bg-white text-[length:var(--type-dense)] font-medium text-foreground hover:bg-white active:translate-y-0",
            surfaceShadow,
          )}
        >
          <EditorIcon name="text" size={14} />
          Add text box
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-3 pt-3">
        <span className="text-xs font-medium text-quiet">Halden styles</span>
        {textStyles.map(([label, sample]) => (
          <div key={label} className="flex items-center rounded-lg bg-canvas px-3 py-2.5">
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
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "h-8 w-[64px] shrink-0 rounded-lg bg-white px-0 text-foreground hover:bg-white active:translate-y-0",
          surfaceShadow,
        )}
        aria-label="Add slide"
      >
        <EditorIcon name="plus" size={15} />
      </Button>
      <span className="mt-5 mb-5 block h-px w-full bg-line" />
      {groups.map((group, groupIndex) => (
        <div key={group[0]} className="flex flex-col items-center">
          {groupIndex > 0 ? <span className="my-5 block h-px w-8 bg-[var(--field-edge)]" /> : null}
          {group.map((index, itemIndex) => (
            <span
              key={index}
              className={cn(
                "rounded-sm p-[var(--space-4)]",
                itemIndex > 0 && "mt-2",
                index === 3 && "shadow-[0_0_0_2px_var(--ring)]",
              )}
            >
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
    <div
      className={cn(
        "absolute top-3 left-[256px] z-20 flex w-[496px] flex-col overflow-hidden rounded-[var(--shape-dialog)] bg-white pb-5",
        floatShadow,
      )}
    >
      <div className="border-b border-line p-3">
        <span className="flex h-10 items-center gap-2 rounded-[var(--shape-card)] bg-line px-3 text-[length:var(--type-dense)] text-faint">
          <EditorIcon name="search" size={15} />
          Search templates
        </span>
      </div>
      <div className="flex flex-col gap-6 px-4 pt-4">
        <div className="flex flex-col gap-3">
          <span className="text-[length:var(--type-dense)] font-semibold text-foreground">Your templates</span>
          <TemplateCard name="Halden" className="bg-navy" title="Halden" {...templateHalden} />
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-[length:var(--type-dense)] font-semibold text-foreground">Basic</span>
          <div className="flex gap-4">
            <TemplateCard
              name="Light slides"
              className="bg-white shadow-[0px_0px_0px_1px_var(--field-edge)]"
              title="Slide title"
              {...templateLight}
            />
            <TemplateCard
              name="Dark slides"
              fill={templateDark.fill}
              title="Slide title"
              titleColor={templateDark.titleColor}
              line={templateDark.line}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function TemplateCard({
  name,
  className,
  fill,
  title,
  titleColor,
  line,
}: {
  name: string
  className?: string
  fill?: string
  title: string
  titleColor: string
  line: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn("flex h-[126px] w-[224px] flex-col justify-center gap-1.5 rounded-[2px] px-5", className)}
        style={fill === undefined ? undefined : { backgroundColor: fill }}
      >
        <span className="text-[length:var(--type-dense)] font-semibold" style={{ color: titleColor }}>
          {title}
        </span>
        <span className="block h-[var(--space-4)] w-[90px] rounded-full" style={{ backgroundColor: line }} />
      </div>
      <span className="text-[length:var(--type-dense)] text-foreground">{name}</span>
    </div>
  )
}
