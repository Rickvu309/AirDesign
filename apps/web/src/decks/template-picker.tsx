import { deckTemplates } from "@airdesign/templates"
import { SlideCanvas } from "@airdesign/render"
import { ChevronLeftIcon, PlusIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogPopup, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { templatePickerCopy } from "@/copy/template-picker-copy"
import type { DeckTemplate, TemplateSlides } from "@/decks/template-decks"
import { hairlineShadow } from "@/editor/editor-chrome"
import { cn } from "@/lib/class-names"

const tileWidth = 208

function usePaintedSlides(id: string): TemplateSlides | null {
  const [painted, setPainted] = useState<TemplateSlides | null>(null)
  useEffect(() => {
    let live = true
    let held: TemplateSlides | null = null
    void import("@/decks/template-decks")
      .then(({ templateSlides }) => templateSlides(id))
      .then((slides) => {
        if (!live) {
          slides.release()
          return
        }
        held = slides
        setPainted(slides)
      })
    return () => {
      live = false
      held?.release()
    }
  }, [id])
  return painted
}

function SlideTile({ painted, at }: { painted: TemplateSlides | null; at: number }) {
  const slide = painted?.slides[at]
  if (painted === null || slide === undefined)
    return <Skeleton className="aspect-video w-full rounded-[var(--shape-segment)]" />
  return (
    <SlideCanvas
      quiet
      slide={slide}
      store={painted.store}
      width={tileWidth}
      className={cn("overflow-hidden rounded-[var(--shape-segment)]", hairlineShadow)}
    />
  )
}

const tileClass = "group flex w-[208px] flex-col gap-2 rounded-md text-left"

function TemplateCard({ template, onOpen }: { template: DeckTemplate; onOpen: () => void }) {
  const painted = usePaintedSlides(template.id)
  return (
    <button type="button" className={tileClass} data-template={template.id} onClick={onOpen}>
      <span className="block transition-shadow group-hover:shadow-[0_0_0_2px_var(--primary)] rounded-[var(--shape-segment)]">
        <SlideTile painted={painted} at={0} />
      </span>
      <span className="flex flex-col">
        <span className="text-[length:var(--type-dense)] font-medium text-foreground">{template.name}</span>
        <span className="text-[length:var(--type-caption)] text-muted-foreground">
          {painted === null ? " " : templatePickerCopy.slideCount(painted.slides.length)}
        </span>
      </span>
    </button>
  )
}

function ScratchCard({ onStart }: { onStart: () => void }) {
  return (
    <button type="button" className={tileClass} data-template-scratch onClick={onStart}>
      <span
        className={cn(
          "flex aspect-video w-full items-center justify-center rounded-[var(--shape-segment)] bg-background text-muted-foreground transition-shadow group-hover:shadow-[0_0_0_2px_var(--primary)]",
          hairlineShadow,
        )}
      >
        <PlusIcon className="size-5" aria-hidden="true" />
      </span>
      <span className="flex flex-col">
        <span className="text-[length:var(--type-dense)] font-medium text-foreground">
          {templatePickerCopy.startFromScratch}
        </span>
        <span className="text-[length:var(--type-caption)] text-muted-foreground">
          {templatePickerCopy.slideCount(1)}
        </span>
      </span>
    </button>
  )
}

function TemplateSlideGrid({ template, onChoose }: { template: DeckTemplate; onChoose: (slide: number) => void }) {
  const painted = usePaintedSlides(template.id)
  const count = painted?.slides.length ?? 6
  return (
    <ul className="grid grid-cols-4 gap-x-4 gap-y-6" aria-label={templatePickerCopy.templateSlides(template.name)}>
      {Array.from({ length: count }, (_, at) => (
        <li key={at}>
          <button
            type="button"
            className={tileClass}
            data-template-slide={at + 1}
            aria-label={templatePickerCopy.startWithSlide(at + 1, template.name)}
            disabled={painted === null}
            onClick={() => onChoose(at)}
          >
            <span className="block rounded-[var(--shape-segment)] transition-shadow group-hover:shadow-[0_0_0_2px_var(--primary)]">
              <SlideTile painted={painted} at={at} />
            </span>
            <span className="text-[length:var(--type-caption)] text-muted-foreground">{at + 1}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function TemplatePicker({
  open,
  shown = null,
  onOpenChange,
  onScratch,
  onChoose,
}: {
  open: boolean
  shown?: string | null
  onOpenChange: (open: boolean) => void
  onScratch?: () => void
  onChoose?: (template: DeckTemplate, slide?: number) => void
}) {
  const [opened, setOpened] = useState<string | null>(shown)
  const back = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const left = useRef<string | null>(null)
  const template = deckTemplates.find((each) => each.id === opened) ?? null
  useEffect(() => {
    if (template !== null) back.current?.focus()
    else if (left.current !== null)
      popup.current?.querySelector<HTMLElement>(`[data-template="${left.current}"]`)?.focus()
    left.current = template?.id ?? null
  }, [template])
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setOpened(null)
        onOpenChange(next)
      }}
    >
      <DialogPortal>
        <DialogOverlay className="bg-black/25" />
        <DialogPopup
          ref={popup}
          data-template-picker
          className="fixed top-[max(16px,calc(50vh-290px))] left-1/2 z-50 flex max-h-[calc(100vh-32px)] w-[min(928px,calc(100vw-32px))] -translate-x-1/2 flex-col rounded-[var(--shape-dialog)] bg-background shadow-[inset_0_0_0_1px_rgb(0_0_0/8%),0_24px_48px_rgb(0_0_0/16%)] outline-none"
        >
          <header className="flex h-14 shrink-0 items-center gap-2 px-6">
            {template === null ? null : (
              <Button
                ref={back}
                variant="ghost"
                size="icon-sm"
                className="-ml-2"
                aria-label={templatePickerCopy.backToTemplates}
                onClick={() => setOpened(null)}
              >
                <ChevronLeftIcon aria-hidden="true" />
              </Button>
            )}
            <DialogTitle className="flex-1 text-[length:var(--type-section)] font-medium text-foreground">
              {template === null ? templatePickerCopy.chooseTemplate : template.name}
            </DialogTitle>
            {template === null ? null : (
              <Button size="sm" data-add-all-slides onClick={() => onChoose?.(template)}>
                {templatePickerCopy.addAllSlides}
              </Button>
            )}
            <DialogClose render={<Button variant="ghost" size="icon-sm" aria-label={templatePickerCopy.close} />}>
              <XIcon aria-hidden="true" />
            </DialogClose>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-1 pb-6">
            {template === null ? (
              <div className="grid grid-cols-4 gap-x-4 gap-y-6">
                <ScratchCard onStart={() => onScratch?.()} />
                {deckTemplates.map((each) => (
                  <TemplateCard key={each.id} template={each} onOpen={() => setOpened(each.id)} />
                ))}
              </div>
            ) : (
              <TemplateSlideGrid template={template} onChoose={(slide) => onChoose?.(template, slide)} />
            )}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
